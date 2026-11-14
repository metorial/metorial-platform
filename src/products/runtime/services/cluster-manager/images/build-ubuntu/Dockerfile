# runtime-build-ubuntu. Docker context is the OSS monorepo root (./oss):
#   docker build -f src/products/runtime/services/cluster-manager/images/build-ubuntu/Dockerfile -t runtime-build-ubuntu .
# The function-bay CLI and @function-bay/nodejs are bundled from this checkout.

ARG NODE_IMAGE=node:24-bookworm-slim
ARG BUN_IMAGE=oven/bun:1.4.2

FROM ${NODE_IMAGE} AS node
FROM ${BUN_IMAGE} AS bun

FROM ${BUN_IMAGE} AS tooling
WORKDIR /app

FROM tooling AS pruner
COPY . .
RUN bun ./src/tooling/docker-build/prune.ts build --filter=function-bay --filter=@function-bay/nodejs

FROM scratch AS pruned
COPY --from=pruner /app/out/ /

FROM tooling AS function-bay
COPY --from=pruned /json/ ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --linker=hoisted
ARG TURBO_API
ARG TURBO_TEAM
ENV TURBO_API=${TURBO_API}
ENV TURBO_TEAM=${TURBO_TEAM}
COPY --from=pruned /full/ ./
RUN --mount=type=secret,id=turbo_token,required=false --mount=type=secret,id=turbo_signature,required=false sh ./src/tooling/warp-cache/run-turbo.sh build --filter=function-bay --filter=@function-bay/nodejs
RUN packages=src/products/runtime/services/functions/packages \
    && bun build $packages/cli/src/index.ts --target=bun --outfile=/out/cli/index.js \
    && bun build $packages/builder-node/src/index.ts --target=bun --outfile=/out/nodejs/index.js \
    && bun -e "let p = d => require('./' + d + '/package.json').version; console.log(JSON.stringify({ 'function-bay': p('$packages/cli'), '@function-bay/nodejs': p('$packages/builder-node') }))" > /out/versions.json \
    && bun -e "import { functionBayNodeBuildToolchain as t } from './$packages/builder-node/src/buildToolchain.ts'; console.log(Object.values(t).join(' '))" > /out/toolchain.txt

FROM ubuntu:24.04

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      bash ca-certificates curl git unzip zip xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    && userdel -r ubuntu 2>/dev/null || true

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \
    && ln -s bun /usr/local/bin/bunx \
    && groupadd --gid 65532 build \
    && useradd --uid 65532 --gid 65532 --create-home --home-dir /home/build --shell /bin/bash build \
    && mkdir -p /var/run/metorial/build /var/run/metorial/identity /var/run/metorial/trust /workspace \
    && chown 65532:65532 /workspace

COPY --from=function-bay /out/ /opt/function-bay/
RUN chmod -R a=rX /opt/function-bay \
    && printf '#!/bin/sh\nexec bun /opt/function-bay/cli/index.js "$@"\n' > /usr/local/bin/function-bay \
    && chmod 0555 /usr/local/bin/function-bay

USER 65532:65532

ENV HOME=/home/build \
    BUN_INSTALL=/home/build/.bun \
    PATH=/home/build/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    METORIAL_FUNCTION_BAY_BUILDER_PATH=/opt/function-bay/nodejs/index.js

# The builder installs its toolchain with `bun i -g` on every build; preinstalling the pinned
# versions fills bun's cache so that step works without registry access.
RUN bun i -g $(cat /opt/function-bay/toolchain.txt)

WORKDIR /workspace

CMD ["bash", "/var/run/metorial/build/script.sh"]
