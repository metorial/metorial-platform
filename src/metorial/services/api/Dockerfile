# syntax=docker/dockerfile:1.7
FROM oven/bun:1.4.2 AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

FROM base AS pruner

COPY . .
RUN bun ./src/tooling/docker-build/prune.ts prisma:generate oss:server:build --filter=@metorial/app-api --filter=@metorial/db --filter=@metorial/multi-region --filter=@metorial-subspace/db

FROM scratch AS pruned

COPY --from=pruner /app/out/ /

FROM base AS dependencies

COPY --from=pruned /json/ ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --linker=hoisted

FROM dependencies AS builder

ARG SENTRY_AUTH_TOKEN
ARG TURBO_API
ARG TURBO_TEAM
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
ENV TURBO_API=${TURBO_API}
ENV TURBO_TEAM=${TURBO_TEAM}
ENV NODE_OPTIONS=--max-old-space-size=15360

COPY --from=pruned /full/ ./

RUN --mount=type=secret,id=turbo_token,required=false --mount=type=secret,id=turbo_signature,required=false sh /app/src/tooling/warp-cache/run-turbo.sh prisma:generate --filter=@metorial/db --filter=@metorial/multi-region --filter=@metorial-subspace/db --filter=@metorial/app-api
RUN --mount=type=secret,id=turbo_token,required=false --mount=type=secret,id=turbo_signature,required=false sh /app/src/tooling/warp-cache/run-turbo.sh oss:server:build --filter=@metorial/app-api

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

COPY --from=builder /app/src/metorial/services/api/dist /app/dist

# Prisma schemas for the core, global (multi-region) and subspace databases
COPY --from=builder /app/src/metorial/db/prisma /app/db/core/prisma
COPY --from=builder /app/src/metorial/db/prisma.config.ts /app/db/core/prisma.config.ts
COPY --from=builder /app/src/metorial/multi-region/prisma /app/db/global/prisma
COPY --from=builder /app/src/metorial/multi-region/prisma.config.ts /app/db/global/prisma.config.ts
COPY --from=builder /app/src/metorial/products/integrations/db/prisma /app/db/subspace/prisma
COPY --from=builder /app/src/metorial/products/integrations/db/prisma.config.ts /app/db/subspace/prisma.config.ts

COPY --from=builder /app/node_modules /app/node_modules

ENV NODE_ENV=production

EXPOSE 4310 4311 4315 4316 4317 4318

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:4310/ping || exit 1

# Push all schemas, then start the API (HTTP + worker)
CMD ["sh", "-c", "for db in core global subspace; do (cd /app/db/$db && bun prisma db push --accept-data-loss) || exit 1; done && bun /app/dist/index.js"]
