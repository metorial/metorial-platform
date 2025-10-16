# --------- Builder stage ---------
FROM golang:1.24-bookworm AS builder

WORKDIR /app

RUN apt update && apt install -y make git curl unzip wget
RUN apt install -y ca-certificates curl
RUN update-ca-certificates

RUN wget https://github.com/denoland/deno/releases/download/v2.4.2/deno-x86_64-unknown-linux-gnu.zip  
RUN unzip deno-x86_64-unknown-linux-gnu.zip -d /app
RUN chmod +x /app/deno

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

COPY --from=builder /app/src/mcp-engine/bin/unified .
COPY --from=builder /app/deno /usr/local/bin/deno

RUN apt update && apt install -y docker.io openssh-client

COPY --from=builder /app/src/mcp-engine/bin/unified .

EXPOSE 50050

CMD ["./unified"]
