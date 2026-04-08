#!/bin/bash

set -e

echo "Building VSCode workspace..."

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORKSPACE_DIR="$SCRIPT_DIR/../code-workspace"
TARGET_DIR="$SCRIPT_DIR/pkg/workspace/dist"

# Check if workspace directory exists
if [ ! -d "$WORKSPACE_DIR" ]; then
    echo "Error: Workspace directory not found at $WORKSPACE_DIR"
    exit 1
fi

# Navigate to workspace directory
cd "$WORKSPACE_DIR"

# Check if bun is available, otherwise use npm
if command -v bun &> /dev/null; then
    PKG_MGR="bun"
    BUILD_CMD="bun run frontend:build"
else
    PKG_MGR="npm"
    BUILD_CMD="npm run frontend:build"
fi

echo "Using package manager: $PKG_MGR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing workspace dependencies..."
    $PKG_MGR install
fi

# Build the workspace
echo "Building workspace..."
$BUILD_CMD

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

# Clean target directory (except .gitkeep)
find "$TARGET_DIR" -mindepth 1 ! -name '.gitkeep' -delete

# Copy built files to Go embed directory
echo "Copying built files to $TARGET_DIR..."
cp -r dist/* "$TARGET_DIR/"

echo ""
echo "✓ Workspace build complete!"
echo "  Files are ready for Go embedding at: $TARGET_DIR"
echo ""
echo "To build the Go service:"
echo "  go build -o code-bucket ./cmd/server"
