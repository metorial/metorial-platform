# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Copy repository contents from the OSS root context
COPY . .

# Install CA certificates and native build tools before preparing workspace packages
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*
RUN sh ./src/systems/cargo/scripts/prepare-docker-build.sh

# Generate Prisma client from the split DB package and build the service app
WORKDIR /app/src/systems/cargo/db
RUN bun run prisma:generate

WORKDIR /app/src/systems/cargo/service
RUN bun run server:build

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built output, Prisma assets, and hoisted dependencies
COPY --from=builder /app/src/systems/cargo/service/dist /app/dist
COPY --from=builder /app/src/systems/cargo/db/prisma /app/prisma
COPY --from=builder /app/src/systems/cargo/db/prisma.config.ts /app/prisma.config.ts
COPY --from=builder /app/node_modules /app/node_modules

# Expose primary ports
EXPOSE 52150
EXPOSE 52151

# Health check using the content API and readiness server
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:52151/ping && curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "bun prisma db push --accept-data-loss --schema prisma/schema --config prisma.config.ts && bun /app/dist/index.js"]
