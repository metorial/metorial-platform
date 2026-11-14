#!/usr/bin/env bash
# Builds the build-ubuntu image from the OSS monorepo root. Extra arguments go to docker build.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
oss="$(cd "$here/../../../../../../.." && pwd)"

docker build -f "$here/Dockerfile" "$@" "$oss"
