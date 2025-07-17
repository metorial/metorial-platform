# --------- Builder stage ---------
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache make git

WORKDIR /app

COPY ./src/mcp-engine/go.mod /app/src/mcp-engine/go.mod
COPY ./src/mcp-engine/go.sum /app/src/mcp-engine/go.sum

WORKDIR /app/src/mcp-engine

RUN go mod download

COPY ./src/mcp-engine /app/src/mcp-engine

RUN make build-unified

# --------- Runner stage ---------
FROM alpine:latest

WORKDIR /app

ADD https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/v0.4.15/grpc_health_probe-linux-amd64 /bin/grpc-health-probe
RUN chmod +x /bin/grpc-health-probe

RUN curl -fsSL https://deno.land/install.sh | sh
RUN apk add --no-cache docker-cli

COPY --from=builder /app/src/mcp-engine/bin/unified .

EXPOSE 50050

CMD ["./unified"]
