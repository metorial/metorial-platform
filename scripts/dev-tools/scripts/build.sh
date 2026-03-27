#!/bin/bash

set -e

source ./dbInit.sh

# Prisma generate
cd $ROOT_DIR
echo "Running Prisma generate..."
bun prisma:generate
echo "Running Prisma push..."
bun prisma:push
echo "Prisma generate and push completed."

# Build the OSS project
cd $ROOT_DIR
echo "Building OSS packages..."
if [ "$IS_ENTERPRISE" = true ]; then
  bunx turbo run --ui=stream build --filter='./oss/**' --filter='!./oss/src/systems/**'
  bunx turbo run --ui=stream build --filter='./oss/src/systems/_clients/**'
  bunx turbo run --ui=stream build --filter='./oss/src/systems/shuttle/sdk/packages/**'
  bunx turbo run --ui=stream build --filter='./oss/src/systems/slates/packages/**'
  bunx turbo run --ui=stream frontend:build --filter='./systems/horizon/apps/horizon/**'
  # bunx turbo run --ui=stream frontend:build --filter='./systems/horizon/apps/horizon'
  bunx turbo run --ui=stream frontend:build --filter='./oss/src/systems/subspace/apps/dev'
else
  bun run build
fi
echo "OSS packages built."
