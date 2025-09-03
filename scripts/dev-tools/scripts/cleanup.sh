#!/bin/bash

set -e

echo "Cleaning up the repo..."

# To clean up we need to remove the build artifacts and any temporary files created during the build process.
# We remove: 
# - node_modules
# - dist
# - .next
# - .cache
# - .turbo
# - generated
# - out

cd $ROOT_DIR

find . -name "node_modules" -type d -prune -exec rm -rf '{}' + || true
find . -name "dist" -type d -prune -exec rm -rf '{}' + || true
find . -name ".next" -type d -prune -exec rm -rf '{}' + || true
find . -name ".cache" -type d -prune -exec rm -rf '{}' + || true
find . -name ".turbo" -type d -prune -exec rm -rf '{}' + || true
find . -name "generated" -type d -prune -exec rm -rf '{}' + || true
find . -name "out" -type d -prune -exec rm -rf '{}' + || true