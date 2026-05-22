#!/bin/sh
set -eu

ROOT="$(cd "$(dirname "$0")/../apps" && pwd)"
WORKSPACE="$ROOT/code-workspace"
TARGET="$ROOT/code-bucket/pkg/workspace/dist"

cd "$WORKSPACE"

if [ ! -d node_modules ]; then
  bun install
fi

bun x tsc
bun x vite build

rm -rf "$TARGET"
mkdir -p "$(dirname "$TARGET")"
cp -R dist "$TARGET"
