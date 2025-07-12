#!/bin/bash

set -e

ARGS="$@"
PIDS=()

# Trap SIGINT (Ctrl+C) to clean up background processes
cleanup() {
    echo "Caught SIGINT, terminating processes..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" || true
    done
    wait
    exit 0
}

trap cleanup SIGINT

# Function to run a target and prefix its output
run_with_prefix() {
    local name="$1"
    shift
    (
        stdbuf -oL -eL "$@" 2>&1 | sed "s/^/[$name] /"
    ) &
    PIDS+=($!)
}

echo "Starting all components with ARGS: $ARGS"

run_with_prefix "worker-mcp-runner" make run-worker-mcp-runner ARGS="$ARGS"
run_with_prefix "worker-mcp-remote" make run-worker-mcp-remote ARGS="$ARGS"
run_with_prefix "worker-launcher" make run-worker-launcher ARGS="$ARGS"

wait
