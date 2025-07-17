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

if [ "$1" = "reset" ]; then
  cd ./scripts
  ./dbReset.sh
  exit 0
fi

if [ "$1" = "migrate" ]; then
  cd ./scripts
  ./migrate.sh "$2"
  exit 0
fi

if [ "$1" = "build" ]; then
  cd ./scripts
  
  if [ "$2" = "server" ]; then
    ./buildServer.sh
  else
    echo "Unknown build target: $2"
    exit 1
  fi
fi


buildServer

bun ./src/cli.ts "$@"
