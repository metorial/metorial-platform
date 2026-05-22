#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace so local Signal packages resolve from the
# monorepo instead of published artifacts.
bun install --linker=hoisted

sh ./src/systems/scripts/build-workspace-clients.sh
