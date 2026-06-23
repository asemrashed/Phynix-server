# syntax=docker/dockerfile:1

FROM oven/bun:1.3.9 AS base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl openssl rsync \
  && rm -rf /var/lib/apt/lists/*

FROM base AS builder

ENV NODE_ENV=development

COPY package.json bun.lock ./
COPY packages/types/package.json packages/types/bun.lock packages/types/tsconfig.json ./packages/types/
COPY packages/types/src ./packages/types/src
COPY prisma ./prisma

RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

RUN bunx prisma generate && bun run build

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=4005

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/packages/types/dist ./packages/types/dist

RUN mkdir -p /app/uploads

EXPOSE 4005

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" || exit 1

CMD ["bun", "dist/index.js"]
