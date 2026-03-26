FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN sh ./src/systems/shuttle/scripts/prepare-docker-build.sh

# Run in dev mode with hot reloading. Reinstall if the mounted node_modules
# volume is empty so local SDK workspace packages resolve during tests.
CMD ["sh", "-c", "cd /app && if [ ! -f /app/node_modules/@metorial/mcp-server/package.json ]; then bun install --linker=hoisted; fi && bunx turbo run --ui=stream build --filter=\"./src/systems/shuttle/sdk/packages/**\" && cd /app/src/systems/shuttle/service && bun prisma generate && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]

