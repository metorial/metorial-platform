FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

RUN sh ./src/metorial/subspace/scripts/prepare-docker-build.sh

# Build frontend
RUN cd /app/src/metorial/subspace/apps/public && bun run build

# Run in dev mode with hot reloading.
# `subspace-controller` performs schema/client initialization before this service starts.
CMD ["sh", "-c", "cd /app/src/metorial/subspace/apps/public && bun run start:dev"]