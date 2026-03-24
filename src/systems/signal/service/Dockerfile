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

# Ensure migrations match schema (requires a local shadow DB)
RUN apt-get update && \
    apt-get install -y postgresql && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    PG_VERSION="$(pg_lsclusters --no-header | awk 'NR==1{print $1}')" && \
    PG_CLUSTER="$(pg_lsclusters --no-header | awk 'NR==1{print $2}')" && \
    pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" start && \
    su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'postgres';\"" && \
    su - postgres -c "createdb db_shadow" && \
    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" \
    SHADOW_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/db_shadow" \
    bun prisma migrate diff --from-migrations ./prisma/migrations --to-schema ./prisma/schema.prisma --exit-code && \
    pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" stop

# Copy source code
COPY src ./src
COPY tsconfig.json ./tsconfig.json

# Build bundle
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

# Copy built bundle
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create non-root user for security
RUN groupadd -r metorial && useradd -r -g metorial metorial && \
    chown -R metorial:metorial /app

USER metorial

# Expose port
EXPOSE 52030

# Health check using curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:52050/ping && curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "bun prisma db push --accept-data-loss && bun ./dist/index.js"]
