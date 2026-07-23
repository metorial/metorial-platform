#!/bin/bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
case "${1:-start}" in
  start)
    shift || true
    exec bun --cwd "$ROOT_DIR" control prepare "$@"
    ;;
  stop)
    shift || true
    exec bun --cwd "$ROOT_DIR" control docker stop "$@"
    ;;
  *)
    echo "Usage: $0 [start|stop] [control selectors...]" >&2
    exit 1
    ;;
esac
