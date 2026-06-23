#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace so local Slates packages resolve from the
# monorepo instead of published artifacts.
bun install --linker=hoisted

bun run --cwd ./src/forge/service db:generate
bun run --cwd ./src/function-bay/service db:generate
bun run --cwd ./src/signal/service db:generate
bun run --cwd ./src/ares/service db:generate
bun run --cwd ./src/nebula/service db:generate

bunx turbo run --ui=stream build --filter=@metorial-platform-systems/ares-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/forge-client
bunx turbo run --ui=stream build --filter=@function-bay/types
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/function-bay-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/signal-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/nebula-client
# bunx turbo run --ui=stream build --filter=@slates/proto
