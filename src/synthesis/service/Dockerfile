# syntax=docker/dockerfile:1.7
# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

ARG SENTRY_AUTH_TOKEN
ARG TURBO_API
ARG TURBO_TEAM
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
ENV TURBO_API=${TURBO_API}
ENV TURBO_TEAM=${TURBO_TEAM}

# Copy repository contents from the OSS root context
COPY . .

# Install CA certificates and native build tools for dependency install scripts
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies and build local workspace clients before bundling
RUN sh ./src/synthesis/scripts/prepare-docker-build.sh

# Generate Prisma client and build the service from the monorepo path
RUN --mount=type=secret,id=turbo_token,required=false --mount=type=secret,id=turbo_signature,required=false sh /app/src/tooling/warp-cache/run-turbo.sh prisma:generate server:build --filter=@metorial/synthesis

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built output, Prisma assets, and hoisted dependencies
COPY --from=builder /app/src/synthesis/service/dist /app/dist
COPY --from=builder /app/src/synthesis/service/prisma /app/prisma
COPY --from=builder /app/src/synthesis/service/prisma.config.ts /app/prisma.config.ts
COPY --from=builder /app/node_modules /app/node_modules

# Expose primary port
EXPOSE 52160

# Health check using the API and readiness server
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:52160/ping && curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "bun prisma db push --config /app/prisma.config.ts --accept-data-loss && bun /app/dist/index.js"]
