#!/bin/sh
set -eu

cd /app

# Install the monorepo once, then build the workspace packages Subspace consumes
# so Docker builds do not depend on prebuilt artifacts from CI or the host.
bun install --linker=hoisted
