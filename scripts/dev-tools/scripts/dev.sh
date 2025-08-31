#!/bin/bash

set -e

./services.sh start

bun ../src/cli.ts set-env
bun ../src/cli.ts init-minio

go install github.com/air-verse/air@latest

./build.sh

cd $ROOT_DIR

if [ "$IS_ENTERPRISE" = true ]; then
  bun run enterprise:dev
else
  bun run dev
fi

