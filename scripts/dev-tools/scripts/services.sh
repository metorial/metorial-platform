#!/bin/bash

set -e

cd ..

# Configuration
COMPOSE_PROJECT_NAME="dev_services"
COMPOSE_FILE="./services.docker-compose.yml"
VOLUME_DIR="./_volumes"
CHECK_TIMEOUT=20

# Make sure volume directory exists (only needed for start)
ensure_volume_dir() {
  mkdir -p "$VOLUME_DIR"
}

# Start services
start_services() {
  echo "Starting services for project '$COMPOSE_PROJECT_NAME'..."

  ensure_volume_dir

  if docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" ps --services --filter "status=running" | grep -q .; then
    echo "Services already running."
  else
    docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up -d
  fi

  echo "Waiting for services to become available..."

  wait_for_port 127.0.0.1 32379 "etcd"
  wait_for_port 127.0.0.1 32707 "MongoDB"
  wait_for_port 127.0.0.1 36379 "Redis"
  wait_for_port 127.0.0.1 37700 "MeiliSearch"
  wait_for_port 127.0.0.1 35432 "Postgres"

  echo "All checks completed."
}

# Stop services
stop_services() {
  echo "Stopping services for project '$COMPOSE_PROJECT_NAME'..."
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" down
  echo "Services stopped."
}

# Helper: wait for a service to be available on a port
wait_for_port() {
  local host=$1
  local port=$2
  local name=$3

  echo -n "Checking $name on $host:$port "

  for ((i=0; i<$CHECK_TIMEOUT; i++)); do
    if nc -z "$host" "$port" >/dev/null 2>&1; then
      echo "✅"
      return 0
    fi
    echo -n "."
    sleep 1
  done

  echo "❌"
  return 1
}

# Command handler
COMMAND=${1:-start}

case "$COMMAND" in
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  *)
    echo "Usage: $0 [start|stop]"
    exit 1
    ;;
esac

cd ./scripts