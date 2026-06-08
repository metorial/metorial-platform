FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

RUN sh ./src/systems/subspace/scripts/prepare-docker-build.sh

# Run in dev mode with hot reloading
CMD ["sh", "-c", "cd /app/src/systems/subspace/db && bun prisma db push --accept-data-loss && bun prisma generate && cd ../apps/controller && bun start:dev"]