#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace so function-bay resolves local workspace
# packages before the service bundle is built.
bun install --linker=hoisted

bunx turbo run --ui=stream build --filter='./src/lowerdeck/packages/**'

bun run --cwd ./src/systems/forge/service db:generate
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/forge-client
bun run --cwd ./src/systems/function-bay/service db:generate
bunx turbo run --ui=stream build --filter=@function-bay/types
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/function-bay-client
bunx turbo run --ui=stream build --filter=./src/systems/function-bay/packages/**