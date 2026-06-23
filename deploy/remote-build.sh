#!/usr/bin/env bash
# Run on VPS after git pull — build types, backend, frontend and restart PM2
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/fxprime}"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

cd "$APP_DIR"

echo "==> Building packages/types"
bun install --cwd "$BACKEND_DIR/packages/types"
bun run --cwd "$BACKEND_DIR/packages/types" build

echo "==> Building backend"
bun install --cwd "$BACKEND_DIR"
cd "$BACKEND_DIR"
for attempt in 1 2 3; do
  if bunx prisma migrate deploy; then
    break
  fi
  if [ "$attempt" -eq 3 ]; then
    echo "Prisma migrate deploy failed after 3 attempts"
    exit 1
  fi
  echo "Migrate attempt $attempt failed — retrying in 15s..."
  sleep 15
done
bun run build
cd "$APP_DIR"

# Keep ngrok HTTPS URLs in sync (frontend build bakes NEXT_PUBLIC_* at compile time)
PUBLIC_URL=$(curl -s --max-time 3 http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "
import json,sys
try:
  data=json.load(sys.stdin)
  tunnels=data.get('tunnels',[])
  print(tunnels[0]['public_url'] if tunnels else '')
except Exception:
  print('')
" 2>/dev/null || true)

if [ -z "${PUBLIC_URL}" ] && [ -f "$BACKEND_DIR/.env" ]; then
  PUBLIC_URL=$(grep '^FRONTEND_URL=' "$BACKEND_DIR/.env" | cut -d= -f2- | tr -d '"' || true)
fi

if echo "${PUBLIC_URL}" | grep -q 'ngrok'; then
  API_URL="${PUBLIC_URL}/api/v1"
  for f in "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.production"; do
    [ -f "$f" ] || continue
    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${PUBLIC_URL}|" "$f"
    sed -i "s|^API_PUBLIC_URL=.*|API_PUBLIC_URL=${API_URL}|" "$f"
    sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=${PUBLIC_URL}|" "$f"
  done
  cat > "$FRONTEND_DIR/.env.production" <<ENV
NEXT_PUBLIC_API_URL=${API_URL}
NEXT_PUBLIC_SITE_URL=${PUBLIC_URL}
ENV
  echo "Using public URL: ${PUBLIC_URL}"
fi

echo "==> Building frontend"
bun install --cwd "$FRONTEND_DIR"
bun run --cwd "$FRONTEND_DIR" build

echo "==> Restarting PM2"
pm2 restart 4005-fx-prime-backend 3005-fxprime-frontend
pm2 save

sleep 2
curl -sf "http://127.0.0.1:4005/api/v1/health" && echo " Backend OK"
curl -sf -o /dev/null "http://127.0.0.1:3005" && echo " Frontend OK"
pm2 list

echo "==> Build complete"
