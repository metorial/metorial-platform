#!/bin/bash

set -e

ROOT_DIR=$(pwd)

FORCE_SETUP=${FORCE_SETUP:-false}

IS_SETUP=$(find ./public/vscode -maxdepth 0 -type d | wc -l)

if [ "$IS_SETUP" -gt 0 ] && [ "$FORCE_SETUP" = false ]; then
  echo "VS Code workspace is already set up. Use FORCE_SETUP=true to force re-setup."
  exit 0
fi

echo "Setting up VS Code workspace..."

mkdir -p ./public/extensions/memfs
mkdir -p ./public/vscode

OSS_NODE_MODULES_PATH=$(realpath ../../../../node_modules || echo "")
ENTERPRISE_NODE_MODULES_PATH=$(realpath ../../../../../node_modules || echo "")

NODE_MODULES_PATH=$OSS_NODE_MODULES_PATH

if [ -d "$ENTERPRISE_NODE_MODULES_PATH" ]; then
  NODE_MODULES_PATH=$ENTERPRISE_NODE_MODULES_PATH
fi

echo "Copying VS Code web files from $NODE_MODULES_PATH/vscode-web/dist to ./public/vscode-web"

cp -r $NODE_MODULES_PATH/vscode-web/dist/** ./public/vscode

mkdir -p ./public/vscode/vscode-textmate/release
cp $NODE_MODULES_PATH/vscode-textmate/release/main.js ./public/vscode/vscode-textmate/release/

mkdir -p ./public/vscode/vscode-oniguruma/release
cp $NODE_MODULES_PATH/vscode-oniguruma/release/main.js ./public/vscode/vscode-oniguruma/release/
cp $NODE_MODULES_PATH/vscode-oniguruma/release/onig.wasm ./public/vscode/vscode-oniguruma/release/


cd extensions/memfs

echo "Installing MemFS extension dependencies..."
npm i

echo "Building MemFS extension..."
npm run package

cd ../../

echo "Copying MemFS extension files to ./public/extensions/memfs"

cp -r extensions/memfs/dist/** ./public/extensions/memfs
cp extensions/memfs/package.json ./public/extensions/memfs/package.json
cp extensions/memfs/package.nls.json ./public/extensions/memfs/package.nls.json

cd $ROOT_DIR