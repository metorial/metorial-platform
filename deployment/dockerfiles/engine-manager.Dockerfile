# --------- Builder stage ---------
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache make git

WORKDIR /app

COPY ./src/mcp-engine /app/src/mcp-engine

WORKDIR /app/src/mcp-engine

RUN make build-manager

# --------- Runner stage ---------
FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/src/mcp-engine/bin/manager .

EXPOSE 50050

CMD ["./manager"]
