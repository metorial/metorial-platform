# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

# Install CA certificates and native build tools before preparing required workspaces.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*
RUN sh ./src/metorial/subspace/scripts/prepare-docker-build.sh
RUN bun run --cwd ./src/metorial-frontend/packages/ui build

# Generate both Prisma clients used by the merged service graph
WORKDIR /app/src/metorial/db
RUN bun run prisma:generate

WORKDIR /app/src/metorial/subspace/db
RUN bun run prisma:generate

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Build the application using ncc
# This bundles all dependencies into a single file
WORKDIR /app/src/metorial/subspace/apps/public
RUN bun run frontend:build
# Remove frontend source (not needed for backend bundle, only dist is needed at runtime)
RUN rm -rf frontend/src frontend/tsconfig.* frontend/vite.config.ts frontend/index.html
RUN bun run server:build

# Production stage
FROM oven/bun:1-alpine AS production

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy the built application from builder
COPY --from=builder /app/src/metorial/subspace/apps/public/dist /app/dist

# Copy the frontend dist directory
COPY --from=builder /app/src/metorial/subspace/apps/public/frontend/dist /app/frontend/dist

# Copy prisma schema and generated client from builder
COPY --from=builder /app/src/metorial/subspace/db /app/db

# Copy the built @metorial/ui workspace package so Bun workspace links remain valid.
COPY --from=builder /app/src/metorial-frontend/packages/ui /app/src/metorial-frontend/packages/ui

# Copy entire node_modules from builder to ensure prisma has all dependencies
COPY --from=builder /app/node_modules /app/node_modules

# Set environment to production
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 52071

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:52071/ping && curl -f http://localhost:12121/ || exit 1

# Start command: push schema and start service
CMD ["sh", "-c", "cd db && bun prisma db push --accept-data-loss && cd /app && bun dist/index.js"]
