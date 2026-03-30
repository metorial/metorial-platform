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

cd $OSS_DIR/scripts/dev-tools/scripts

# Build the OSS project
./build-packages.sh