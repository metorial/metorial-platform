# --------- Builder stage ---------
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache make git

WORKDIR /app

COPY ./src/mcp-engine /app/src/mcp-engine

WORKDIR /app/src/mcp-engine

RUN make build-worker-mcp-runner

# --------- Runner stage ---------
FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache docker-cli

COPY --from=builder /app/src/mcp-engine/bin/worker-mcp-runner .

EXPOSE 50050

CMD ["./worker-mcp-runner"]
