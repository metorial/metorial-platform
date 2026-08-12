FROM oven/bun:1 AS builder

WORKDIR /app
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*
RUN sh ./src/metorial/subspace/scripts/prepare-docker-build.sh
RUN bun run --cwd ./src/metorial-frontend/packages/ui build

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

WORKDIR /app/src/metorial/subspace/apps/public
RUN bun run frontend:build
RUN rm -rf frontend/src frontend/tsconfig.* frontend/vite.config.ts frontend/index.html
RUN bun run server:build

FROM oven/bun:1-alpine AS production

WORKDIR /app
RUN apk add --no-cache curl

COPY --from=builder /app/src/metorial/subspace/apps/public/dist /app/dist
COPY --from=builder /app/src/metorial/subspace/apps/public/frontend/dist /app/frontend/dist
COPY --from=builder /app/node_modules /app/node_modules

ENV NODE_ENV=production
EXPOSE 52071

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:52071/ping || exit 1

CMD ["bun", "dist/index.js"]
