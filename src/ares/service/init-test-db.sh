#!/bin/sh
set -e

# Create databases for CI/local-compose services if they don't exist
dbs="ares-test"
for db in $dbs; do
  exists=$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'")
  if [ "$exists" != "1" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
      -c "CREATE DATABASE \"${db}\";"
  fi
done

echo "Database initialization complete"
