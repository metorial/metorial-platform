ARG PACKAGE_NAME=@metorial/app-api
ARG PACKAGE_DIRECTORY=src/backend/apps/api

FROM oven/bun:1.2.20-debian AS bun_base

# ------------------------
# BUILDER
# ------------------------
FROM bun_base AS builder

ARG PACKAGE_NAME
ARG PACKAGE_DIRECTORY
ARG METORIAL_ENV

ENV METORIAL_ENV=production

WORKDIR /app

COPY /clients/metorial-dashboard ./clients/metorial-dashboard
COPY /src/backend ./src/backend
COPY /src/packages ./src/packages
COPY /src/mcp-engine ./src/mcp-engine
COPY /src/services ./src/services

COPY /package.json ./package.json
COPY /turbo.json ./turbo.json
COPY /bun.lock ./bun.lock

ENV NODE_OPTIONS=--max_old_space_size=6144

RUN bun install

RUN apt-get update && apt-get install -y ca-certificates

# RUN bun turbo run build --filter=./oss/src/packages/** --concurrency=1 --ui=stream
RUN bun turbo run prisma:generate --concurrency=1 --log-prefix=task
RUN bun turbo run oss:server:build --filter=${PACKAGE_NAME} --concurrency=1 --log-prefix=task

# ------------------------
# Installer
# ------------------------
FROM bun_base AS installer

ARG PACKAGE_NAME
ARG PACKAGE_DIRECTORY

WORKDIR /app

COPY /deployment/skeleton .

# Copy the required prisma schema files
# The migrations of these files will be applied by the runner
COPY "/src/backend/db/prisma" ./prisma/oss

RUN bun install

COPY --from=builder "/app/${PACKAGE_DIRECTORY}/dist" ./dist

# ------------------------
# RUNNER
# ------------------------
FROM bun_base AS runner

WORKDIR /app

ARG PACKAGE_DIRECTORY
ARG PACKAGE_NAME

ENV NODE_ENV=production
ENV TZ=UTC
ENV PACKAGE_DIRECTORY=${PACKAGE_DIRECTORY}
ENV PACKAGE_NAME=${PACKAGE_NAME}

ENV PORT=3000
EXPOSE 3000

# # Download doppler
# RUN apt-get update && apt-get install -y apt-transport-https ca-certificates curl gnupg && \
#   curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg && \
#   echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" | tee /etc/apt/sources.list.d/doppler-cli.list && \
#   apt-get update && \
#   apt-get -y install doppler

COPY --from=installer /app .

# Force prisma to prepare the prisma core binary
RUN apt-get update && apt-get install -y curl wget

RUN bunx prisma generate --schema prisma/oss/schema

# Copy the ".so.node" files from prisma/generated to the dist folder
RUN cp -r prisma/oss/generated/*.wasm dist/
RUN cp -r prisma/oss/generated/*.wasm ./
RUN mkdir -p ./prisma/generated
RUN cp -r prisma/oss/generated/*.wasm ./prisma/generated/
RUN cp -r prisma/oss/generated/*.wasm ./prisma/

# RUN chmod +x ./entrypoint-global-services.sh
# ENTRYPOINT ["./entrypoint-global-services.sh"]

# CMD ["sh", "-c", "doppler run -- bun run migrate && doppler run -- bun run start"]

CMD ["sh", "-c", "bun run migrate && bun run start"]
