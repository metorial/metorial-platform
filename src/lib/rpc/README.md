# Lowerdeck RPC

Node and Go services use the same RPC protocol, with shared service specs and cross-language
compatibility tests.

```text
rpc/
  node/
    client/       # @lowerdeck/rpc-client
    server/       # @lowerdeck/rpc-server
    signature/    # @lowerdeck/rpc-signature
  spec/           # @lowerdeck/rpc-spec: DSL, validation, TypeScript and Go generators
  go/             # Go runtime, package ldrpc; standard library only
    kubeauth/     # Kubernetes authentication, part of the core module
    otel/         # Optional OpenTelemetry integration, separate Go module
    example/      # Generated example service
    interop/      # Node ↔ Go compatibility tests
    testdata/     # Shared encoding, signature, and validation fixtures
  docs/           # Protocol specification and Go implementation plan
```

The npm packages retain their `@lowerdeck/rpc-*` names. The Go module is
`github.com/metorial/metorial-platform/src/lib/rpc/go`; its OpenTelemetry module adds `/otel`.
Service-specific specs and generated clients stay with their owning products.

See the [protocol](docs/protocol.md), [Go runtime guide](go/README.md), and
[spec and code generation design](docs/go-services-plan.md).

Run from the OSS root:

```sh
bunx turbo run test --filter=@lowerdeck/rpc-client --filter=@lowerdeck/rpc-server --filter=@lowerdeck/rpc-signature --filter=@lowerdeck/rpc-spec
(cd src/lib/rpc/go && go test ./... && bun test interop)
(cd src/lib/rpc/go/otel && go test ./...)
```

Regenerate the example and protocol fixtures from their owning directories:

```sh
(cd src/lib/rpc/spec && bun run example && bun run vectors)
(cd src/lib/rpc/go && bun interop/vectors.ts)
```
