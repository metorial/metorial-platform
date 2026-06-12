#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace and build generated client packages that
# Synthesis imports through package exports before ncc bundles the service.
bun install --linker=hoisted

bun run --cwd ./src/systems/subspace/db prisma:generate

bunx turbo run --ui=stream build --filter=@metorial-platform-systems/subspace-client
