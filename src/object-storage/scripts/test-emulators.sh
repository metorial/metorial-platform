#!/usr/bin/env bash
# Runs the backend conformance suite against SeaweedFS (S3), Azurite and fake-gcs-server in docker.
set -euo pipefail

cd "$(dirname "$0")/.."

S3_PORT=${OBJECT_STORE_TEST_S3_PORT:-19100}
AZURE_PORT=${OBJECT_STORE_TEST_AZURE_PORT:-19110}
GCS_PORT=${OBJECT_STORE_TEST_GCS_PORT:-19120}

WORK_DIR=$(mktemp -d)
CONTAINERS=(os-test-s3 os-test-azurite os-test-gcs)

cleanup() {
  docker rm -f "${CONTAINERS[@]}" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT
cleanup_containers() { docker rm -f "${CONTAINERS[@]}" >/dev/null 2>&1 || true; }
cleanup_containers

AZURE_ACCOUNT=devstoreaccount1
AZURE_KEY='Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=='

docker run -d --name os-test-s3 -p "$S3_PORT:8333" \
  chrislusf/seaweedfs server -s3 -dir=/data >/dev/null

docker run -d --name os-test-azurite -p "$AZURE_PORT:10000" \
  mcr.microsoft.com/azure-storage/azurite \
  azurite-blob --blobHost 0.0.0.0 --skipApiVersionCheck --loose >/dev/null

docker run -d --name os-test-gcs -p "$GCS_PORT:4443" \
  fsouza/fake-gcs-server -scheme http -port 4443 \
  -public-host "127.0.0.1:$GCS_PORT" -external-url "http://127.0.0.1:$GCS_PORT" >/dev/null

openssl genrsa -out "$WORK_DIR/key.pem" 2048 2>/dev/null
openssl pkcs8 -topk8 -nocrypt -in "$WORK_DIR/key.pem" -out "$WORK_DIR/key-pkcs8.pem"
python3 - "$WORK_DIR" <<'PY'
import json, sys
d = sys.argv[1]
json.dump({
  "type": "service_account",
  "project_id": "test",
  "private_key_id": "test",
  "private_key": open(f"{d}/key-pkcs8.pem").read(),
  "client_email": "test@test.iam.gserviceaccount.com",
  "client_id": "1",
  "token_uri": "http://127.0.0.1:1/token",
}, open(f"{d}/gcs-credentials.json", "w"))
PY

wait_for() {
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null "$1"; then return 0; fi
    sleep 1
  done
  echo "timed out waiting for $1" >&2
  exit 1
}

wait_for "http://127.0.0.1:$S3_PORT/"
wait_for "http://127.0.0.1:$AZURE_PORT/"
wait_for "http://127.0.0.1:$GCS_PORT/storage/v1/b"

for _ in $(seq 1 30); do
  if curl -sf -X PUT "http://127.0.0.1:$S3_PORT/conformance" >/dev/null; then break; fi
  sleep 1
done

curl -s -X POST "http://127.0.0.1:$GCS_PORT/storage/v1/b?project=test" \
  -H 'Content-Type: application/json' -d '{"name":"conformance"}' >/dev/null

CONNECTION_STRING="DefaultEndpointsProtocol=http;AccountName=$AZURE_ACCOUNT;AccountKey=$AZURE_KEY;BlobEndpoint=http://127.0.0.1:$AZURE_PORT/$AZURE_ACCOUNT;"
python3 - "$AZURE_PORT" "$AZURE_ACCOUNT" "$AZURE_KEY" <<'PY'
import base64, datetime, hashlib, hmac, sys, urllib.request
port, account, key = sys.argv[1:4]
date = datetime.datetime.now(datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
version = "2021-08-06"
resource = f"/{account}/{account}/conformance"
to_sign = f"PUT\n\n\n\n\n\n\n\n\n\n\n\nx-ms-date:{date}\nx-ms-version:{version}\n{resource}\nrestype:container"
signature = base64.b64encode(hmac.new(base64.b64decode(key), to_sign.encode(), hashlib.sha256).digest()).decode()
req = urllib.request.Request(
  f"http://127.0.0.1:{port}/{account}/conformance?restype=container",
  method="PUT",
  headers={"x-ms-date": date, "x-ms-version": version, "Authorization": f"SharedKey {account}:{signature}", "Content-Length": "0"},
)
try:
  urllib.request.urlopen(req)
except urllib.error.HTTPError as e:
  if e.code != 409:
    raise
PY

export OBJECT_STORE_TEST_S3_ENDPOINT="http://127.0.0.1:$S3_PORT"
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export OBJECT_STORE_TEST_AZURE_CONNECTION_STRING="$CONNECTION_STRING"
export OBJECT_STORE_TEST_GCS_ENDPOINT="http://127.0.0.1:$GCS_PORT"
export OBJECT_STORE_TEST_GCS_CREDENTIALS="$WORK_DIR/gcs-credentials.json"

cargo test -p object-store-backends --test conformance -- --nocapture "$@"
