#!/usr/bin/env bash
# Set GitHub Actions secrets for Docker Hub + VPS deploy on both FX Prime repos.
# Usage:
#   export DOCKERHUB_TOKEN='dckr_pat_...'
#   export VPS_SSH_PRIVATE_KEY="$(cat ~/.ssh/fxprime_deploy)"
#   bash deploy/setup-github-secrets.sh
set -euo pipefail

BACKEND_REPO="${BACKEND_REPO:-Adnan4141/fx-prime-backend}"
FRONTEND_REPO="${FRONTEND_REPO:-Adnan4141/fx-prime-frontend}"
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-adnanh7}"
VPS_HOST="${VPS_HOST:-62.72.56.160}"
VPS_USER="${VPS_USER:-root}"

require() {
  [ -n "${!1:-}" ] || {
    echo "Missing required env var: $1" >&2
    exit 1
  }
}

require DOCKERHUB_TOKEN
require VPS_SSH_PRIVATE_KEY

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI and run: gh auth login" >&2
  exit 1
fi

gh auth status >/dev/null

set_secret() {
  local repo="$1"
  local name="$2"
  local value="$3"
  printf '%s' "$value" | gh secret set "$name" --repo "$repo"
  echo "Set $name on $repo"
}

for repo in "$BACKEND_REPO" "$FRONTEND_REPO"; do
  set_secret "$repo" DOCKERHUB_USERNAME "$DOCKERHUB_USERNAME"
  set_secret "$repo" DOCKERHUB_TOKEN "$DOCKERHUB_TOKEN"
  set_secret "$repo" VPS_HOST "$VPS_HOST"
  set_secret "$repo" VPS_USER "$VPS_USER"
  set_secret "$repo" VPS_SSH_PRIVATE_KEY "$VPS_SSH_PRIVATE_KEY"
done

echo "Done. Optional frontend-only secret:"
echo "  gh secret set REPO_PAT --repo $FRONTEND_REPO   # if backend repo is private"
