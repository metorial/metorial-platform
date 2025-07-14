#!/bin/bash

set -e

./services.sh start

./build.sh

cd $ROOT_DIR

if [ "$IS_ENTERPRISE" = true ]; then
  bun run enterprise:dev
else
  bun run dev
fi

