FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN sh ./src/systems/subspace/scripts/prepare-docker-build.sh

# Run in dev mode with hot reloading.
# `subspace-controller` performs schema/client initialization before this service starts.
CMD ["sh", "-c", "cd /app/src/systems/subspace/apps/worker && bun start:dev"]