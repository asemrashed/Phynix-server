# Deployment (Docker CI/CD + VPS)

FX Prime uses two GitHub repos and one VPS. CI builds Docker images, pushes them to Docker Hub, then deploys the stack over SSH.

| App | Image | VPS runtime |
|-----|-------|-------------|
| Backend | `adnanh7/fx-prime-backend:main` | Docker Compose service on `127.0.0.1:4005` |
| Frontend | `adnanh7/fx-prime-frontend:main` | Docker Compose service on `127.0.0.1:3005` |
| Redis | `redis:7-alpine` | Docker Compose service |
| PostgreSQL | host PostgreSQL | kept outside Docker |

Nginx/ngrok stays as-is: nginx listens on `:8088`, proxies `/api/*` to backend `:4005`, and proxies all other traffic to frontend `:3005`.

## Auto-deploy flow

```mermaid
flowchart LR
  push[Push to main]
  ci[GitHub Actions CI]
  build[Build Docker image]
  hub[Push to Docker Hub]
  ssh[SSH to VPS]
  compose[Docker Compose pull/up]
  push --> ci --> build --> hub --> ssh --> compose
```

- PRs build and test but do not push images or deploy.
- Pushes to `main` build/push images and run `/var/www/fxprime/deploy/docker-deploy.sh`.
- Either repo can trigger deploy; the deploy script pulls both app images and recreates the Compose stack.

## One-time VPS setup

Run as `root` on `62.72.56.160`:

```bash
mkdir -p /var/www/fxprime/deploy /var/www/fxprime/uploads
bash /var/www/fxprime/deploy/vps-docker-bootstrap.sh
```

If the bootstrap script is not on the VPS yet, copy it from this repo first:

```bash
scp backend/deploy/vps-docker-bootstrap.sh root@62.72.56.160:/var/www/fxprime/deploy/
ssh root@62.72.56.160 'chmod +x /var/www/fxprime/deploy/vps-docker-bootstrap.sh && /var/www/fxprime/deploy/vps-docker-bootstrap.sh'
```

Create the production env file:

```bash
cp /var/www/fxprime/deploy/backend.env.example /var/www/fxprime/backend.env
nano /var/www/fxprime/backend.env
```

Important values:

```bash
DATABASE_URL=postgresql://user:password@host.docker.internal:5432/fxprime
FRONTEND_URL=https://your-ngrok-or-domain.example
PUBLIC_SITE_URL=https://your-ngrok-or-domain.example
API_PUBLIC_URL=https://your-ngrok-or-domain.example/api/v1
CORS_ORIGINS=https://your-ngrok-or-domain.example
```

The Docker bridge must be allowed by host PostgreSQL. If migrations cannot connect, update PostgreSQL `pg_hba.conf` / listen settings for the Docker bridge, then reload PostgreSQL.

## GitHub secrets and variables

Set in both repos:

| Secret | Value |
|--------|-------|
| `DOCKERHUB_USERNAME` | `adnanh7` |
| `DOCKERHUB_TOKEN` | Docker Hub access token (read/write) |
| `VPS_SSH_PRIVATE_KEY` | Private key for GitHub Actions to SSH into the VPS |
| `VPS_HOST` | `62.72.56.160` |
| `VPS_USER` | `root` |

Frontend repo only:

| Secret / variable | Purpose |
|-------------------|---------|
| `REPO_PAT` | Checkout backend `packages/types` and `deploy` assets if backend repo is private |
| `NEXT_PUBLIC_SITE_URL` variable | Optional override; otherwise CI reads current ngrok URL from the VPS |
| `NEXT_PUBLIC_API_URL` variable | Optional override; otherwise `${NEXT_PUBLIC_SITE_URL}/api/v1` |

Do not store database/JWT/payment secrets in GitHub. They live in `/var/www/fxprime/backend.env`.

Create Docker Hub repositories before the first push:

- `adnanh7/fx-prime-backend`
- `adnanh7/fx-prime-frontend`

### VPS Docker Hub credentials (optional)

For manual deploys without passing the token each time, create on the VPS:

```bash
cat > /var/www/fxprime/deploy/credentials.env <<'EOF'
DOCKERHUB_USERNAME=adnanh7
DOCKERHUB_TOKEN=your-docker-hub-token
EOF
chmod 600 /var/www/fxprime/deploy/credentials.env
```

`docker-deploy.sh` loads this file automatically when present.

### GitHub secrets bootstrap script

After `gh auth login`:

```bash
export DOCKERHUB_TOKEN='dckr_pat_...'
export VPS_SSH_PRIVATE_KEY="$(cat ~/.ssh/your_deploy_key)"
bash deploy/setup-github-secrets.sh
```

## Manual deploy

After both images exist on Docker Hub:

```bash
ssh root@62.72.56.160 'bash /var/www/fxprime/deploy/docker-deploy.sh'
```

To pull private images manually, pass credentials:

```bash
ssh root@62.72.56.160 \
  'DOCKERHUB_USERNAME=adnanh7 DOCKERHUB_TOKEN=<token> bash /var/www/fxprime/deploy/docker-deploy.sh'
```

Useful checks:

```bash
ssh root@62.72.56.160 'docker compose -f /var/www/fxprime/deploy/docker-compose.yml ps'
ssh root@62.72.56.160 'curl -fsS http://127.0.0.1:4005/api/v1/health'
ssh root@62.72.56.160 'curl -fsS -o /dev/null http://127.0.0.1:3005 && echo frontend-ok'
ssh root@62.72.56.160 'nginx -t'
```

## Rollback

Use the previous image SHA tag from Docker Hub:

```bash
ssh root@62.72.56.160 '
  BACKEND_IMAGE=adnanh7/fx-prime-backend:<sha> \
  FRONTEND_IMAGE=adnanh7/fx-prime-frontend:<sha> \
  DOCKERHUB_USERNAME=adnanh7 DOCKERHUB_TOKEN=<token> \
  bash /var/www/fxprime/deploy/docker-deploy.sh
'
```

Or revert the bad commit and push to `main`; CI will build and deploy the reverted image.
