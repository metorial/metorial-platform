#!/bin/bash

set -e

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT_DIR"

FORCE_SETUP=${FORCE_SETUP:-false}

IS_SETUP=0

if [ -d ./public/vscode ]; then
  IS_SETUP=1
fi

if [ "$IS_SETUP" -gt 0 ] && [ "$FORCE_SETUP" = false ]; then
  echo "VS Code workspace is already set up. Use FORCE_SETUP=true to force re-setup."
  exit 0
fi

echo "Setting up VS Code workspace..."

mkdir -p ./public/extensions/memfs
mkdir -p ./public/vscode

OSS_NODE_MODULES_PATH=$(realpath ../../../../node_modules || echo "")
ENTERPRISE_NODE_MODULES_PATH=$(realpath ../../../../../node_modules || echo "")
ENTERPRISE_NODE_MODULES_PATH_2=$(realpath ../../../../../../node_modules || echo "")

NODE_MODULES_PATH=$OSS_NODE_MODULES_PATH

if [ -d "$ENTERPRISE_NODE_MODULES_PATH" ]; then
  NODE_MODULES_PATH=$ENTERPRISE_NODE_MODULES_PATH
fi

if [ -d "$ENTERPRISE_NODE_MODULES_PATH_2" ]; then
  NODE_MODULES_PATH=$ENTERPRISE_NODE_MODULES_PATH_2
fi

echo "Copying VS Code web files from $NODE_MODULES_PATH/vscode-web/dist to ./public/vscode-web"

cp -r $NODE_MODULES_PATH/vscode-web/dist/** ./public/vscode

# The copied VS Code web bundle includes a package.json with the upstream
# name "Code - OSS". Because this app lives under the OSS npm workspace globs,
# npm tries to treat ./public/vscode as a workspace package and fails on that
# invalid package name during installs. The bundle is served as static assets,
# so we remove npm metadata after copying.
rm -f ./public/vscode/package.json ./public/vscode/package-lock.json

mkdir -p ./public/vscode/vscode-textmate/release
cp $NODE_MODULES_PATH/vscode-textmate/release/main.js ./public/vscode/vscode-textmate/release/

mkdir -p ./public/vscode/vscode-oniguruma/release
cp $NODE_MODULES_PATH/vscode-oniguruma/release/main.js ./public/vscode/vscode-oniguruma/release/
cp $NODE_MODULES_PATH/vscode-oniguruma/release/onig.wasm ./public/vscode/vscode-oniguruma/release/

MEMFS_SOURCE_DIR="$ROOT_DIR/extensions/memfs"
MEMFS_BUILD_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$MEMFS_BUILD_DIR"
}

trap cleanup EXIT

echo "Preparing isolated MemFS build in $MEMFS_BUILD_DIR"

cp "$MEMFS_SOURCE_DIR/package.json" "$MEMFS_BUILD_DIR/package.json"
cp "$MEMFS_SOURCE_DIR/package-lock.json" "$MEMFS_BUILD_DIR/package-lock.json"
cp "$MEMFS_SOURCE_DIR/tsconfig.json" "$MEMFS_BUILD_DIR/tsconfig.json"
cp "$MEMFS_SOURCE_DIR/esbuild.js" "$MEMFS_BUILD_DIR/esbuild.js"
cp "$MEMFS_SOURCE_DIR/eslint.config.mjs" "$MEMFS_BUILD_DIR/eslint.config.mjs"
cp -R "$MEMFS_SOURCE_DIR/src" "$MEMFS_BUILD_DIR/src"

cd "$MEMFS_BUILD_DIR"

echo "Installing MemFS extension dependencies..."
npm i

echo "Building MemFS extension..."
bun run package

cd "$ROOT_DIR"

echo "Copying MemFS extension files to ./public/extensions/memfs"

cp -r "$MEMFS_BUILD_DIR/dist"/** ./public/extensions/memfs
cp "$MEMFS_SOURCE_DIR/package.json" ./public/extensions/memfs/package.json

if [ -f "$MEMFS_SOURCE_DIR/package.nls.json" ]; then
  cp "$MEMFS_SOURCE_DIR/package.nls.json" ./public/extensions/memfs/package.nls.json
fi

cd "$ROOT_DIR"