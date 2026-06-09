FROM oven/bun:1

WORKDIR /app

# Copy OSS workspace files
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies and build workspace clients used at runtime
RUN sh ./src/systems/cargo/scripts/prepare-docker-build.sh

WORKDIR /app/src/systems/cargo/service

# Run in dev mode with hot reloading
CMD ["sh", "-c", "bun prisma generate --schema ../db/prisma/schema --config ../db/prisma.config.ts && bun prisma db push --accept-data-loss --schema ../db/prisma/schema --config ../db/prisma.config.ts && bun --watch src/server.ts"]
