#!/bin/bash

set -e

ENGINE_DIR=$OSS_DIR/src/mcp-engine

source ./dbInit.sh

# Prisma reset
cd $ROOT_DIR
echo "Running Prisma reset..."
bun prisma:push -- --force-reset --skip-generate
echo "Prisma reset completed."
