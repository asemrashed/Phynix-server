#!/usr/bin/env bash
# One-time: install self-hosted GitHub Actions runner on VPS (run as root)
set -euo pipefail

REPO="${1:?Usage: setup-github-runner.sh <owner/repo> <registration-token>}"
TOKEN="${2:?Missing registration token}"
RUNNER_VERSION="${RUNNER_VERSION:-2.321.0}"
RUNNER_USER="${RUNNER_USER:-github-runner}"
INSTALL_DIR="/var/www/actions-runner-${REPO##*/}"

export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq curl ca-certificates

if ! id "$RUNNER_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$RUNNER_USER"
fi

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
chown -R "$RUNNER_USER:$RUNNER_USER" "$INSTALL_DIR"

if [ ! -f ./config.sh ]; then
  curl -fsSL -o actions-runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  tar xzf actions-runner.tar.gz
  rm actions-runner.tar.gz
  chown -R "$RUNNER_USER:$RUNNER_USER" "$INSTALL_DIR"
fi

sudo -u "$RUNNER_USER" ./config.sh \
  --url "https://github.com/${REPO}" \
  --token "$TOKEN" \
  --name "fxprime-vps-${REPO##*/}" \
  --labels "fxprime-vps" \
  --unattended \
  --replace

./svc.sh install "$RUNNER_USER"
./svc.sh start

# Opt into Node.js 24 for JavaScript-based actions (checkout, etc.)
for envfile in "$INSTALL_DIR/.env"; do
  grep -q FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 "$envfile" 2>/dev/null \
    || echo "FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true" >> "$envfile"
done

cat > /etc/sudoers.d/github-runner-deploy <<EOF
${RUNNER_USER} ALL=(root) NOPASSWD: /var/www/fxprime/backend/deploy/vps-git-deploy.sh
${RUNNER_USER} ALL=(root) NOPASSWD: /var/www/fxprime/backend/deploy/vps-auto-pull.sh
EOF
chmod 440 /etc/sudoers.d/github-runner-deploy

echo "Runner installed for ${REPO} at ${INSTALL_DIR}"
