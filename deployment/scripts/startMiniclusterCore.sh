#!/bin/bash

set -euo pipefail

NETWORK_NAME="mt-untrusted-net"

if docker network inspect "$NETWORK_NAME" &> /dev/null; then
  echo "Docker network '$NETWORK_NAME' already exists."
else
  ./setupUntrustedNet.sh
  echo "Docker network '$NETWORK_NAME' created successfully."
fi

cd ../compose

COMPOSE_PROJECT_NAME="metorial-engine-minicluster-core"
COMPOSE_FILE="./engine-minicluster-core.docker-compose.yml"

docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" down

docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up

