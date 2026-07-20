#!/usr/bin/env bash

set -euo pipefail

workspace="${CONTROL_WORKSPACE_PATH:-/workspace}"

enter_workspace() {
  cd "${workspace}"
  git config --global --add safe.directory "${workspace}" >/dev/null 2>&1 || true
  git config --global --add safe.directory "${workspace}/oss" >/dev/null 2>&1 || true
}

control_manifest() {
  if [[ -f "${workspace}/oss/src/control/Cargo.toml" ]]; then
    printf '%s\n' "${workspace}/oss/src/control/Cargo.toml"
  elif [[ -f "${workspace}/src/control/Cargo.toml" ]]; then
    printf '%s\n' "${workspace}/src/control/Cargo.toml"
  else
    echo "Could not find the Control Cargo.toml in ${workspace}" >&2
    return 1
  fi
}

setup_workspace() {
  local version="${1:?setup version is required}"
  local marker="/control-state/bootstrap-v1"
  if [[ -f "${marker}" ]] && [[ "$(cat "${marker}")" == "${version}" ]]; then
    echo "Workspace setup is already current"
    return
  fi

  enter_workspace
  echo "Installing container dependencies"
  bun install --verbose
  echo "Building workspace packages"
  bun run build
  local manifest
  manifest="$(control_manifest)"
  echo "Building Control"
  cargo build --manifest-path "${manifest}"
  echo "Running Control prepare tasks"
  cargo run --quiet --manifest-path "${manifest}" -- prepare --no-docker
  printf '%s\n' "${version}" >"${marker}"
  echo "Workspace setup complete"
}

if [[ "${1:-}" == "setup" ]]; then
  shift
  setup_workspace "$@"
  exit 0
fi

if [[ -d "${workspace}" ]]; then
  enter_workspace
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

exec "$@"
