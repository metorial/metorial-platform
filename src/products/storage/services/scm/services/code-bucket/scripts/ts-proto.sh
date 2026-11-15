#!/bin/bash
set -e

echo "Generating TypeScript code from Protobuf files..."

PROTO_DIR=proto
CLIENT_DIR=../../../../clients/code-bucket
OUT_DIR="$CLIENT_DIR/ts-proto-gen"

if [ ! -d "$PROTO_DIR" ]; then
  echo "Error: Protobuf directory '$PROTO_DIR' does not exist."
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

NPM_BIN=""
for candidate in "$CLIENT_DIR/node_modules/.bin" ../../../../../../../node_modules/.bin ../../../../../../../../node_modules/.bin; do
  if [ -x "$candidate/protoc-gen-ts_proto" ]; then
    NPM_BIN=$candidate
    break
  fi
done

if [ -z "$NPM_BIN" ]; then
  echo "Error: protoc-gen-ts_proto was not found in any node_modules/.bin directory."
  exit 1
fi

protoc \
  --plugin=protoc-gen-ts_proto=$NPM_BIN/protoc-gen-ts_proto \
  --proto_path=$PROTO_DIR \
  --ts_proto_out="$OUT_DIR" \
  --ts_proto_opt=esModuleInterop=true,forceLong=long,useExactTypes=false,outputServices=grpc-js \
  rpc.proto

echo "TypeScript code generation complete. Files are in the '$OUT_DIR' directory."