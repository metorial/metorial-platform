# doctor

The doctor protocol lets every component report the health of its dependencies (databases, caches,
object storage, KMS, peers) as a structured, redacted report with a resolution for each problem.
Components serve it at `GET /doctor` on their health port; the gateway collects the reports and
shows the merged result to operators.

| Directory                 | Contents                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`spec/`](spec/README.md) | The normative protocol, the JSON Schema and the shared conformance fixtures                               |
| [`node/`](node)           | `@lowerdeck/doctor`: runner, probes, `parseReport`, and the aggregator (`collectReports`, `mergeReports`) |
| [`go/`](go/README.md)     | Go module `github.com/metorial/metorial-platform/src/lib/doctor/go`                                       |
| [`rust/`](rust/README.md) | Rust crate `lowerdeck-doctor`, with optional `axum` and `aws` features                                    |

Every implementation tests itself against `spec/fixtures`: redaction vectors, the error
classification tables, valid reports that must round-trip unchanged, and invalid reports that
must be rejected. A change to the protocol starts in `spec/` and lands in all three
implementations together.

```sh
(cd node && bun run test)
(cd go && go test -race ./...)
(cd rust && cargo test --all-features)
```
