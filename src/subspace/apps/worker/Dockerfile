# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

# Install CA certificates and native build tools before preparing required workspaces.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*
RUN sh ./src/subspace/scripts/prepare-docker-build.sh

# Generate Prisma client
WORKDIR /app/src/subspace/db
RUN bun run prisma:generate

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Build the application using ncc
# This bundles all dependencies into a single file
WORKDIR /app/src/subspace/apps/worker
RUN bun run server:build

# Production stage
FROM oven/bun:1-alpine AS production

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy the built application from builder
COPY --from=builder /app/src/subspace/apps/worker/dist /app/dist

# Copy prisma schema and generated client from builder
COPY --from=builder /app/src/subspace/db /app/db

# Copy entire node_modules from builder to ensure prisma has all dependencies
COPY --from=builder /app/node_modules /app/node_modules

# Set environment to production
ENV NODE_ENV=production

# Worker has no main HTTP port, only health check on 12121
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "cd db && bun prisma db push --accept-data-loss && cd /app && bun dist/index.js"]