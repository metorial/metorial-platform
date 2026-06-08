FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

RUN sh ./src/systems/slates/scripts/prepare-docker-build.sh

# Build admin frontend
RUN cd /app/src/systems/slates/apps/registry && bun run admin:build

# Generate Prisma client
RUN cd /app/src/systems/slates/apps/registry && bun prisma generate

# Expose port
EXPOSE 51001

# Run server with hot reloading
CMD ["sh", "-c", "cd /app/src/systems/slates/apps/registry && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
