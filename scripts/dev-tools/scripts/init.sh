#!/bin/bash

set -e

if [ -n "$IS_INIT" ]; then
  echo "Already initialized."
  exit 0
fi

export IS_INIT=true

IS_ENTERPRISE=false

if [ -d "../../../../federation" ]; then
  IS_ENTERPRISE=true
  echo "Running Metorial Enterprise"
else
  IS_ENTERPRISE=false
  echo "Running Metorial (OSS Edition)"
fi

BASE_DIR=$(pwd)
ROOT_DIR=$BASE_DIR/../../../
OSS_DIR=$BASE_DIR/../../../

if [ "$IS_ENTERPRISE" = true ]; then
  ROOT_DIR=$BASE_DIR/../../../../
fi

export METORIAL_ENV=development
export NODE_ENV=development

if [ "$IS_ENTERPRISE" = true ]; then
  export METORIAL_SOURCE=enterprise
else
  export METORIAL_SOURCE=oss
fi

export IS_ENTERPRISE
export BASE_DIR
export ROOT_DIR
export OSS_DIR