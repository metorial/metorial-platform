# syntax=docker/dockerfile:1.7
FROM oven/bun:1.4.2 AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

FROM base AS pruner

COPY . .
RUN bun ./src/tooling/docker-build/prune.ts prisma:generate server:build admin:build --filter=@metorial/slates

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

RUN --mount=type=secret,id=turbo_token,required=false --mount=type=secret,id=turbo_signature,required=false sh /app/src/tooling/warp-cache/run-turbo.sh prisma:generate admin:build server:build --filter=@metorial/slates

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built output, Prisma assets, and hoisted dependencies.
COPY --from=builder /app/src/slates/apps/hub/dist /app/dist
COPY --from=builder /app/src/slates/apps/hub/prisma /app/prisma
COPY --from=builder /app/src/slates/apps/hub/prisma.config.ts /app/prisma.config.ts
COPY --from=builder /app/node_modules /app/node_modules

# Expose port
EXPOSE 52045
EXPOSE 52046
EXPOSE 52047

# Health check using curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD curl -f http://localhost:52045/ping && \
    curl -f http://localhost:52046/ping && \
    curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "bun prisma db push --accept-data-loss && bun /app/dist/index.js"]
