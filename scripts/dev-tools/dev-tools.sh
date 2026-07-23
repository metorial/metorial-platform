#!/bin/bash

set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

exec cargo run --quiet --manifest-path "$SCRIPT_DIR/../../src/control/Cargo.toml" -- "$@"
