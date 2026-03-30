#!/bin/bash

set -e

# Build the OSS packages
cd $ROOT_DIR
echo "Building OSS packages..."
if [ "$IS_ENTERPRISE" = true ]; then
  bunx turbo run --ui=stream build --filter='./oss/**' --filter='!./oss/src/systems/**'
  bunx turbo run --ui=stream build --filter='./oss/src/systems/_clients/**'
  bunx turbo run --ui=stream build --filter='./oss/src/systems/shuttle/sdk/packages/**'
  bunx turbo run --ui=stream build --filter='./oss/src/systems/slates/packages/**'
  bunx turbo run --ui=stream build:client --filter='./systems/horizon/ares/clients/**'
  bunx turbo run --ui=stream build --filter='./systems/horizon/clients/**'
  bunx turbo run --ui=stream frontend:build --filter='./systems/horizon/apps/horizon/**'
  bunx turbo run --ui=stream frontend:build --filter='./oss/src/systems/subspace/apps/dev'
else
  bun run build
fi

echo "OSS packages built."
