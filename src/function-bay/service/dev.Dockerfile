FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

RUN sh ./src/function-bay/scripts/prepare-docker-build.sh

RUN --mount=type=secret,id=turbo_token,required=false --mount=type=secret,id=turbo_signature,required=false sh /app/src/tooling/warp-cache/run-turbo.sh prisma:generate server:build --filter=@metorial/function-bay

# Run in dev mode with hot reloading
CMD ["sh", "-c", "cd /app/src/function-bay/service && bun prisma generate && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
