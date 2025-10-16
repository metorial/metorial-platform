# --------- Builder stage ---------
FROM golang:1.24-bookworm AS builder

WORKDIR /app

RUN apt update && apt install -y make git curl unzip wget
RUN apt install -y ca-certificates curl
RUN update-ca-certificates

RUN wget https://github.com/denoland/deno/releases/download/v2.4.2/deno-x86_64-unknown-linux-gnu.zip  
RUN unzip deno-x86_64-unknown-linux-gnu.zip -d /app
RUN chmod +x /app/deno

COPY ./src/services/deno-runner /app/src/services/deno-runner

WORKDIR /app/src/services/deno-runner

RUN go mod download

RUN go build -o bin/deno-runner cmd/main.go

# --------- Runner stage ---------
FROM debian:bookworm-slim

WORKDIR /app

# Copy built binary
COPY --from=builder /app/src/services/deno-runner/bin/deno-runner .
COPY --from=builder /app/deno /usr/local/bin/deno

RUN useradd -m -u 1001 mt-user

# Create deployments directory with proper permissions
RUN mkdir -p /app/deployments && chown -R mt-user:mt-user /app/deployments

USER mt-user

EXPOSE 52000

ENV PORT=52000
ENV DEPLOY_DIR=/app/deployments

CMD ["./deno-runner"]