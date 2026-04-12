FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
COPY packages ./packages
COPY clients ./clients
COPY service/package.json ./service/package.json

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build workspace packages needed at runtime
RUN bun run --cwd packages/types build

# Run in dev mode with hot reloading
CMD ["sh", "-c", "cd service && bun prisma generate && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
