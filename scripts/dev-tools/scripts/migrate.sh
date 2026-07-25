#!/bin/bash

set -e

source ./dbInit.sh

export DATABASE_URL=$MIGRATION_DATABASE_URL
export PAYMENT_DATABASE_URL=$MIGRATION_PAYMENT_DATABASE_URL
export HYPERPLANE_DATABASE_URL=$MIGRATION_HYPERPLANE_DATABASE_URL
export FEDERATION_CORE_DATABASE_URL=$MIGRATION_FEDERATION_CORE_DATABASE_URL
export GLOBAL_DATABASE_URL=$MIGRATION_GLOBAL_DATABASE_URL

# Prisma apply migration
echo "Applying migration to shadow database..."

cd $METORIAL_PWD
NAME_ARG=$1

# If another argument is provided, people might have a space in the
# migration name, so we abort and ask for a single argument.
if [ -z "$NAME_ARG" ]; then
  echo "Please provide a migration name as the first argument."
  exit 1
fi

bun prisma migrate reset --force
bun prisma migrate dev --create-only --name "$NAME_ARG"

export DATABASE_URL=$MAIN_DATABASE_URL
export PAYMENT_DATABASE_URL=$MAIN_PAYMENT_DATABASE_URL
export HYPERPLANE_DATABASE_URL=$MAIN_HYPERPLANE_DATABASE_URL
export FEDERATION_CORE_DATABASE_URL=$MAIN_FEDERATION_CORE_DATABASE_URL
export GLOBAL_DATABASE_URL=$MAIN_GLOBAL_DATABASE_URL

echo "Migration applied to shadow database."
echo "Running Prisma push to main database..."

bun prisma db push

echo "Prisma migration completed."

cd $ROOT_DIR
