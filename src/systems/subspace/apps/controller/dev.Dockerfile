FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN sh ./src/systems/subspace/scripts/prepare-docker-build.sh

# Run in dev mode with hot reloading
CMD ["sh", "-c", "cd /app/src/systems/subspace/db && bun prisma db push --accept-data-loss && bun prisma generate && cd ../apps/controller && bun start:dev"]