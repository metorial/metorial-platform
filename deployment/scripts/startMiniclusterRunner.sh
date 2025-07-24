#!/bin/bash

set -euo pipefail

NETWORK_NAME="mt-untrusted-net"

if [[ -z "${MANAGER_ADDRESS:-}" ]]; then
  echo "Error: MANAGER_ADDRESS is not set. Please set it before running this script."
  exit 1
fi

if [[ -z "${RUNNER_HOST:-}" ]]; then
  echo "Error: RUNNER_HOST is not set. Please set it before running this script."
  exit 1
fi

if docker network inspect "$NETWORK_NAME" &> /dev/null; then
  echo "Docker network '$NETWORK_NAME' already exists."
else
  ./setupUntrustedNet.sh
  echo "Docker network '$NETWORK_NAME' created successfully."
fi

cd ../compose

COMPOSE_PROJECT_NAME="metorial-engine-minicluster-runner"
COMPOSE_FILE="./engine-minicluster-runner.docker-compose.yml"

docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" down

docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up

