#!/bin/bash

set -e

echo "Welcome to the Metorial Dev Tools!"

cd ./scripts
source ./init.sh
cd ..


if [ "$1" = "start" ]; then
  bun ./src/cli.ts set-env

  cd ./scripts
  ./dev.sh
  exit 0
fi

if [ "$1" = "stop" ]; then
  cd ./scripts
  ./services.sh stop
  exit 0
fi

bun ./src/cli.ts "$@"