#!/bin/sh
set -eu

# Build the object storage client used across platform services. This package has
# no generated-service dependencies and is safe to build in any CI/Docker step.
bunx turbo run --ui=stream build --filter=@metorial-platform-systems/object-storage-client
