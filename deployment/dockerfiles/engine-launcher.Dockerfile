# --------- Builder stage ---------
FROM golang:1.24-bookworm AS builder

WORKDIR /app

COPY ./src/mcp-engine/go.mod /app/src/mcp-engine/go.mod
COPY ./src/mcp-engine/go.sum /app/src/mcp-engine/go.sum

WORKDIR /app/src/mcp-engine

RUN go mod download

COPY ./src/mcp-engine /app/src/mcp-engine

RUN make build-worker-launcher

RUN apt update && apt install -y make git curl unzip wget
RUN apt install -y ca-certificates curl
RUN update-ca-certificates

RUN wget https://github.com/denoland/deno/releases/download/v2.4.2/deno-x86_64-unknown-linux-gnu.zip  
RUN unzip deno-x86_64-unknown-linux-gnu.zip -d /app
RUN chmod +x /app/deno

# --------- Runner stage ---------
FROM debian:bookworm-slim

WORKDIR /app

# Copy gRPC health probe
ADD https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/v0.4.15/grpc_health_probe-linux-amd64 /bin/grpc-health-probe
RUN chmod +x /bin/grpc-health-probe

# Copy built binary
COPY --from=builder /app/src/mcp-engine/bin/worker-launcher .
COPY --from=builder /app/deno /usr/local/bin/deno

EXPOSE 50052

CMD ["./worker-launcher"]
