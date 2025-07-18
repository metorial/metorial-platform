#!/bin/bash

set -e

echo "Building the Metorial Engine..."

echo "Building Manager..."

cd $OSS_DIR

docker buildx build \
  -t ghcr.io/metorial/metorial-mcp-engine-launcher:latest \
  -f ./deployment/dockerfiles/engine-launcher.Dockerfile \
  .

docker buildx build \
  -t ghcr.io/metorial/metorial-mcp-engine-manager:latest \
  -f ./deployment/dockerfiles/engine-manager.Dockerfile \
  .

docker buildx build \
  -t ghcr.io/metorial/metorial-mcp-engine-remote:latest \
  -f ./deployment/dockerfiles/engine-remote.Dockerfile \
  .

docker buildx build \
  -t ghcr.io/metorial/metorial-mcp-engine-runner:latest \
  -f ./deployment/dockerfiles/engine-runner.Dockerfile \
  .
