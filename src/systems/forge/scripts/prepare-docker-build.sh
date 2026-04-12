#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace so Forge resolves local packages via the
# monorepo root instead of relying on package-local node_modules.
bun install --linker=hoisted
