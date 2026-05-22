FROM oven/bun:1

WORKDIR /app

COPY . .

RUN sh ./src/systems/origin/scripts/prepare-docker-build.sh

WORKDIR /app/src/systems/origin/apps/service

RUN mkdir -p ./node_modules/@metorial/code-bucket-service-generated && \
  cp ../code-bucket/package.json ../code-bucket/index.ts ./node_modules/@metorial/code-bucket-service-generated/ && \
  cp -r ../code-bucket/ts-proto-gen ./node_modules/@metorial/code-bucket-service-generated/ts-proto-gen

CMD ["sh", "-c", "bunx prisma generate && bun prisma db push --accept-data-loss && bun --watch src/server.ts"]
