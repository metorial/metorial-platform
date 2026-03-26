#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace so Shuttle resolves the local SDK packages
# before the service bundle is built.
bun install --linker=hoisted

bunx turbo run --ui=stream build --filter=./src/systems/shuttle/sdk/packages/**
