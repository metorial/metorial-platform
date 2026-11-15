#!/bin/bash

set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

exec bun "$SCRIPT_DIR/../../src/tooling/control/src/main.ts" "$@"
