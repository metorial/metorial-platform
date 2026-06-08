#!/bin/sh
set -eu

cd /app

# Install the monorepo once so Docker builds do not depend on host node_modules.
bun install --linker=hoisted

bunx turbo run --ui=stream build --filter='./src/lowerdeck/packages/**'
