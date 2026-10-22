#!/usr/bin/env bash

set -euo pipefail

# The gateway owns the network namespace shared by the runner and every app container. It forwards
# the fixed Control development ports on localhost to the e2e infrastructure containers, so the
# `localhost:<port>` values Control resolves for development work unchanged.
forward_port() {
  local listen_port="$1"
  local target="$2"
  socat \
    "TCP4-LISTEN:${listen_port},bind=127.0.0.1,fork,reuseaddr" \
    "TCP4:${target}" \
    >"/tmp/control-e2e-forward-${listen_port}.log" 2>&1 &
}

case "${1:-}" in
  gateway)
    forward_port 35432 postgres-db2:5432
    forward_port 32707 mongodb:27017
    forward_port 36379 redis-db:6379
    forward_port 34222 nats-1:4222
    touch /tmp/control-e2e-gateway-ready
    trap 'exit 0' TERM INT
    sleep infinity &
    wait
    ;;
  run)
    shift
    exec bun /e2e/runner.ts "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
