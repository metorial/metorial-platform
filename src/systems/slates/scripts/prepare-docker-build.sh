#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace so local Slates packages resolve from the
# monorepo instead of published artifacts.
bun install --linker=hoisted

bunx turbo run --ui=stream build --filter=./src/systems/slates/packages/**
