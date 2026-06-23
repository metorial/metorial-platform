FROM oven/bun:1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

# Install from the OSS workspace root so workspace dependencies resolve locally.
COPY . .
RUN bun install --linker=hoisted
RUN bunx turbo run --ui=stream build --filter='./src/lowerdeck/packages/**'

WORKDIR /app/src/ares/service

# Run in dev mode with hot reloading
CMD ["sh", "-c", "bun prisma generate && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
