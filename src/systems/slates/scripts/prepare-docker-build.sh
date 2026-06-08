#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace so local Slates packages resolve from the
# monorepo instead of published artifacts.
bun install --linker=hoisted

bunx turbo run --ui=stream build --filter='./src/lowerdeck/packages/**'

bun run --cwd ./src/systems/forge/service db:generate
bun run --cwd ./src/systems/function-bay/service db:generate
bun run --cwd ./src/systems/signal/service db:generate
bun run --cwd ./src/systems/ares/service db:generate
bun run --cwd ./src/systems/nebula/service db:generate

bunx turbo run --ui=stream build --filter=@metorial-platform-systems/ares-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/forge-client
bunx turbo run --ui=stream build --filter=@function-bay/types
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/function-bay-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/signal-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/nebula-client
# bunx turbo run --ui=stream build --filter=@slates/proto
