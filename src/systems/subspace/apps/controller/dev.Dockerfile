FROM oven/bun:1

WORKDIR /app

# Copy the full subspace workspace and inject shared clients from the systems root context.
COPY subspace/. .
COPY _clients/subspace ./clients/subspace
COPY _clients/signal ./clients/signal
COPY _clients/slates-hub ./clients/slates-hub
COPY _clients/shuttle ./clients/shuttle
COPY _clients/origin ./clients/origin

RUN bun install

# Run in dev mode with hot reloading
CMD ["sh", "-c", "cd db && bun prisma db push --accept-data-loss && bun prisma generate && cd ../apps/controller && bun start:dev"]
