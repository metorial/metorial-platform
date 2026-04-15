#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace so function-bay resolves local workspace
# packages before the service bundle is built.
bun install --linker=hoisted

bun run --cwd ./src/systems/forge/service db:generate
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/forge-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/function-bay-client
bunx turbo run --ui=stream build --filter=./src/systems/function-bay/packages/**