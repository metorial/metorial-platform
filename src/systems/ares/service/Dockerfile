# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Copy repository contents from the OSS root context
COPY . .

# Install CA certificates for Sentry CLI uploads
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

# Install dependencies from the OSS workspace
RUN bun install --linker=hoisted

# Generate Prisma client and build the service from the monorepo path
WORKDIR /app/src/systems/ares/service
RUN bun prisma generate
RUN bun run server:build
RUN bun run frontend:build

FROM builder AS workspace
WORKDIR /app/src/systems/ares/service
CMD ["sleep", "infinity"]

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built output, Prisma assets, and hoisted dependencies
COPY --from=builder /app/src/systems/ares/service/dist /app/dist
COPY --from=builder /app/src/systems/ares/service/prisma /app/prisma
COPY --from=builder /app/src/systems/ares/service/prisma.config.ts /app/prisma.config.ts
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/src/systems/ares/service/package.json /app/package.json

# Copy built frontends
COPY --from=builder /app/src/systems/ares/service/frontend/auth/dist /app/frontend/auth/dist
COPY --from=builder /app/src/systems/ares/service/frontend/admin/dist /app/frontend/admin/dist

# Expose ports (auth: 52120, admin: 52121, sso: 52122, internal: 52123, health: 12121)
EXPOSE 52120 52121 52122 52123 12121

# Health check using curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:52120/ping && curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "bun prisma db push --accept-data-loss && bun /app/dist/index.js"]
