#!/bin/sh
set -eu

cd /app

bun install --linker=hoisted
