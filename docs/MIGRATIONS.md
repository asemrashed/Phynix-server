# Database Migrations

The project started with `prisma db push` during rapid development. To establish a clean migration history for production:

## Current state

- Baseline migrations exist under `backend/prisma/migrations/` (init, phase2, community, search_indexes)
- Schema may have drifted if `db push` was used after those migrations
- Run `bunx prisma migrate deploy` before production (never `db push` in prod)

## Reset to clean history (local dev only)

**Warning:** This drops all local data.

```bash
cd backend
bunx prisma migrate reset
bun run db:seed
```

## Baseline from current schema (recommended before deploy)

```bash
cd backend

# 1. Inspect drift
bunx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "$DATABASE_URL"

# 2. If drift exists, create a new migration
bunx prisma migrate dev --name sync_schema

# 3. Never use db push in production — always migrate deploy
bunx prisma migrate deploy
```

## Production deploy

```bash
cd backend
bunx prisma migrate deploy
bun run db:seed   # first deploy only
```
