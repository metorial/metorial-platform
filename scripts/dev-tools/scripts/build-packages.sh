#!/bin/bash

set -e

# Build the OSS packages
cd $ROOT_DIR
echo "Building OSS packages..."
if [ "$IS_ENTERPRISE" = true ]; then
  bunx turbo run --ui=stream build --filter='./oss/**' \
    --filter='!./oss/src/ares/**' \
    --filter='!./oss/src/cargo/**' \
    --filter='!./oss/src/forge/**' \
    --filter='!./oss/src/function-bay/**' \
    --filter='!./oss/src/nebula/**' \
    --filter='!./oss/src/origin/**' \
    --filter='!./oss/src/shuttle/**' \
    --filter='!./oss/src/signal/**' \
    --filter='!./oss/src/slates/**' \
    --filter='!./oss/src/subspace/**' \
    --filter='!./oss/src/synthesis/**'
  bunx turbo run --ui=stream build --filter='./oss/src/*/clients/**' --force
  bunx turbo run --ui=stream build --filter='./oss/src/shuttle/sdk/packages/**'
  bunx turbo run --ui=stream build --filter='./oss/src/function-bay/packages/**'
  bunx turbo run --ui=stream frontend:build --filter='./oss/src/ares/service'
  bunx turbo run --ui=stream build --filter='./systems/horizon/clients/**'
  bunx turbo run --ui=stream frontend:build --filter='./systems/horizon/apps/horizon/**'
  bunx turbo run --ui=stream frontend:build --filter='./oss/src/subspace/apps/dev'
else
  bun run build
fi

echo "OSS packages built."
