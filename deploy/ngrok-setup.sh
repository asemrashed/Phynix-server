#!/usr/bin/env bash
# Run on VPS after setting NGROK_AUTHTOKEN in /var/www/fxprime/backend/deploy/.ngrok-env
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/fxprime}"
DEPLOY_DIR="${APP_DIR}/backend/deploy"
NGROK_ENV="${DEPLOY_DIR}/.ngrok-env"

if [[ ! -f "$NGROK_ENV" ]]; then
  echo "Create ${NGROK_ENV} with: NGROK_AUTHTOKEN=your_token"
  echo "Get a free token at https://dashboard.ngrok.com/get-started/your-authtoken"
  exit 1
fi

# shellcheck source=/dev/null
source "$NGROK_ENV"

if [[ -z "${NGROK_AUTHTOKEN:-}" ]]; then
  echo "NGROK_AUTHTOKEN is empty in ${NGROK_ENV}"
  exit 1
fi

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

# Nginx reverse proxy — free ngrok only provides one public URL
cp "${DEPLOY_DIR}/nginx-fxprime.conf" /etc/nginx/sites-available/fxprime
ln -sf /etc/nginx/sites-available/fxprime /etc/nginx/sites-enabled/fxprime
nginx -t
systemctl reload nginx

ngrok config add-authtoken "$NGROK_AUTHTOKEN"

mkdir -p /root/.config/ngrok
sed "s/\${NGROK_AUTHTOKEN}/${NGROK_AUTHTOKEN}/" "${DEPLOY_DIR}/ngrok.yml" > /root/.config/ngrok/ngrok.yml

pm2 delete ngrok-fxprime 2>/dev/null || true
pm2 start ngrok --name ngrok-fxprime -- start fxprime --config /root/.config/ngrok/ngrok.yml
pm2 save

echo "Waiting for ngrok tunnel..."
sleep 5

PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "
import json,sys
data=json.load(sys.stdin)
tunnels=data.get('tunnels',[])
if tunnels:
    print(tunnels[0]['public_url'])
" 2>/dev/null || true)

if [[ -z "$PUBLIC_URL" ]]; then
  echo "Could not read ngrok URL. Check: pm2 logs ngrok-fxprime"
  exit 1
fi

API_URL="${PUBLIC_URL}/api/v1"

# Bun loads .env.production in NODE_ENV=production and overrides .env — update both
for ENV_FILE in "${APP_DIR}/backend/.env" "${APP_DIR}/backend/.env.production"; do
  [ -f "$ENV_FILE" ] || continue
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${PUBLIC_URL}|" "$ENV_FILE"
  sed -i "s|^API_PUBLIC_URL=.*|API_PUBLIC_URL=${API_URL}|" "$ENV_FILE"
  sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=${PUBLIC_URL}|" "$ENV_FILE"
done

cat > "${APP_DIR}/frontend/.env.production" <<ENV
NEXT_PUBLIC_API_URL=${API_URL}
NEXT_PUBLIC_SITE_URL=${PUBLIC_URL}
ENV

cd "${APP_DIR}/frontend"
bun run build

pm2 restart 4005-fx-prime-backend 3005-fxprime-frontend
pm2 save

echo ""
echo "ngrok active (HTTPS — login/auth will work):"
echo "  Site: ${PUBLIC_URL}"
echo "  API:  ${API_URL}"
