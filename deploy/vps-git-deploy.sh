#!/usr/bin/env bash
# Entry point for GitHub Actions — pull both repos and rebuild on VPS
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/fxprime}"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
LOCK_FILE="${LOCK_FILE:-/tmp/fxprime-deploy.lock}"

exec 9>"$LOCK_FILE"
echo "==> Waiting for deploy lock"
flock 9

echo "==> Pulling backend"
cd "$BACKEND_DIR"
git fetch origin main
git reset --hard origin/main

echo "==> Pulling frontend"
cd "$FRONTEND_DIR"
git fetch origin main
git reset --hard origin/main

bash "$BACKEND_DIR/deploy/remote-build.sh"
