#!/usr/bin/env bash
# Builds functions in the build-ubuntu image without network access: a dashboard template custom
# provider and a prebuilt slate must build from the preinstalled packages, and a project needing
# other packages must fail with the npm mirror hint.
#   ./smoke-test.sh            builds the image first (via build.sh)
#   ./smoke-test.sh <image>    uses an existing image
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
image="${1:-}"

if [ -z "$image" ]; then
  image="runtime-build-ubuntu:smoke"
  "$here/build.sh" -t "$image"
fi

fixtures="$(mktemp -d)"
trap 'rm -rf "$fixtures"' EXIT
bun "$here/smoke-fixtures.ts" "$fixtures"
chmod -R a+rX "$fixtures"

layer='{"provider":"knative","identifier":"function-bay::layer::knative::smoke","version":"2026-11-01","os":"linux","osIdentifier":"runtime-function-node24","arch":"x86_64"}'

build() {
  docker run --rm --network none \
    -e METORIAL_FUNCTION_BAY_BUILD_LAYER="$layer" \
    -e METORIAL_FUNCTION_BAY_MANIFEST_DESTINATION=/tmp/manifest.json \
    -e METORIAL_FUNCTION_BAY_OUTPUT_DESTINATION=/tmp/output.zip \
    -v "$fixtures/$1:/fixture:ro" \
    "$image" \
    bash -c 'cp -R /fixture/. /workspace/ && function-bay && test -s /tmp/manifest.json && test -s /tmp/output.zip'
}

for fixture in custom-provider prebuilt-slate; do
  echo "==> $fixture"
  log="$(build "$fixture" 2>&1)" || {
    echo "$log"
    echo "FAIL: $fixture did not build offline"
    exit 1
  }
  if ! grep -q 'preinstalled packages, skipping dependency installation' <<<"$log"; then
    echo "$log"
    echo "FAIL: $fixture did not use the preinstalled packages"
    exit 1
  fi
  echo "ok"
done

echo "==> custom-provider-missing-package"
if log="$(build custom-provider-missing-package 2>&1)"; then
  echo "$log"
  echo "FAIL: a project with packages outside the preinstalled set built offline"
  exit 1
fi
if ! grep -q 'These packages are not preinstalled: left-pad' <<<"$log"; then
  echo "$log"
  echo "FAIL: the missing package error does not name left-pad"
  exit 1
fi
echo "ok"
