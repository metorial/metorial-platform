# runtime-function-node24. Docker context is the OSS monorepo root (./oss):
#   docker build -f src/products/runtime/services/cluster-manager/images/function-node24/Dockerfile -t runtime-function-node24 .

FROM golang:1.26-alpine AS supervisor

WORKDIR /src

COPY src/lowerdeck/go/ldrpc/ src/lowerdeck/go/ldrpc/
COPY src/object-storage/clients/go/ src/object-storage/clients/go/
COPY src/products/runtime/go.mod src/products/runtime/go.sum src/products/runtime/

WORKDIR /src/src/products/runtime
RUN --mount=type=cache,target=/root/go/pkg/mod go mod download

COPY src/products/runtime/packages/egress/ packages/egress/
COPY src/products/runtime/services/cluster-manager/service/rpc/functionruntimerpc/ services/cluster-manager/service/rpc/functionruntimerpc/
COPY src/products/runtime/services/cluster-manager/supervisor/ services/cluster-manager/supervisor/

ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/root/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/supervisor ./services/cluster-manager/supervisor/cmd/supervisor

FROM oven/bun:1 AS bootstrap

WORKDIR /src
COPY src/products/runtime/services/functions/packages/runtime-node/package.json ./
COPY src/products/runtime/services/functions/packages/runtime-node/src/ src/
RUN bun build src/bootstrap.ts --target=node --format=cjs --outfile=/out/bootstrap.cjs

FROM node:24-bookworm-slim

RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    && userdel -r node \
    && mkdir -p /var/runtime/bundle /var/run/metorial/identity /var/run/metorial/trust \
    && chown 65532:65532 /var/runtime/bundle

COPY --from=supervisor --chmod=0555 /out/supervisor /opt/runtime/supervisor
COPY --from=bootstrap --chmod=0444 /out/bootstrap.cjs /opt/runtime/bootstrap.cjs

ENV HOME=/tmp \
    TMPDIR=/tmp \
    NODE_ENV=production

WORKDIR /var/runtime/bundle

EXPOSE 8080

USER 65532:65532

ENTRYPOINT ["/opt/runtime/supervisor"]
