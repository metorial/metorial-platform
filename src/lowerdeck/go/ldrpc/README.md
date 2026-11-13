# ldrpc

Go runtime for the lowerdeck RPC protocol: the same wire format as `@lowerdeck/rpc-server` and
`@lowerdeck/rpc-client`, so Go services can serve TypeScript callers and call each other.
Standard library only.

- Protocol: [`../../docs/rpc/protocol.md`](../../docs/rpc/protocol.md)
- Codegen plan (TypeScript spec DSL → Go server/client + TS client):
  [`../../docs/rpc/go-services-plan.md`](../../docs/rpc/go-services-plan.md)

```
go get github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc
```

Inside the monorepo, point a `replace` directive at this directory.

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
- Input types implementing `Validate() error` are validated before the handler runs.
- `ldrpc.CallInfoFromContext(ctx)` exposes the request id, method, caller IP, headers and the
  value returned by `Authenticate` (e.g. `ldrpc.Ed25519Caller{KeyID}` from `Ed25519Auth`).
- `srv.Use(middleware)` wraps every call (logging, metrics, tracing).

## Client

```go
c, err := ldrpc.NewClient("https://bucket.internal/rpc", ldrpc.ClientOptions{HMACToken: secret})

bucket, err := ldrpc.Call[Bucket](ctx, c, "bucket:get", GetBucketInput{BucketID: "bkt_1"})
if e, ok := ldrpc.AsError(err); ok && e.Code == "not_found" { … }
```

Retries follow the TypeScript client: 4xx never, 5xx a bounded number of times, transport
failures until the deadline (2 minutes by default, `ClientOptions.Timeout` or the context
deadline). Methods may therefore run more than once; keep them idempotent. `c.Batch` sends
several calls in one request.

## Encoding

`Marshal`/`Unmarshal` speak the `@lowerdeck/serialize` envelope. `time.Time` round-trips as a
JavaScript `Date` (millisecond precision); struct tags follow `encoding/json`. Values with their
own `MarshalJSON` are encoded opaquely (no `Date` annotation inside them).

## Tests

```
go test ./...       # unit tests, including vectors produced by the TypeScript packages
bun test interop    # real TypeScript client ⇄ Go server, Go client ⇄ real TypeScript server
bun interop/vectors.ts   # regenerate testdata/vectors.json after changing a TS package
```

`interop/` needs Go and Bun and resolves the TypeScript packages from `../../packages`.
`example/bucketrpc` is hand-written in the shape the planned generator will emit.
