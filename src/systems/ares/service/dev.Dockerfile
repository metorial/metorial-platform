FROM oven/bun:1

WORKDIR /app/service

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Run in dev mode with hot reloading
CMD ["sh", "-c", "bun prisma generate && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
