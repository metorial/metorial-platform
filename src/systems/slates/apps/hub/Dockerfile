FROM oven/bun:1 AS base

# Install curl for health checks
RUN apt-get update && \
    apt-get install -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies stage
FROM base AS deps

# Copy workspace files
COPY slates/package.json slates/bun.lock* ./
COPY slates/apps ./apps
COPY slates/packages ./packages
COPY slates/clients ./clients
COPY _clients/slates-hub ./clients/hub
COPY _clients/signal ./clients/signal

# Install dependencies (production only)
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS builder

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Copy workspace files
COPY slates/package.json slates/bun.lock* ./
COPY slates/apps ./apps
COPY slates/packages ./packages
COPY slates/clients ./clients
COPY _clients/slates-hub ./clients/hub
COPY _clients/signal ./clients/signal

# Install all dependencies (including devDependencies for Prisma generation)
RUN bun install --frozen-lockfile

WORKDIR /app/apps/hub

# Generate Prisma client
RUN bun prisma generate

RUN bun run admin:build

# Build server bundle
RUN bun run server:build

# Production stage
FROM base AS runner

WORKDIR /app

RUN apt-get update && \
    apt-get install -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy generated Prisma client from builder
COPY --from=builder /app/apps/hub/prisma/generated ./prisma/generated

# Copy Prisma schema (needed for db push)
COPY --from=builder /app/apps/hub/prisma ./prisma
COPY --from=builder /app/apps/hub/prisma.config.ts ./prisma.config.ts

# Copy built bundle
COPY --from=builder /app/apps/hub/dist ./dist
COPY --from=builder /app/apps/hub/package.json ./package.json

# Create non-root user for security
RUN groupadd -r metorial && useradd -r -g metorial metorial && \
    chown -R metorial:metorial /app

USER metorial

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
CMD ["sh", "-c", "bun prisma db push --accept-data-loss && bun ./dist/index.js"]
