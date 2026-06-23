#!/usr/bin/env bash
# One-time VPS bootstrap for Docker based deploys on Ubuntu.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/fxprime}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root" >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

mkdir -p "$APP_DIR/deploy" "$APP_DIR/uploads"
chmod 755 "$APP_DIR" "$APP_DIR/deploy" "$APP_DIR/uploads"

docker --version
docker compose version
echo "Bootstrap complete. Create $APP_DIR/backend.env before running docker-deploy.sh."
