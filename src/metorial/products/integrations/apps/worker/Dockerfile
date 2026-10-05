# syntax=docker/dockerfile:1.7
FROM oven/bun:1.4.2 AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

FROM base AS pruner

COPY . .
RUN bun ./src/tooling/docker-build/prune.ts prisma:generate server:build --filter=@metorial-subspace/app-worker --filter=@metorial/db --filter=@metorial/multi-region --filter=@metorial-subspace/db

FROM base AS dependencies

COPY --from=pruner /app/out/json/ ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --linker=hoisted

FROM dependencies AS builder

ARG SENTRY_AUTH_TOKEN
ARG TURBO_API
ARG TURBO_TEAM
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
ENV TURBO_API=${TURBO_API}
ENV TURBO_TEAM=${TURBO_TEAM}

COPY --from=pruner /app/out/full/ ./

RUN --mount=type=secret,id=turbo_token,required=false --mount=type=secret,id=turbo_signature,required=false sh /app/src/tooling/warp-cache/run-turbo.sh prisma:generate --filter=@metorial/db --filter=@metorial/multi-region --filter=@metorial-subspace/db --filter=@metorial-subspace/app-worker
RUN --mount=type=secret,id=turbo_token,required=false --mount=type=secret,id=turbo_signature,required=false sh /app/src/tooling/warp-cache/run-turbo.sh server:build --filter=@metorial-subspace/app-worker

# Production stage
FROM oven/bun:1-alpine AS production

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy the built application from builder
COPY --from=builder /app/src/metorial/products/integrations/apps/worker/dist /app/dist

# Copy prisma schema and generated client from builder
COPY --from=builder /app/src/metorial/products/integrations/db /app/db

# Copy entire node_modules from builder to ensure prisma has all dependencies
COPY --from=builder /app/node_modules /app/node_modules

# Set environment to production
ENV NODE_ENV=production

# Worker has no main HTTP port, only health check on 12121
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "cd db && bun prisma db push --accept-data-loss && cd /app && bun dist/index.js"]
