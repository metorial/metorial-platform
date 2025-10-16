# --------- Builder stage ---------
FROM golang:1.24-bookworm AS builder

RUN apt update && apt install -y make git curl unzip wget
RUN apt install -y ca-certificates curl
RUN update-ca-certificates

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
FROM debian:bookworm-slim

WORKDIR /app

ADD https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/v0.4.15/grpc_health_probe-linux-amd64 /bin/grpc-health-probe
RUN chmod +x /bin/grpc-health-probe

# RUN apk add --no-cache docker-cli
RUN apt update && apt install -y docker.io openssh-client

COPY --from=builder /app/src/mcp-engine/bin/unified .

EXPOSE 50051

CMD ["./unified"]
