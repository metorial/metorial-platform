FROM oven/bun:1

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
COPY packages ./packages
COPY clients ./clients
COPY apps/hub/package.json ./apps/hub/package.json

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build admin frontend and run in dev mode with hot reloading
CMD ["sh", "-c", "cd apps/hub && bun run admin:build && bun prisma generate && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
