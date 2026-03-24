FROM oven/bun:1

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build admin frontend
RUN bun run admin:build

# Generate Prisma client
RUN bun prisma generate

# Expose port
EXPOSE 51001

# Run server with hot reloading
CMD ["sh", "-c", "bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
