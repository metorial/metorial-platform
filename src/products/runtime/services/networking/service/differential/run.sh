#!/usr/bin/env bash
# Differential test (PLAN 8.6): historical Lambda proxy wrappers against the legacy deflector and
# the egress gateway. Needs docker, go, node and git. Writes report.md/report.json and service logs
# to $OUT_DIR (default ./out). Exits 1 on any difference not listed as intended.
#
#   DEFLECTOR_REF  git ref of oss to build the deflector from (default HEAD)
#   WRAPPER_REFS   space-separated oss commits to extract wrappers from

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
oss="$(git -C "$here" rev-parse --show-toplevel)"
runtime="$oss/src/products/runtime"
out="${OUT_DIR:-$here/out}"
deflector_ref="${DEFLECTOR_REF:-HEAD}"
wrapper_refs=(${WRAPPER_REFS:-369f368225 d63e2266cf 603da9ce54 218c231dd2 31c02010bd f6cd38540b HEAD})

id="egress-diff-$$"
work="$(mktemp -d)"
arch="$(docker version --format '{{.Server.Arch}}')"
image="metorial-egress-differential:dev"
pg_password="$(od -An -tx1 -N16 /dev/urandom | tr -d ' \n')"

cleanup() {
  docker rm -f "$id-pg" >/dev/null 2>&1 || true
  docker network rm "$id" >/dev/null 2>&1 || true
  chmod -R u+w "$work" 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

mkdir -p "$work/bin" "$work/deflector" "$out"

echo "building egress-gateway and network-logs for linux/$arch" >&2
(
  cd "$runtime"
  CGO_ENABLED=0 GOOS=linux GOARCH="$arch" go build -o "$work/bin/egress-gateway" ./services/networking/service/cmd/gateway
  CGO_ENABLED=0 GOOS=linux GOARCH="$arch" go build -o "$work/bin/network-logs" ./services/networking/service/cmd/logstore
)

deflector_path=""
for candidate in src/function-bay/deflector src/systems/function-bay/deflector; do
  if git -C "$oss" cat-file -e "$deflector_ref:$candidate/go.mod" 2>/dev/null; then
    deflector_path="$candidate"
    break
  fi
done
if [ -z "$deflector_path" ]; then
  echo "no deflector at $deflector_ref" >&2
  exit 2
fi

echo "building deflector from $deflector_ref:$deflector_path" >&2
git -C "$oss" archive "$deflector_ref" "$deflector_path" | tar -x -C "$work/deflector"
(
  cd "$work/deflector/$deflector_path"
  CGO_ENABLED=0 GOOS=linux GOARCH="$arch" GOWORK=off go build -o "$work/bin/deflector" ./cmd/deflector
)

node "$here/extract-wrappers.mjs" "$oss" "$work/wrappers" "${wrapper_refs[@]}"

docker build --quiet -t "$image" "$here" >/dev/null

docker network create "$id" >/dev/null
docker run -d --rm --name "$id-pg" --network "$id" -e POSTGRES_PASSWORD="$pg_password" postgres:17 >/dev/null
until docker exec "$id-pg" pg_isready -U postgres -q 2>/dev/null; do sleep 0.5; done

chmod -R a+rX "$work"
set +e
docker run --rm --name "$id-harness" --network "$id" --cap-add NET_ADMIN \
  -e DATABASE_HOST="$id-pg" -e DATABASE_PASSWORD="$pg_password" \
  -v "$work:/input:ro" -v "$out:/out" \
  "$image"
status=$?
set -e

echo "report: $out/report.md" >&2
exit "$status"
