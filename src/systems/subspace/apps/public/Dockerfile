# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

# Install CA certificates for Sentry CLI uploads and prepare required workspaces.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN sh ./src/systems/subspace/scripts/prepare-docker-build.sh
RUN bun run --cwd ./src/packages/frontend/ui build

# Generate Prisma client
WORKDIR /app/src/systems/subspace/db
RUN bunx prisma generate

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Build the application using ncc
# This bundles all dependencies into a single file
WORKDIR /app/src/systems/subspace/apps/public
RUN bun run frontend:build
# Remove frontend source (not needed for backend bundle, only dist is needed at runtime)
RUN rm -rf frontend/src frontend/tsconfig.* frontend/vite.config.ts frontend/index.html
# Temporarily use the build-friendly tsconfig
RUN mv tsconfig.json tsconfig.json.bak && \
  mv tsconfig.build.json tsconfig.json && \
  bun run server:build; \
  BUILD_EXIT_CODE=$?; \
  mv tsconfig.json tsconfig.build.json && \
  mv tsconfig.json.bak tsconfig.json; \
  exit $BUILD_EXIT_CODE

FROM builder AS workspace
WORKDIR /app/src/systems/subspace/apps/public
CMD ["sleep", "infinity"]

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy the built application from builder
COPY --from=builder /app/src/systems/subspace/apps/public/dist /app/dist

# Copy the frontend dist directory
COPY --from=builder /app/src/systems/subspace/apps/public/frontend/dist /app/frontend/dist

# Copy prisma schema and generated client from builder
COPY --from=builder /app/src/systems/subspace/db /app/db

# Copy the built @metorial/ui workspace package so Bun workspace links remain valid.
COPY --from=builder /app/src/packages/frontend/ui /app/src/packages/frontend/ui

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
