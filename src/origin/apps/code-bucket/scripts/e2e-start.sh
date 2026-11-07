#!/bin/sh
set -e

mkdir -p pkg/workspace/dist
[ -e pkg/workspace/dist/index.html ] || echo "e2e" > pkg/workspace/dist/index.html

go build -o bin/e2e-server ./cmd/server
exec ./bin/e2e-server
