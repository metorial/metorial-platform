# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Copy repository contents from the OSS root context
COPY . .

# Install CA certificates for Sentry CLI uploads and prepare Shuttle SDK packages.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN sh ./src/systems/shuttle/scripts/prepare-docker-build.sh

# Generate Prisma client and build the service from the monorepo path.
WORKDIR /app/src/systems/shuttle/service
RUN bun prisma generate
RUN bun run server:build

FROM builder AS workspace
WORKDIR /app/src/systems/shuttle/service
CMD ["sleep", "infinity"]

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built output, Prisma assets, and hoisted dependencies.
COPY --from=builder /app/src/systems/shuttle/service/dist /app/dist
COPY --from=builder /app/src/systems/shuttle/service/prisma /app/prisma
COPY --from=builder /app/src/systems/shuttle/service/prisma.config.ts /app/prisma.config.ts
COPY --from=builder /app/node_modules /app/node_modules

# Expose port
EXPOSE 52080
EXPOSE 52081

# Health check using curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:52080/ping && curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "bun prisma db push --accept-data-loss && bun /app/dist/index.js"]
