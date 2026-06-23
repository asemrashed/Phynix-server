#!/usr/bin/env bash
# Docker Compose deploy entrypoint for GitHub Actions and manual VPS deploys.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/fxprime}"
DEPLOY_DIR="${DEPLOY_DIR:-$APP_DIR/deploy}"
COMPOSE_FILE="${COMPOSE_FILE:-$DEPLOY_DIR/docker-compose.yml}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$APP_DIR/backend.env}"
UPLOADS_DIR="${UPLOADS_DIR:-$APP_DIR/uploads}"
LOCK_FILE="${LOCK_FILE:-/tmp/fxprime-docker-deploy.lock}"

BACKEND_IMAGE="${BACKEND_IMAGE:-adnanh7/fx-prime-backend:main}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-adnanh7/fx-prime-frontend:main}"
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-adnanh7}"
STOP_LEGACY_PROCESSES="${STOP_LEGACY_PROCESSES:-true}"
SYNC_NGROK_ENV="${SYNC_NGROK_ENV:-true}"

export BACKEND_IMAGE FRONTEND_IMAGE BACKEND_ENV_FILE UPLOADS_DIR

CREDENTIALS_PATH="${CREDENTIALS_FILE:-/var/www/fxprime/deploy/credentials.env}"
if [ -f "$CREDENTIALS_PATH" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$CREDENTIALS_PATH"
  set +a
fi

log() {
  printf '==> %s\n' "$*"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required but not installed"
}

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

stop_legacy_port() {
  local port="$1"
  local pids pid args
  pids="$(ss -ltnp "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u || true)"
  [ -n "$pids" ] || return 0

  for pid in $pids; do
    args="$(ps -p "$pid" -o args= 2>/dev/null || true)"
    if printf '%s\n' "$args" | grep -Eq '(bun|next-server|next start)'; then
      log "Stopping legacy process on port $port: pid=$pid ($args)"
      kill "$pid" 2>/dev/null || true
    fi
  done
}

resolve_ngrok_url() {
  curl -fsS --max-time 3 http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c '
import json, sys
try:
    tunnels = json.load(sys.stdin).get("tunnels", [])
    public = next((t.get("public_url", "") for t in tunnels if t.get("public_url", "").startswith("https://")), "")
    print(public)
except Exception:
    print("")
' 2>/dev/null || true
}

sync_backend_public_env() {
  [ "$SYNC_NGROK_ENV" = "true" ] || return 0
  [ -f "$BACKEND_ENV_FILE" ] || return 0

  local public_url api_url
  public_url="$(resolve_ngrok_url)"
  [ -n "$public_url" ] || return 0
  api_url="${public_url}/api/v1"

  log "Syncing backend public URL env to $public_url"
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${public_url}|" "$BACKEND_ENV_FILE"
  sed -i "s|^PUBLIC_SITE_URL=.*|PUBLIC_SITE_URL=${public_url}|" "$BACKEND_ENV_FILE"
  sed -i "s|^API_PUBLIC_URL=.*|API_PUBLIC_URL=${api_url}|" "$BACKEND_ENV_FILE"
  sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=${public_url}|" "$BACKEND_ENV_FILE"
}

exec 9>"$LOCK_FILE"
log "Waiting for deploy lock"
flock 9

require_command docker
[ -f "$COMPOSE_FILE" ] || fail "Compose file not found: $COMPOSE_FILE"
[ -f "$BACKEND_ENV_FILE" ] || fail "Backend env file not found: $BACKEND_ENV_FILE"

mkdir -p "$DEPLOY_DIR" "$UPLOADS_DIR"

if [ -n "${DOCKERHUB_TOKEN:-}" ]; then
  log "Logging in to Docker Hub as $DOCKERHUB_USERNAME"
  printf '%s' "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin >/dev/null
fi

if [ "$STOP_LEGACY_PROCESSES" = "true" ]; then
  stop_legacy_port 4005
  stop_legacy_port 3005
fi

sync_backend_public_env

log "Validating compose config"
compose config >/dev/null

log "Pulling images"
compose pull

log "Running Prisma migrations"
compose run --rm --no-deps backend bunx prisma migrate deploy

log "Starting containers"
compose up -d --remove-orphans redis backend frontend

log "Health checking backend"
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:4005/api/v1/health >/dev/null; then
    break
  fi
  [ "$attempt" -lt 10 ] || fail "Backend health check failed"
  sleep 3
done

log "Health checking frontend"
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS -o /dev/null http://127.0.0.1:3005; then
    break
  fi
  [ "$attempt" -lt 10 ] || fail "Frontend health check failed"
  sleep 3
done

if command -v nginx >/dev/null 2>&1; then
  log "Checking nginx config"
  nginx -t
fi

compose ps
log "Docker deploy complete"
