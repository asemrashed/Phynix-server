# FX Prime Academy — Backend

Express API + PostgreSQL (Prisma) for [FX Prime Academy](https://github.com/Adnan4141/fx-prime-backend).

This repo is half of a **polyrepo**: the Next.js app lives in [fx-prime-frontend](https://github.com/Adnan4141/fx-prime-frontend).

## Local setup (polyrepo)

Clone both repos as **siblings** under one parent folder:

```bash
mkdir finance-academy && cd finance-academy

git clone git@github.com:Adnan4141/fx-prime-backend.git backend
git clone git@github.com:Adnan4141/fx-prime-frontend.git frontend
```

Expected layout:

```
finance-academy/
├── backend/     ← this repo
└── frontend/    ← separate Git repo
```

### Install & run

```bash
cd backend
cp .env.example .env
bun install
bun run db:seed
bun run dev      # http://localhost:4000
```

In another terminal: `cd frontend && bun install && bun run dev` → http://localhost:3000

## Shared types

Zod schemas and TypeScript types live in `packages/types/` (`@fxprime/types`). The frontend repo consumes them via a sibling path (`../backend/packages/types`) or CI checkout — see frontend README.

After schema changes:

```bash
bun run --cwd packages/types build
```

## Seed credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@fxprimeacademy.com` | `password123` |

## Testing

```bash
bun test
bun run build
```

## Docs

| Doc | Description |
|-----|-------------|
| [docs/API.md](./docs/API.md) | REST API reference |
| [docs/MIGRATIONS.md](./docs/MIGRATIONS.md) | Prisma migrations |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | CI/CD + VPS (pulls **both** repos) |

## GitHub

- **Repo:** [Adnan4141/fx-prime-backend](https://github.com/Adnan4141/fx-prime-backend)
- **CI:** `.github/workflows/ci.yml` — tests + deploy orchestration on `main`
