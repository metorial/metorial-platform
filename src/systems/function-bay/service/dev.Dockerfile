FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

RUN sh ./src/systems/function-bay/scripts/prepare-docker-build.sh

# Run in dev mode with hot reloading
CMD ["sh", "-c", "cd /app/src/systems/function-bay/service && bun prisma generate && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
