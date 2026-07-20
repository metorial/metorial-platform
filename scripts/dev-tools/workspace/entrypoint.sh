#!/usr/bin/env bash

set -euo pipefail

workspace="${CONTROL_WORKSPACE_PATH:-/workspace}"

if [[ -d "${workspace}" ]]; then
  cd "${workspace}"
  git config --global --add safe.directory "${workspace}" >/dev/null 2>&1 || true
  git config --global --add safe.directory "${workspace}/oss" >/dev/null 2>&1 || true
fi

forward_port() {
  local listen_port="$1"
  local target="$2"
  local target_host="${target%:*}"
  local target_port="${target##*:}"

  socat \
    "TCP4-LISTEN:${listen_port},bind=127.0.0.1,fork,reuseaddr" \
    "TCP4:${target_host}:${target_port}" \
    >"/tmp/control-forward-${listen_port}.log" 2>&1 &
}

if [[ -n "${CONTROL_SERVICE_POSTGRES:-}" ]]; then
  forward_port 35432 "${CONTROL_SERVICE_POSTGRES}"
fi
if [[ -n "${CONTROL_SERVICE_MONGO:-}" ]]; then
  forward_port 32707 "${CONTROL_SERVICE_MONGO}"
fi
if [[ -n "${CONTROL_SERVICE_REDIS:-}" ]]; then
  forward_port 36379 "${CONTROL_SERVICE_REDIS}"
fi
if [[ -n "${CONTROL_SERVICE_NATS:-}" ]]; then
  forward_port 34222 "${CONTROL_SERVICE_NATS}"
fi
if [[ -n "${CONTROL_SERVICE_ETCD:-}" ]]; then
  forward_port 32379 "${CONTROL_SERVICE_ETCD}"
  forward_port 32380 "${CONTROL_SERVICE_ETCD%:*}:2380"
fi

if [[ "$#" -eq 0 ]]; then
  set -- sleep infinity
fi

if [[ "$1" == "dev" ]]; then
  bun install
  exec cargo run --quiet --manifest-path ./oss/src/control/Cargo.toml -- "$@"
fi

exec "$@"
