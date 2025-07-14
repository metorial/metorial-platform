# --------- Builder stage ---------
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache make git

WORKDIR /app

COPY ./src/mcp-engine /app/src/mcp-engine

WORKDIR /app/src/mcp-engine

RUN make build-worker-launcher

# --------- Runner stage ---------
FROM alpine:latest

WORKDIR /app

RUN curl -fsSL https://deno.land/install.sh | sh

COPY --from=builder /app/src/mcp-engine/bin/worker-launcher .

EXPOSE 50050

CMD ["./worker-launcher"]
