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
export HORIZON_DATABASE_URL="postgres://postgres:postgres@localhost:35432/horizon"

export MIGRATION_DATABASE_URL="postgres://postgres:postgres@localhost:35432/migrate-$DB_PREFIX"
export MIGRATION_PAYMENT_DATABASE_URL="postgres://postgres:postgres@localhost:35432/migrate-$DB_PREFIX-payment"
export MIGRATION_FEDERATION_CORE_DATABASE_URL="postgres://postgres:postgres@localhost:35432/migrate-$DB_PREFIX-federation"
export MIGRATION_GLOBAL_DATABASE_URL="postgres://postgres:postgres@localhost:35432/migrate-$DB_PREFIX-global"

export DATABASE_URL=$MAIN_DATABASE_URL
export PAYMENT_DATABASE_URL=$MAIN_PAYMENT_DATABASE_URL
export FEDERATION_CORE_DATABASE_URL=$MAIN_FEDERATION_CORE_DATABASE_URL
export GLOBAL_DATABASE_URL=$MAIN_GLOBAL_DATABASE_URL
