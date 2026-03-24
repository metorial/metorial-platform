FROM oven/bun:1

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace files from the shared systems root context.
COPY slates/package.json slates/bun.lock* ./
COPY slates/packages ./packages
COPY slates/clients ./clients
COPY _clients/signal ./clients/signal
COPY _clients/slates-hub ./clients/hub
COPY slates/apps/hub/package.json ./apps/hub/package.json

# Install dependencies
RUN bun install

# Copy source code
COPY slates/. .

# Build admin frontend and run in dev mode with hot reloading
CMD ["sh", "-c", "cd apps/hub && bun run admin:build && bun prisma generate && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
