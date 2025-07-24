#!/bin/bash

set -e

ENGINE_DIR=$OSS_DIR/src/mcp-engine

source ./dbInit.sh

# Prisma generate
cd $ROOT_DIR
echo "Running Prisma generate..."
bun prisma:generate
echo "Running Prisma push..."
bun prisma:push -- --skip-generate
echo "Prisma generate and push completed."

# Build the OSS project
cd $ROOT_DIR
echo "Building OSS packages..."
bun run build
echo "OSS packages built."
