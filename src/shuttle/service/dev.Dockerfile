FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

RUN sh ./src/shuttle/scripts/prepare-docker-build.sh

# Run in dev mode with hot reloading. Reinstall if the mounted node_modules
# volume is empty so local SDK workspace packages resolve during tests.
CMD ["sh", "-c", "cd /app && if [ ! -f /app/node_modules/@metorial/mcp-server/package.json ]; then bun install --linker=hoisted; fi && bunx turbo run --ui=stream build --filter=\"./src/shuttle/sdk/packages/**\" && cd /app/src/shuttle/service && bun prisma generate && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
