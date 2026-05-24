#!/bin/bash

set -e

# Build the OSS packages
cd $ROOT_DIR
echo "Building OSS packages..."
if [ "$IS_ENTERPRISE" = true ]; then
  bun x nx run-many --target=build --all
  bun x nx run @metorial/ares:frontend:build
  bun x nx run-many --target=frontend:build --projects=@metorial/horizon,@metorial/subspace-dev
else
  bun run build
fi

echo "OSS packages built."
