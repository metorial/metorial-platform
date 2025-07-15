#!/bin/bash

set -e

# If is enterprise
if [ "$IS_ENTERPRISE" = true ]; then
  cd $ROOT_DIR

  docker buildx build \
    -t metorial/metorial-enterprise:latest \
    -f ./deployment/metorial-enterprise-core.Dockerfile \
    .
else
  echo "Building OSS project is coming soon."
  exit 1
fi