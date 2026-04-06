# Multi-stage build for Code Bucket service with embedded VSCode workspace.
# Docker context is the OSS monorepo root (./oss).

# Stage 1: Build VSCode workspace
FROM oven/bun:1.2-alpine AS workspace-builder

WORKDIR /workspace

COPY src/systems/origin/apps/code-workspace/package.json ./
RUN bun install

COPY src/systems/origin/apps/code-workspace/ ./

RUN mkdir -p ./public/vscode && \
    mkdir -p ./public/extensions/memfs && \
    cp -r node_modules/vscode-web/dist/* ./public/vscode/ && \
    mkdir -p ./public/vscode/vscode-textmate/release && \
    cp node_modules/vscode-textmate/release/main.js ./public/vscode/vscode-textmate/release/ && \
    mkdir -p ./public/vscode/vscode-oniguruma/release && \
    cp node_modules/vscode-oniguruma/release/main.js ./public/vscode/vscode-oniguruma/release/ && \
    cp node_modules/vscode-oniguruma/release/onig.wasm ./public/vscode/vscode-oniguruma/release/

RUN cd extensions/memfs && \
    bun install && \
    bun run package && \
    cd ../.. && \
    cp -r extensions/memfs/dist/* ./public/extensions/memfs/ && \
    cp extensions/memfs/package.json ./public/extensions/memfs/package.json && \
    cp extensions/memfs/package.nls.json ./public/extensions/memfs/package.nls.json

RUN bun x tsc && bun x vite build

# Stage 2: Build Go service
FROM golang:1.24-alpine AS go-builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY src/systems/origin/apps/code-bucket/go.mod src/systems/origin/apps/code-bucket/go.sum ./
RUN go mod download

COPY src/systems/origin/apps/code-bucket/ ./

COPY --from=workspace-builder /workspace/dist ./pkg/workspace/dist

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o code-bucket ./cmd/server

# Stage 3: Final minimal image
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

COPY --from=go-builder /app/code-bucket .

EXPOSE 52091
EXPOSE 52092
EXPOSE 5050

CMD ["./code-bucket"]
