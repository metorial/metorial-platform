# ldrpc

Go runtime for the lowerdeck RPC protocol: the same wire format as `@lowerdeck/rpc-server` and
`@lowerdeck/rpc-client`, so Go services can serve TypeScript callers and call each other.
Standard library only.

- Protocol: [`../../docs/rpc/protocol.md`](../../docs/rpc/protocol.md)
- Codegen (TypeScript spec DSL → Go server/client + TS client):
  [`../../docs/rpc/go-services-plan.md`](../../docs/rpc/go-services-plan.md)

```
go get github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc
```

Inside the monorepo, point a `replace` directive at this directory.

## Generated services

Services describe their interface with `@lowerdeck/rpc-spec` and generate the Go package and the
TypeScript client from it:

```
rpc-spec generate spec/src/index.ts --go service/rpc/clustermanagerrpc --ts clients/cluster-manager/src/generated.ts
rpc-spec generate spec/src/index.ts --go … --ts … --check   # CI: fails when out of date
```

The Go package holds the types, a `Service` interface, `Register(srv, impl)` (which wires each
method's input schema, so malformed input gets the same `400 invalid_data` issues as a
TypeScript server), `Err<Code>(…)` constructors and a typed `Client`
(`NewClient(endpoint, opts)` or `WrapClient(rpc)`). Methods marked `.idempotent(false)` are
called with `WithoutRetry()`. `example/bucketrpc` is generated from
`packages/rpc-spec/src/fixtures/bucket.ts` (`bun run example` there).

## Server

```go
srv := ldrpc.NewServer(ldrpc.ServerOptions{
	Path:         "/rpc",
	Authenticate: ldrpc.HMACAuth(func(*http.Request) (string, error) { return secret, nil }),
	OnError:      func(ctx context.Context, call *ldrpc.CallInfo, err error) { log.Print(err) },
})

srv.Handle("bucket:get", ldrpc.Unary(func(ctx context.Context, in *GetBucketInput) (*Bucket, error) {
	if in.BucketID == "" {
		return nil, ldrpc.ValidationErrors{{Code: "required", Message: "bucketId is required", Path: []string{"bucketId"}}}
	}
	b, err := store.Get(ctx, in.BucketID)
	if errors.Is(err, store.ErrNotFound) {
		return nil, ldrpc.NotFoundError("bucket", in.BucketID)
	}
	return b, err
}))

mux := http.NewServeMux()
srv.Mount(mux) // registers both /rpc (batch) and /rpc/ (direct calls)
```

- Return an `*ldrpc.Error` to send that error. `ldrpc.ValidationErrors` becomes
  `400 invalid_data`. Any other error, or a panic, becomes `500 internal_server_error`
  (details go to `OnError`, never to the caller).
- Input types implementing `Validate() error` are validated before the handler runs;
  `ldrpc.WithInputSchema(schema)` validates the raw payload against a generated schema first.
- `ldrpc.CallInfoFromContext(ctx)` exposes the request id, method, caller IP, headers and the
  value returned by `Authenticate` (e.g. `ldrpc.Ed25519Caller{KeyID}` from `Ed25519Auth`).
- `srv.Use(middleware)` wraps every call (logging, metrics, tracing).

## Client

```go
c, err := ldrpc.NewClient("https://bucket.internal/rpc", ldrpc.ClientOptions{HMACToken: secret})

bucket, err := ldrpc.Call[Bucket](ctx, c, "bucket:get", GetBucketInput{BucketID: "bkt_1"},
	ldrpc.WithTimeout(5*time.Second))
if ldrpc.IsCode(err, "not_found") { … }
```

Retries follow the TypeScript client: 4xx never, 5xx a bounded number of times, transport
failures until the deadline (2 minutes by default, `ClientOptions.Timeout`, `WithTimeout` or the
context deadline). Methods may therefore run more than once; keep them idempotent or call them
`WithoutRetry()`. `c.Batch` sends several calls in one request. `ClientOptions.HeaderFunc` adds
headers per attempt (e.g. a fresh token); `ClientOptions.Intercept` wraps each call including
its retries.

## Kubernetes ServiceAccount auth (`ldrpc/kubeauth`)

Authenticates callers by their projected ServiceAccount token through the TokenReview API, with
an expected audience. Results are cached by token hash for at most a minute and never past the
token's expiry. Standard library only.

```go
verifier, err := kubeauth.New(kubeauth.Config{Audiences: []string{"cluster-manager"}}) // in-cluster defaults
srv := ldrpc.NewServer(ldrpc.ServerOptions{Path: "/rpc", Authenticate: verifier.Authenticate()})
srv.Use(kubeauth.MethodAllowlist(map[string]kubeauth.Allowlist{
	"function:": {{Namespace: "metorial", Name: "functions"}},
	"build:":    {{Namespace: "metorial", Name: "build"}},
}))

identity, _ := kubeauth.IdentityFromContext(ctx) // Namespace, ServiceAccount, PodName, PodUID
```

`verifier.Middleware(h)` does the same for a plain `http.Handler`. Outside a cluster, set
`APIServer`, `TokenFile` (needs `system:auth-delegator`) and `CAFile`. Callers send their token
with `ClientOptions{HeaderFunc: kubeauth.TokenFileHeader(path)}`, or `projectedTokenHeaders` in
TypeScript.

## OpenTelemetry (`ldrpc/otel`)

A separate module, so the core stays dependency-free. `ldrpcotel.Handler` wraps the server's
HTTP handler with `otelhttp`, `Instrument(srv, o)` adds a span per call,
`ServerOptions(opts, o)` adds structured `slog` records from `OnCall`/`OnError`, and
`ClientOptions(opts, o)` wraps the transport (injecting trace context) and adds a span per call
covering its retries.

## Encoding

`Marshal`/`Unmarshal` speak the `@lowerdeck/serialize` envelope. `time.Time` round-trips as a
JavaScript `Date` (millisecond precision); struct tags follow `encoding/json`, and
`ldrpc:"nonnil"` sends a nil slice, map or `[]byte` as `[]`, `{}` or `""`. Values with their own
`MarshalJSON` are encoded opaquely (no `Date` annotation inside them), except union wrappers
implementing `UnionValue`.

## Tests

```
go test ./...                     # unit tests, vectors from the TypeScript packages, kubeauth
(cd otel && go test ./...)
bun test interop                  # TS client ⇄ Go server, Go client ⇄ TS server, generated
                                  # clients and servers, validation parity
bun interop/vectors.ts            # regenerate testdata/vectors.json after changing a TS package
LDRPC_KUBEAUTH_IT=1 go test ./kubeauth -run Integration   # real TokenReview (kubectl context orbstack)
```

`testdata/validation.json` is regenerated with `bun run vectors` in `packages/rpc-spec`.
`interop/` needs Go and Bun and resolves the TypeScript packages from `../../packages`.
