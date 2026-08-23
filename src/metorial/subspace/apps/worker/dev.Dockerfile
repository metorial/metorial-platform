FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

RUN sh ./src/metorial/subspace/scripts/prepare-docker-build.sh

# Run in dev mode with hot reloading.
CMD ["sh", "-c", "cd /app/src/metorial/subspace/apps/worker && bun start:dev"]