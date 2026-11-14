# runtime-network-logs. Docker context is the OSS monorepo root (./oss):
#   docker build -f src/products/runtime/services/networking/service/logstore.Dockerfile -t runtime-network-logs .

FROM golang:1.26-alpine AS builder

WORKDIR /src

COPY src/lowerdeck/go/ldrpc/ src/lowerdeck/go/ldrpc/
COPY src/object-storage/clients/go/ src/object-storage/clients/go/
COPY src/products/runtime/go.mod src/products/runtime/go.sum src/products/runtime/

WORKDIR /src/src/products/runtime
RUN --mount=type=cache,target=/root/go/pkg/mod go mod download

COPY src/products/runtime/packages/egress/ packages/egress/
COPY src/products/runtime/services/networking/service/ services/networking/service/

ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/root/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/network-logs ./services/networking/service/cmd/logstore

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /out/network-logs /network-logs

EXPOSE 52250 52210 52211

USER 65532:65532

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD ["/network-logs", "healthcheck"]

ENTRYPOINT ["/network-logs"]
