FROM oven/bun:1 AS base

# Install curl for health checks
RUN apt-get update && \
    apt-get install -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies stage
FROM base AS deps

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies (production only)
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS builder

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Copy package files
COPY package.json bun.lock* ./

# Install all dependencies (including devDependencies for Prisma generation)
RUN bun install --frozen-lockfile

# Copy Prisma schema
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

# Generate Prisma client
RUN bun prisma generate

# Copy source code
COPY src ./src
COPY tsconfig.json ./tsconfig.json

# Copy admin panel source and build
COPY admin ./admin
RUN bun run admin:build

# Build server bundle
RUN bun run server:build

# Production stage
FROM base AS runner

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy generated Prisma client from builder
COPY --from=builder /app/prisma/generated ./prisma/generated

# Copy Prisma schema (needed for db push)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy built bundle (includes server bundle and admin panel)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create non-root user for security
RUN groupadd -r metorial && useradd -r -g metorial metorial && \
    chown -R metorial:metorial /app

USER metorial

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
CMD ["sh", "-c", "bun prisma db push --accept-data-loss && bun ./dist/index.js"]
