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

COMPOSE_PROJECT_NAME="metorial-engine-minicluster"
COMPOSE_FILE="./engine-minicluster.docker-compose.yml"

# If TS_AUTHKEY is set, use the tailscale compose file
if [[ -n "${TS_AUTHKEY:-}" ]]; then
  COMPOSE_FILE="./engine-minicluster-tailscale.docker-compose.yml"
  COMPOSE_PROJECT_NAME="metorial-engine-minicluster-tailscale"
fi

docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" down

docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up
