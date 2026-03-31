#!/bin/bash

set -e

bun ../src/cli.ts set-env

./build.sh
