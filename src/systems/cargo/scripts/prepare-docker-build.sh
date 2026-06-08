#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace and build generated client packages that Cargo
# imports through package exports.
bun install --linker=hoisted

bunx turbo run --ui=stream build --filter='./src/lowerdeck/packages/**'

bunx turbo run --ui=stream build --filter=@metorial-platform-systems/origin-client
