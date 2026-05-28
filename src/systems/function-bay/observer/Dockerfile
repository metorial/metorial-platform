FROM golang:1.25-alpine AS builder

WORKDIR /src
COPY src/systems/function-bay/observer/go.mod src/systems/function-bay/observer/go.sum* ./
RUN go mod download

COPY src/systems/function-bay/observer/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/observer ./cmd/observer

FROM alpine:3.22

RUN apk add --no-cache ca-certificates
COPY --from=builder /out/observer /usr/local/bin/observer

EXPOSE 52210 52211
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:52210/healthz >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/observer"]
