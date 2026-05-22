# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Copy repository contents from the OSS root context
COPY . .

# Install CA certificates for Sentry CLI uploads and prepare Slates packages.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN sh ./src/systems/slates/scripts/prepare-docker-build.sh

# Build the registry app from the monorepo path.
WORKDIR /app/src/systems/slates/apps/registry
RUN bun prisma generate
RUN bun run admin:build
RUN bun run server:build

FROM builder AS workspace
WORKDIR /app/src/systems/slates/apps/registry
CMD ["sleep", "infinity"]

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built output, Prisma assets, and hoisted dependencies.
COPY --from=builder /app/src/systems/slates/apps/registry/dist /app/dist
COPY --from=builder /app/src/systems/slates/apps/registry/prisma /app/prisma
COPY --from=builder /app/src/systems/slates/apps/registry/prisma.config.ts /app/prisma.config.ts
COPY --from=builder /app/node_modules /app/node_modules

# Expose ports
EXPOSE 52040
EXPOSE 52041
EXPOSE 52042

# Health check using curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD curl -f http://localhost:52040/ping && \
    curl -f http://localhost:52041/ping && \
    curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "bun prisma db push --accept-data-loss && bun /app/dist/index.js"]
