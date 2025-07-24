#!/bin/bash
set -e

echo "Generating TypeScript code from Protobuf files..."

PROTO_DIR=proto
OUT_DIR=ts-proto-gen

if [ ! -d "$PROTO_DIR" ]; then
  echo "Error: Protobuf directory '$PROTO_DIR' does not exist."
  exit 1
fi

rm -rf $OUT_DIR
mkdir -p $OUT_DIR

NPM_BIN=../../../../node_modules/.bin
if [ ! -d "$NPM_BIN" ]; then
  NPM_BIN=../../../node_modules/.bin
fi

if [ ! -d "$NPM_BIN" ]; then
  echo "Error: Node.js binary directory '$NPM_BIN' does not exist."
  exit 1
fi

protoc \
  --plugin=protoc-gen-ts_proto=$NPM_BIN/protoc-gen-ts_proto \
  --proto_path=$PROTO_DIR \
  --ts_proto_out=$OUT_DIR \
  --ts_proto_opt=esModuleInterop=true,forceLong=long,useExactTypes=false,outputServices=grpc-js \
  rpc.proto

echo "TypeScript code generation complete. Files are in the '$OUT_DIR' directory."