FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN sh ./src/systems/shuttle/scripts/prepare-docker-build.sh

# Run in dev mode with hot reloading
CMD ["sh", "-c", "cd /app/src/systems/shuttle/service && bun prisma generate && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
