#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace so Shuttle resolves the local SDK packages
# before the service bundle is built.
bun install --linker=hoisted
