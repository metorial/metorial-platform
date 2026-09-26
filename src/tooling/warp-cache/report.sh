#!/bin/sh
set -eu

if [ -z "${TURBO_API:-}" ] || [ -z "${TURBO_TOKEN:-}" ]; then
  echo "Warp Cache: disabled" >> "$GITHUB_STEP_SUMMARY"
  exit 0
fi

stats="$(bun -e '
  let url = new URL("/v8/artifacts/status", process.env.TURBO_API);
  url.searchParams.set("teamId", process.env.TURBO_TEAM);
  url.searchParams.set("stats", "1");
  try {
    let result = await fetch(url, {
      headers: { authorization: `Bearer ${process.env.TURBO_TOKEN}` },
      signal: AbortSignal.timeout(5000)
    });
    if (result.ok) console.log(JSON.stringify(await result.json()));
    else console.error(`Warp Cache statistics returned HTTP ${result.status}`);
  } catch {
    console.error("Warp Cache statistics are unavailable");
  }
')"
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
