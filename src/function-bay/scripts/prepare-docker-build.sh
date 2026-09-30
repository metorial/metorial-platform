#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace so function-bay resolves local workspace
# packages before the service bundle is built.
bun install --linker=hoisted
