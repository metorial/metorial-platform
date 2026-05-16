#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE "cargo-test";
  CREATE DATABASE "voyager";
  CREATE DATABASE "voyager-search";
EOSQL
