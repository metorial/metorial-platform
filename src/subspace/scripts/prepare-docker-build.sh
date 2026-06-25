#!/bin/sh
set -eu

cd /app

# Install the monorepo once, then build the workspace packages Subspace consumes
# so Docker builds do not depend on prebuilt artifacts from CI or the host.
bun install --linker=hoisted

bun run --cwd ./src/slates/apps/hub db:generate
bun run --cwd ./src/forge/service db:generate
bun run --cwd ./src/function-bay/service db:generate
bun run --cwd ./src/signal/service db:generate
bun run --cwd ./src/synthesis/service db:generate
bun run --cwd ./src/cargo/service db:generate

bunx turbo run --ui=stream build --filter=@metorial-platform-systems/origin-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/forge-client
bunx turbo run --ui=stream build --filter=@function-bay/types
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/function-bay-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/signal-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/synthesis-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/cargo-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/voyager-client

# bunx turbo run --ui=stream build --filter=./src/slates/packages/**
bunx turbo run --ui=stream build --filter=./src/shuttle/sdk/packages/**

bunx turbo run --ui=stream build --filter=@metorial-platform-systems/slates-client
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/shuttle-client
