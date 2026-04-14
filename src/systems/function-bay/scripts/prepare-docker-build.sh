#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace so function-bay resolves local workspace
# packages before the service bundle is built.
bun install --linker=hoisted

bunx turbo run --ui=stream build --filter=./src/systems/function-bay/packages/**
