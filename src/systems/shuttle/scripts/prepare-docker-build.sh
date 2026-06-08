#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace so Shuttle resolves the local SDK packages
# before the service bundle is built.
bun install --linker=hoisted

bun run --cwd ./src/systems/forge/service db:generate
bun run --cwd ./src/systems/function-bay/service db:generate

bunx turbo run --ui=stream build --filter=@metorial-platform-systems/forge-client
bunx turbo run --ui=stream build --filter=@function-bay/types
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/function-bay-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/nebula-client
bunx turbo run --ui=stream build --filter=@metorial/mcp-server