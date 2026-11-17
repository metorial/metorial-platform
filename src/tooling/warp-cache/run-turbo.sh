#!/bin/sh
set -eu

if [ -f /run/secrets/turbo_token ]; then
  export TURBO_TOKEN="$(cat /run/secrets/turbo_token)"
fi

if [ -f /run/secrets/turbo_signature ]; then
  export TURBO_REMOTE_CACHE_SIGNATURE_KEY="$(cat /run/secrets/turbo_signature)"
fi

# Turbo does not hash the CPU architecture, so without this an arm64 build could restore
# amd64 outputs from the shared remote cache. uname reports the container's architecture.
export METORIAL_BUILD_ARCH="$(uname -m)"

exec bunx turbo run "$@" --ui=stream
