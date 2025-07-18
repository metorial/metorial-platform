#!/bin/bash

set -e

echo "Starting a Metorial Engine mini cluster..."

./buildEngine.sh

cd $OSS_DIR/deployment/scripts

./startMinicluster.sh