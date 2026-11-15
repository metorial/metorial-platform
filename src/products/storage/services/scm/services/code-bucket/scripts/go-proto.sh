#!/bin/bash
set -e

echo "Generating Go code from Protobuf files..."

PROTO_DIR=proto
OUT_DIR=../gen

if [ ! -d "$PROTO_DIR" ]; then
  echo "Error: Protobuf directory '$PROTO_DIR' does not exist."
  exit 1
fi

cd $PROTO_DIR

rm -rf $OUT_DIR
mkdir -p $OUT_DIR

protoc \
  --proto_path=. \
  --go_out=$OUT_DIR \
  --go-grpc_out=$OUT_DIR \
  rpc.proto

cp -r $OUT_DIR/github.com/metorial/metorial/services/rpc/* ../

rm -rf $OUT_DIR/github.com 

echo "Go code generation complete. Files are in the 'gen' directory."