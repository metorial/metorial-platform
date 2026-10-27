#!/bin/bash

set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

exec bun "$SCRIPT_DIR/../../src/control/src/main.ts" "$@"
