#!/bin/bash

set -e

ENGINE_DIR=$OSS_DIR/src/mcp-engine

source ./dbInit.sh

export DATABASE_URL=$MIGRATION_DATABASE_URL
export PAYMENT_DATABASE_URL=$MIGRATION_PAYMENT_DATABASE_URL
export FEDERATION_CORE_DATABASE_URL=$MIGRATION_FEDERATION_CORE_DATABASE_URL

# Prisma apply migration
echo "Applying migration to shadow database..."

cd $METORIAL_PWD
NAME_ARG=$1
bun prisma migrate reset --force --skip-generate
bun prisma migrate dev --create-only --skip-generate --name "$NAME_ARG"

export DATABASE_URL=$MAIN_DATABASE_URL
export PAYMENT_DATABASE_URL=$MAIN_PAYMENT_DATABASE_URL
export FEDERATION_CORE_DATABASE_URL=$MAIN_FEDERATION_CORE_DATABASE_URL

echo "Migration applied to shadow database."
echo "Running Prisma push to main database..."

bun prisma db push

echo "Prisma migration completed."

cd $ROOT_DIR
