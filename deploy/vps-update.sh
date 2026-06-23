#!/usr/bin/env bash
# Manual emergency deploy — rsync from local monorepo to VPS (when git pull is unavailable)
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@62.72.56.160}"
APP_DIR="${APP_DIR:-/var/www/fxprime}"
LOCAL_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

SSH_ARGS=()
RSYNC_SSH="ssh"
if [ -n "${SSH_IDENTITY_FILE:-}" ]; then
  SSH_ARGS=(-i "$SSH_IDENTITY_FILE")
  RSYNC_SSH="ssh -i ${SSH_IDENTITY_FILE}"
fi

echo "==> Syncing code to ${VPS_HOST}:${APP_DIR}"
ssh "${SSH_ARGS[@]}" "$VPS_HOST" "mkdir -p ${APP_DIR}/backend ${APP_DIR}/frontend"

rsync -avz --delete -e "$RSYNC_SSH" \
  --exclude node_modules \
  --exclude .next \
  --exclude dist \
  --exclude .git \
  --exclude .env \
  --exclude .env.production \
  --exclude deploy/.ngrok-env \
  "${LOCAL_ROOT}/backend/" "${VPS_HOST}:${APP_DIR}/backend/"

rsync -avz --delete -e "$RSYNC_SSH" \
  --exclude node_modules \
  --exclude .next \
  --exclude dist \
  --exclude .git \
  --exclude .env.local \
  --exclude .env.production \
  "${LOCAL_ROOT}/frontend/" "${VPS_HOST}:${APP_DIR}/frontend/"

echo "==> Building on VPS"
ssh "${SSH_ARGS[@]}" "$VPS_HOST" "bash ${APP_DIR}/backend/deploy/remote-build.sh"

echo "==> Update complete"
