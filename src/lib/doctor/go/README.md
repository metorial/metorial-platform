# doctor (Go)

Go implementation of the doctor protocol described in [`../spec/README.md`](../spec/README.md).

```go
import doctor "github.com/metorial/metorial-platform/src/lib/doctor/go"

d := doctor.New(doctor.Options{Component: "sandbox-controller"})

err := d.Register(doctor.Check{
	ID:       "database.reachable",
	Title:    "Database",
	Category: doctor.CategoryDatabase,
	Severity: doctor.SeverityCritical,
	Target:   databaseURL,
	Run:      doctor.Probe("Postgres", func(ctx context.Context) error { return pool.Ping(ctx) }, 250*time.Millisecond),
})

healthMux.Handle("/doctor", d.Handler())
```

A check's `Run` reports through `r.Pass`, `r.Warn`, `r.Fail` or `r.Skip`. Returning without a
result passes; returning an error marks the check as `error` and classifies it with
`DescribeError`, which understands AWS smithy (`ErrorCode()`), pgconn (`SQLState()`), syscall
errnos, DNS, x509 and `HTTPStatusCode()` errors without importing those packages.

`Run(ctx, fresh)` is debounced: concurrent callers share one run, and the run is detached from
`ctx`, so a caller that gives up never cancels it for the others.

Tests run against the shared fixtures in `../spec/fixtures`:

```sh
go test -race ./...
```
