//! Helpers for the common check shapes. Drivers stay with the caller: pass the call to time,
//! for example `probes::latency("Postgres", Some(Duration::from_millis(250)), pool.ping())`.

use std::future::Future;
use std::time::Duration;

use serde_json::json;
use tokio::net::{lookup_host, TcpStream};
use tokio::time::Instant;

use crate::check::{CheckError, Outcome};

pub const DEFAULT_TCP_WARN_LATENCY: Duration = Duration::from_millis(250);

/// Awaits `call` and passes, or warns when it took longer than `warn_latency`.
pub async fn latency<T, E, Fut>(
    label: &str,
    warn_latency: Option<Duration>,
    call: Fut,
) -> Result<Outcome, E>
where
    Fut: Future<Output = Result<T, E>>,
{
    let started = Instant::now();
    call.await?;
    let latency_ms = started.elapsed().as_millis() as u64;

    Ok(match warn_latency {
        Some(threshold) if latency_ms > threshold.as_millis() as u64 => {
            let threshold_ms = threshold.as_millis() as u64;
            Outcome::warn(format!(
                "{label} answered in {latency_ms}ms, slower than {threshold_ms}ms."
            ))
            .with_details(json!({ "latencyMs": latency_ms, "thresholdMs": threshold_ms }))
        }
        _ => Outcome::pass(format!("{label} answered in {latency_ms}ms."))
            .with_details(json!({ "latencyMs": latency_ms })),
    })
}

pub async fn tcp(address: &str) -> Result<Outcome, CheckError> {
    Ok(latency(
        "TCP endpoint",
        Some(DEFAULT_TCP_WARN_LATENCY),
        TcpStream::connect(address),
    )
    .await?)
}

/// `host` may include a port (`db.internal:5432`); without one, port 0 is used for the lookup.
pub async fn dns(host: &str) -> Result<Outcome, CheckError> {
    let target = if host.contains(':') {
        host.to_string()
    } else {
        format!("{host}:0")
    };
    Ok(latency("DNS", None, lookup_host(target)).await?)
}
