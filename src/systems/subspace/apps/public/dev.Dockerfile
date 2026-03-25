FROM oven/bun:1

WORKDIR /app

# Copy repository contents from the OSS root context
COPY . .

RUN bun install --linker=hoisted

# Build frontend
RUN cd /app/src/systems/subspace/apps/public && bun run build

# Run in dev mode with hot reloading.
# `subspace-controller` performs schema/client initialization before this service starts.
CMD ["sh", "-c", "cd /app/src/systems/subspace/apps/public && bun run start:dev"]