# Stand-in build image for the cluster-manager e2e tests: bash and curl, like build-ubuntu.
#   docker build -f src/products/runtime/services/cluster-manager/service/test/standin/build.Dockerfile -t dev.local/runtime-standin-build:dev .

FROM alpine:3.22

RUN apk add --no-cache bash curl coreutils
