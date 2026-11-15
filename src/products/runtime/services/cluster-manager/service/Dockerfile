# runtime-cluster-manager. Docker context is the OSS monorepo root (./oss):
#   docker build -f src/products/runtime/services/cluster-manager/service/Dockerfile -t runtime-cluster-manager .

FROM golang:1.26-alpine AS builder

WORKDIR /src

COPY src/lib/rpc/go/ src/lib/rpc/go/
COPY src/object-storage/clients/go/ src/object-storage/clients/go/
COPY src/products/runtime/go.mod src/products/runtime/go.sum src/products/runtime/

WORKDIR /src/src/products/runtime
RUN --mount=type=cache,target=/root/go/pkg/mod go mod download

COPY src/products/runtime/services/cluster-manager/service/ services/cluster-manager/service/

ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/root/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/cluster-manager ./services/cluster-manager/service/cmd/cluster-manager

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /out/cluster-manager /cluster-manager

EXPOSE 52240 52241 9090

USER 65532:65532

ENTRYPOINT ["/cluster-manager"]
