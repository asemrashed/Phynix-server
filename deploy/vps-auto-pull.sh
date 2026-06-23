#!/usr/bin/env bash
# Cron fallback — pull and rebuild when GitHub has new commits (no inbound SSH needed)
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/fxprime}"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
LOCK_FILE="${LOCK_FILE:-/tmp/fxprime-deploy.lock}"

# Skip if a deploy is already running (vps-git-deploy holds this lock)
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi
flock -u 9
exec 9>&-

cd "$BACKEND_DIR" && git fetch origin main -q
cd "$FRONTEND_DIR" && git fetch origin main -q

backend_behind=$(cd "$BACKEND_DIR" && git rev-list --count HEAD..origin/main)
frontend_behind=$(cd "$FRONTEND_DIR" && git rev-list --count HEAD..origin/main)

if [ "$backend_behind" -eq 0 ] && [ "$frontend_behind" -eq 0 ]; then
  exit 0
fi

echo "$(date -Is) Auto-pull: backend +${backend_behind} frontend +${frontend_behind} commits"
bash "$BACKEND_DIR/deploy/vps-git-deploy.sh"
