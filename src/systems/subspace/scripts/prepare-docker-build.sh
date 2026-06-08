#!/bin/sh
set -eu

cd /app

# Install the monorepo once, then build the workspace packages Subspace consumes
# so Docker builds do not depend on prebuilt artifacts from CI or the host.
bun install --linker=hoisted

bunx turbo run --ui=stream build --filter='./src/lowerdeck/packages/**'

bun run --cwd ./src/systems/slates/apps/hub db:generate
bun run --cwd ./src/systems/forge/service db:generate
bun run --cwd ./src/systems/function-bay/service db:generate
bun run --cwd ./src/systems/signal/service db:generate
bun run --cwd ./src/systems/synthesis/service db:generate
bun run --cwd ./src/systems/cargo/service db:generate

bunx turbo run --ui=stream build --filter=@metorial-platform-systems/origin-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/forge-client
bunx turbo run --ui=stream build --filter=@function-bay/types
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/function-bay-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/signal-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/synthesis-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/cargo-client

# bunx turbo run --ui=stream build --filter=./src/systems/slates/packages/**
bunx turbo run --ui=stream build --filter=./src/systems/shuttle/sdk/packages/**

bunx turbo run --ui=stream build --filter=@metorial-platform-systems/slates-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/shuttle-client
