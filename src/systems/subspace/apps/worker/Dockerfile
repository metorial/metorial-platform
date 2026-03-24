# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy all package files
COPY package.json bun.lock* ./
COPY apps ./apps
COPY packages ./packages
COPY modules ./modules
COPY provider-backends ./provider-backends
COPY db ./db

# Install CA certificates for Sentry CLI uploads
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

# Install all dependencies (including dev dependencies for build)
RUN bun install

# Generate Prisma client
WORKDIR /app/db
RUN bunx prisma generate

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Build the application using ncc
# This bundles all dependencies into a single file
WORKDIR /app/apps/worker
# Temporarily use the build-friendly tsconfig
RUN mv tsconfig.json tsconfig.json.bak && \
  mv tsconfig.build.json tsconfig.json && \
  bun run server:build; \
  BUILD_EXIT_CODE=$?; \
  mv tsconfig.json tsconfig.build.json && \
  mv tsconfig.json.bak tsconfig.json; \
  exit $BUILD_EXIT_CODE

# Production stage
FROM oven/bun:1-alpine AS production

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy the built application from builder
COPY --from=builder /app/apps/worker/dist /app/dist

# Copy prisma schema and generated client from builder
COPY --from=builder /app/db /app/db

# Copy entire node_modules from builder to ensure prisma has all dependencies
COPY --from=builder /app/node_modules /app/node_modules

# Set environment to production
ENV NODE_ENV=production

# Worker has no main HTTP port, only health check on 12121
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "cd db && bun prisma db push --accept-data-loss && cd /app && bun dist/index.js"]
