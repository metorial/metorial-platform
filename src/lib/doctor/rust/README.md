# lowerdeck-doctor

Rust implementation of the doctor protocol described in [`../spec/README.md`](../spec/README.md).

```rust
use lowerdeck_doctor::{aws, probes, Category, Check, Doctor, Options, Severity};

let doctor = Doctor::new(Options::new("object-storage"));

doctor.register(
    Check::new("bucket.reachable", "Bucket", Category::Storage, Severity::Critical, move |_| {
        let client = client.clone();
        async move { Ok(probes::latency("S3", None, client.head_bucket().send()).await.map_err(aws::coded)?) }
    })
    .target(bucket_url),
)?;

let app = health_router.merge(lowerdeck_doctor::axum::router(doctor.clone()));
```

A check resolves to an `Outcome` (`pass`, `warn`, `fail`, `skip`). An `Err` marks it as `error`
and is classified with `describe_error`, which walks `source()` and recognizes `io::Error` kinds,
tokio timeouts, `HttpStatusError` and `CodedError`. Wrap errors that carry a protocol code in
`CodedError` (or `aws::coded` for AWS SDK errors) so the code survives boxing.

`Doctor::run(fresh)` is debounced: concurrent callers share one run, which executes on its own
tokio task, so a caller that is dropped never cancels it for the others. `Doctor::respond` is a
framework-agnostic handler; the `axum` feature wraps it in a router.

| Feature | Adds                                                                                   |
| ------- | -------------------------------------------------------------------------------------- |
| `axum`  | `lowerdeck_doctor::axum::{router, handler}`                                            |
| `aws`   | `lowerdeck_doctor::aws::{coded, describe_aws_error}` for `ProvideErrorMetadata` errors |

```sh
cargo test --all-features
```
