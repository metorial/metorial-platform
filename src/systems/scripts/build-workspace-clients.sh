#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
OSS_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)"

cd "$OSS_ROOT"

# Build platform system clients consumed across services. These packages have no
# generated-service dependencies and are safe to build in any CI/Docker step.
bunx turbo run --ui=stream build \
  --filter=@metorial-platform-systems/object-storage-client \
  --filter=@metorial-platform-systems/voyager-client \
  --filter=@metorial-platform-systems/relay-client
