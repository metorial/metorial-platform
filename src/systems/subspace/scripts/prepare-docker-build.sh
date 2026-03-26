#!/bin/sh
set -eu

cd /app

# Install the monorepo once, then build the workspace packages Subspace consumes
# so Docker builds do not depend on prebuilt artifacts from CI or the host.
bun install --linker=hoisted

bun run --cwd ./src/systems/slates/apps/hub db:generate

bunx turbo run --ui=stream build \
  --filter=./src/systems/slates/packages/** \
  --filter=./src/systems/shuttle/sdk/packages/** \
  --filter=@metorial-platform-systems/slates-client \
  --filter=@metorial-platform-systems/shuttle-client
