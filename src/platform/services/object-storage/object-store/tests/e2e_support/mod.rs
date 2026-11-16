#![allow(dead_code)]

//! Black-box end-to-end support: runs the real `object-store-service` binary as separate OS
//! processes with temporary config files and talks to them only over HTTP (plus, for checks the
//! API cannot express, the local data directory, the S3 emulator's own API and `ps`).

pub mod api;
pub mod backend;
pub mod data;
pub mod service;
pub mod verify;

#[allow(unused_imports)]
pub use api::{Api, Reply};
#[allow(unused_imports)]
pub use backend::{BackendKind, Storage, Turn};
#[allow(unused_imports)]
pub use data::*;
#[allow(unused_imports)]
pub use service::{RssSampler, RssStats, Service, ServiceBuilder};
#[allow(unused_imports)]
pub use verify::*;

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

pub const KIB: u64 = 1024;
pub const MIB: u64 = 1024 * KIB;
pub const GIB: u64 = 1024 * MIB;

/// A short id unique to this test process and call, safe in bucket names and job ids. Emulator
/// state outlives a test run, so every bucket and job id carries one.
pub fn unique(prefix: &str) -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos() as u64;
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!(
        "{prefix}-{:x}{:x}-{n}",
        nanos & 0xff_ffff_ffff,
        std::process::id() & 0xffff
    )
}

pub fn ms(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1000.0
}

/// Prints a measurement line that the report collects (`--nocapture` shows them).
#[macro_export]
macro_rules! report {
    ($($arg:tt)*) => {
        println!("[e2e] {}", format!($($arg)*))
    };
}

pub fn percentile(samples: &mut [f64], p: f64) -> f64 {
    if samples.is_empty() {
        return 0.0;
    }
    samples.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let index = ((samples.len() - 1) as f64 * p).round() as usize;
    samples[index]
}

/// Seconds of level-9 Deflate one 4 MiB text entry costs the service, roughly; slow jobs are
/// sized with it. Debug builds are about six times slower.
pub fn slow_entry_seconds() -> f64 {
    if cfg!(debug_assertions) {
        1.5
    } else {
        0.25
    }
}

/// Entries of a 4 MiB level-9 text source needed for a job of about `seconds`.
pub fn slow_entries_for(seconds: f64) -> usize {
    (seconds / slow_entry_seconds()).ceil().max(1.0) as usize
}
