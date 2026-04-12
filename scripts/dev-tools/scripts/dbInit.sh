#!/bin/bash

set -e

DB_PREFIX="metorial-$METORIAL_SOURCE"

export DB_PREFIX

export MAIN_DATABASE_URL="postgres://postgres:postgres@localhost:35432/$DB_PREFIX"
export MAIN_PAYMENT_DATABASE_URL="postgres://postgres:postgres@localhost:35432/$DB_PREFIX-payment"
export MAIN_FEDERATION_CORE_DATABASE_URL="postgres://postgres:postgres@localhost:35432/$DB_PREFIX-federation"
export MAIN_GLOBAL_DATABASE_URL="postgres://postgres:postgres@localhost:35432/$DB_PREFIX-global"

export ORIGIN_DATABASE_URL="postgres://postgres:postgres@localhost:35432/origin"
export SIGNAL_DATABASE_URL="postgres://postgres:postgres@localhost:35432/signal"
export SLATES_HUB_DATABASE_URL="postgres://postgres:postgres@localhost:35432/slates-hub"
export SLATES_REGISTRY_DATABASE_URL="postgres://postgres:postgres@localhost:35432/slates-registry"
export SUBSPACE_DATABASE_URL="postgres://postgres:postgres@localhost:35432/subspace"
export SHUTTLE_DATABASE_URL="postgres://postgres:postgres@localhost:35432/shuttle"
export FORGE_DATABASE_URL="postgres://postgres:postgres@localhost:35432/forge"
export FUNCTION_BAY_DATABASE_URL="postgres://postgres:postgres@localhost:35432/function-bay"
export HORIZON_DATABASE_URL="postgres://postgres:postgres@localhost:35432/horizon"

export MIGRATION_DATABASE_URL="postgres://postgres:postgres@localhost:35432/migrate-$DB_PREFIX"
export MIGRATION_PAYMENT_DATABASE_URL="postgres://postgres:postgres@localhost:35432/migrate-$DB_PREFIX-payment"
export MIGRATION_FEDERATION_CORE_DATABASE_URL="postgres://postgres:postgres@localhost:35432/migrate-$DB_PREFIX-federation"
export MIGRATION_GLOBAL_DATABASE_URL="postgres://postgres:postgres@localhost:35432/migrate-$DB_PREFIX-global"

export DATABASE_URL=$MAIN_DATABASE_URL
export PAYMENT_DATABASE_URL=$MAIN_PAYMENT_DATABASE_URL
export FEDERATION_CORE_DATABASE_URL=$MAIN_FEDERATION_CORE_DATABASE_URL
export GLOBAL_DATABASE_URL=$MAIN_GLOBAL_DATABASE_URL

ensure_local_database() {
  local db_name=$1
  local compose_project="dev_services"
  local compose_file="$BASE_DIR/../services.docker-compose.yml"

  if ! command -v docker >/dev/null 2>&1; then
    return 0
  fi

  if ! docker compose -p "$compose_project" -f "$compose_file" ps postgres-db2 >/dev/null 2>&1; then
    return 0
  fi

  local exists
  exists=$(
    docker compose -p "$compose_project" -f "$compose_file" exec -T postgres-db2 \
      psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db_name}'"
  )

  if [ "$exists" != "1" ]; then
    echo "Creating local database: $db_name"
    docker compose -p "$compose_project" -f "$compose_file" exec -T postgres-db2 \
      psql -U postgres -d postgres -c "CREATE DATABASE \"${db_name}\";"
  fi
}

ensure_local_database "forge"
ensure_local_database "function-bay"
