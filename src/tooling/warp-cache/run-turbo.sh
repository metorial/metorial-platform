#!/bin/sh
set -eu

if [ -f /run/secrets/turbo_token ]; then
  export TURBO_TOKEN="$(cat /run/secrets/turbo_token)"
fi

if [ -f /run/secrets/turbo_signature ]; then
  export TURBO_REMOTE_CACHE_SIGNATURE_KEY="$(cat /run/secrets/turbo_signature)"
fi

exec bunx turbo run "$@" --ui=stream
