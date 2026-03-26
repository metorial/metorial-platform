FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN sh ./src/systems/slates/scripts/prepare-docker-build.sh

# Build admin frontend and run in dev mode with hot reloading
CMD ["sh", "-c", "cd /app/src/systems/slates/apps/hub && bun run admin:build && bun prisma generate && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
