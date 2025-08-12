# --------- Builder stage ---------
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache make git

WORKDIR /app

COPY ./src/mcp-engine /app/src/mcp-engine
COPY ./src/modules /app/src/modules
COPY ./src/services /app/src/services
COPY ./go.work /app/go.work
COPY ./go.work.sum /app/go.work.sum

WORKDIR /app/src/mcp-engine

RUN go mod download

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
