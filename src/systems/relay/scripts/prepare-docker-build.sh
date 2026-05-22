#!/bin/sh
set -eu

cd /app

bun install --linker=hoisted

sh ./src/systems/scripts/build-workspace-clients.sh
