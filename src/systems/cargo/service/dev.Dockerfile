FROM oven/bun:1

WORKDIR /app

# Copy OSS workspace files
COPY . .

# Install dependencies
RUN bun install --linker=hoisted

WORKDIR /app/src/systems/cargo/service

# Run in dev mode with hot reloading
CMD ["sh", "-c", "bun --cwd ../db run prisma:generate && bun --cwd ../db run prisma:push && bun --watch src/server.ts"]
