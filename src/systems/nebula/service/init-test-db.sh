#!/usr/bin/env bash
set -euo pipefail

psql postgres://postgres:postgres@localhost:5432/postgres -c "DROP DATABASE IF EXISTS \"nebula-test\";"
psql postgres://postgres:postgres@localhost:5432/postgres -c "CREATE DATABASE \"nebula-test\";"
