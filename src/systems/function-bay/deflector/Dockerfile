FROM golang:1.23-alpine AS builder

WORKDIR /src
COPY src/systems/function-bay/deflector/go.mod src/systems/function-bay/deflector/go.sum* ./
RUN go mod download

COPY src/systems/function-bay/deflector/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/deflector ./cmd/deflector

FROM alpine:3.22

RUN apk add --no-cache ca-certificates
COPY --from=builder /out/deflector /usr/local/bin/deflector

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/deflector"]
