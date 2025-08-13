#!/bin/bash

set -e

cd $OSS_DIR

echo "Running client build..."

if [ "$1" = "dashboard" ]; then
  bun run client:generate:dashboard
else
  bun run client:generate
fi
