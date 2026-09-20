FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*

RUN sh ./src/slates/scripts/prepare-docker-build.sh

RUN --mount=type=secret,id=turbo_token,required=false --mount=type=secret,id=turbo_signature,required=false sh /app/src/tooling/warp-cache/run-turbo.sh prisma:generate admin:build server:build --filter=@metorial/slates-registry

# Build admin frontend
RUN cd /app/src/slates/apps/registry && bun run admin:build

# Generate Prisma client
RUN cd /app/src/slates/apps/registry && bun prisma generate

# Expose port
EXPOSE 51001

# Run server with hot reloading
CMD ["sh", "-c", "cd /app/src/slates/apps/registry && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
