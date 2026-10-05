# syntax=docker/dockerfile:1.7
FROM oven/bun:1.4.2 AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

FROM base AS pruner

COPY . .
RUN bun ./src/tooling/docker-build/prune.ts prisma:generate server:build --filter=@metorial/nebula

FROM scratch AS pruned

COPY --from=pruner /app/out/ /

FROM base AS dependencies

COPY --from=pruned /json/ ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --linker=hoisted

FROM dependencies AS builder

ARG SENTRY_AUTH_TOKEN
ARG TURBO_API
ARG TURBO_TEAM
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
ENV TURBO_API=${TURBO_API}
ENV TURBO_TEAM=${TURBO_TEAM}

COPY --from=pruned /full/ ./

RUN --mount=type=secret,id=turbo_token,required=false --mount=type=secret,id=turbo_signature,required=false sh /app/src/tooling/warp-cache/run-turbo.sh prisma:generate server:build --filter=@metorial/nebula

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built output, Prisma assets, and hoisted dependencies
COPY --from=builder /app/src/nebula/service/dist /app/dist
COPY --from=builder /app/src/nebula/service/prisma /app/prisma
COPY --from=builder /app/src/nebula/service/prisma.config.ts /app/prisma.config.ts
COPY --from=builder /app/node_modules /app/node_modules

# Expose port
EXPOSE 52170

# Health check using curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:52170/ping && curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "bun prisma db push --accept-data-loss && bun /app/dist/index.js"]
