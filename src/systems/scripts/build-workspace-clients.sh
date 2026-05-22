#!/bin/sh
set -eu

# Build generated workspace clients so services can resolve package exports
# without depending on prebuilt artifacts from CI or the host.
bunx turbo run --ui=stream build --filter=./src/systems/_clients/**
