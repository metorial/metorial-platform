#!/bin/bash

set -e

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT_DIR"

FORCE_SETUP=${FORCE_SETUP:-false}

OSS_NODE_MODULES_PATH=$(realpath ../../../../../../../node_modules || echo "")
ENTERPRISE_NODE_MODULES_PATH=$(realpath ../../../../../../../../node_modules || echo "")

NODE_MODULES_PATH=$OSS_NODE_MODULES_PATH

if [ -d "$ENTERPRISE_NODE_MODULES_PATH" ]; then
  NODE_MODULES_PATH=$ENTERPRISE_NODE_MODULES_PATH
fi

STAMP_FILE=./public/vscode/.setup-stamp

compute_stamp() {
  {
    cat ./setup.sh
    for module in vscode-web vscode-textmate vscode-oniguruma; do
      echo "$module $(cat "$NODE_MODULES_PATH/$module/package.json" 2>/dev/null | grep -m1 '"version"')"
    done
    find ./extensions/memfs -type f -not -path '*/node_modules/*' -not -path '*/dist/*' | LC_ALL=C sort | while read -r file; do
      echo "$file"
      cat "$file"
    done
  } | shasum -a 256 | cut -d' ' -f1
}

STAMP=$(compute_stamp)

if [ -d ./public/vscode ] && [ "$FORCE_SETUP" = false ] && [ "$(cat "$STAMP_FILE" 2>/dev/null)" = "$STAMP" ]; then
  echo "VS Code workspace is already set up. Use FORCE_SETUP=true to force re-setup."
  exit 0
fi

echo "Setting up VS Code workspace..."

rm -rf ./public/vscode
mkdir -p ./public/extensions/memfs
mkdir -p ./public/vscode

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

echo "$STAMP" > "$STAMP_FILE"
