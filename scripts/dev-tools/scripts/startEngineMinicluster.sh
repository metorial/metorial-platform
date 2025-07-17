#!/bin/bash

set -e

echo "Starting a Metorial Engine mini cluster..."

./buildEngine.sh

cd $OSS_DIR/deployment/compose

COMPOSE_PROJECT_NAME="metorial-engine-minicluster"
COMPOSE_FILE="./engine-minicluster.docker-compose.yml"

docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" down

docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up
