#!/bin/bash

set -e

cd $OSS_DIR

echo "Running client build..."

bun client:generate

echo "Building client packages..."
