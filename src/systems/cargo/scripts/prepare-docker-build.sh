#!/bin/sh
set -eu

cd /app

# Install from the OSS workspace and build generated client packages that Cargo
# imports through package exports.
bun install --linker=hoisted

sh ./src/systems/scripts/build-workspace-clients.sh
