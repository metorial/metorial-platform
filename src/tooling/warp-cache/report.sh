#!/bin/sh
set -eu

if [ -z "${TURBO_API:-}" ] || [ -z "${TURBO_TOKEN:-}" ]; then
  echo "Warp Cache: disabled" >> "$GITHUB_STEP_SUMMARY"
  exit 0
fi

stats="$(curl --fail --silent --show-error -H "authorization: Bearer $TURBO_TOKEN" "$TURBO_API/artifacts/stats" || true)"
if [ -n "$stats" ]; then
  echo "## Warp Cache" >> "$GITHUB_STEP_SUMMARY"
  echo '```json' >> "$GITHUB_STEP_SUMMARY"
  echo "$stats" >> "$GITHUB_STEP_SUMMARY"
  echo '```' >> "$GITHUB_STEP_SUMMARY"
fi

if [ -n "${RUNNER_TEMP:-}" ] && [ -f "$RUNNER_TEMP/warp-cache.log" ]; then
  echo "## Warp Cache Server" >> "$GITHUB_STEP_SUMMARY"
  echo '```text' >> "$GITHUB_STEP_SUMMARY"
  tail -100 "$RUNNER_TEMP/warp-cache.log" >> "$GITHUB_STEP_SUMMARY"
  echo '```' >> "$GITHUB_STEP_SUMMARY"
fi
