#!/bin/bash

set -e

source ./dbInit.sh

# Prisma reset
cd $ROOT_DIR
echo "Running Prisma reset..."
bun prisma:push -- --force-reset
echo "Prisma reset completed."
