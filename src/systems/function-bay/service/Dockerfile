# Build stage - Docker context is the OSS monorepo root (./oss).
FROM oven/bun:1 AS builder

WORKDIR /app

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Install build prerequisites and copy the full OSS workspace.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl postgresql && rm -rf /var/lib/apt/lists/*
COPY . .

RUN sh ./src/systems/function-bay/scripts/prepare-docker-build.sh

WORKDIR /app/src/systems/function-bay/service

RUN bun prisma generate

# Ensure migrations match schema (requires a local shadow DB)
RUN PG_VERSION="$(pg_lsclusters --no-header | awk 'NR==1{print $1}')" && \
    PG_CLUSTER="$(pg_lsclusters --no-header | awk 'NR==1{print $2}')" && \
    pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" start && \
    su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'postgres';\"" && \
    su - postgres -c "createdb db_shadow" && \
    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" \
    SHADOW_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/db_shadow" \
    bun prisma migrate diff --from-migrations ./prisma/migrations --to-schema ./prisma/schema.prisma --exit-code && \
    pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" stop

# Build bundle
RUN bun run server:build

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /app/src/systems/function-bay/service/dist /app/dist
COPY --from=builder /app/src/systems/function-bay/service/prisma /app/prisma
COPY --from=builder /app/src/systems/function-bay/service/prisma.config.ts /app/prisma.config.ts
COPY --from=builder /app/node_modules /app/node_modules

# Expose port
EXPOSE 52030

# Health check using curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:52030/ping && curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "bun prisma db push --accept-data-loss && bun /app/dist/index.js"]
