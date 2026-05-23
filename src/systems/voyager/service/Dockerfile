# Build stage
FROM oven/bun:1.2 AS builder

WORKDIR /app

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN sh ./src/systems/voyager/scripts/prepare-docker-build.sh

WORKDIR /app/src/systems/voyager/service
RUN bun prisma generate
RUN bun run server:build

FROM builder AS workspace

WORKDIR /app/src/systems/voyager/service
CMD ["sleep", "infinity"]

# Production stage
FROM oven/bun:1.2-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /app/src/systems/voyager/service/dist /app/dist
COPY --from=builder /app/src/systems/voyager/service/prisma /app/prisma
COPY --from=builder /app/src/systems/voyager/service/prisma.config.ts /app/prisma.config.ts
COPY --from=builder /app/node_modules /app/node_modules

EXPOSE 52060

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:52060/metorial-voyager && curl -f http://localhost:12121/ || exit 1

CMD ["sh", "-c", "bun prisma db push --accept-data-loss && bun /app/dist/index.js"]
