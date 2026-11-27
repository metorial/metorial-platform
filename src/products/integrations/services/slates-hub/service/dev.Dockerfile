FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

RUN bun install --linker=hoisted

RUN --mount=type=secret,id=turbo_token,required=false --mount=type=secret,id=turbo_signature,required=false sh /app/src/tooling/warp-cache/run-turbo.sh prisma:generate admin:build server:build --filter=@metorial/slates --filter=@mtsrc/slates-hub-db

# Build admin frontend and run in dev mode with hot reloading
CMD ["sh", "-c", "cd /app/src/products/integrations/services/slates-hub/service && bun run admin:build && bun --cwd ../db run prisma:generate && bun --cwd ../db run prisma:push && bun --watch src/server.ts"]
