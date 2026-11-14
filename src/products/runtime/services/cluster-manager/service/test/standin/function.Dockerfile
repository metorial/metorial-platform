# Stand-in function runtime for the cluster-manager e2e tests. Docker context is ./oss:
#   docker build -f src/products/runtime/services/cluster-manager/service/test/standin/function.Dockerfile -t dev.local/runtime-standin-function:dev .

FROM golang:1.26-alpine AS builder

WORKDIR /src

COPY src/lowerdeck/go/ldrpc/ src/lowerdeck/go/ldrpc/
COPY src/object-storage/clients/go/ src/object-storage/clients/go/
COPY src/products/runtime/go.mod src/products/runtime/go.sum src/products/runtime/

WORKDIR /src/src/products/runtime
RUN --mount=type=cache,target=/root/go/pkg/mod go mod download

COPY src/products/runtime/services/cluster-manager/service/ services/cluster-manager/service/

RUN --mount=type=cache,target=/root/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -o /out/function ./services/cluster-manager/service/test/standin/function

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /out/function /function

USER 65532:65532

ENTRYPOINT ["/function"]
