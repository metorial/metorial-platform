use std::time::Duration;

use object_store_backends::multipart::{KIB, MIB, TIB};
use object_store_backends::RetryPolicy;

use super::entry::cpu_count;

/// Largest `small_entry_bytes` accepted, since every prefetched entry is held in memory.
pub const MAX_SMALL_ENTRY_BYTES: u64 = 64 * MIB;

/// Most entries prepared ahead of the one being written.
pub const MAX_FETCH_CONCURRENCY: usize = 256;

/// Most blocks of one large Deflate entry compressed at once.
pub const MAX_COMPRESSION_PARALLELISM: usize = 256;

/// Runtime settings for zip archives. The pipeline uses the fetch, size and source settings; the
/// job, lease and wait settings are for the job runner.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ZipSettings {
    pub max_concurrent_jobs: usize,
    /// Jobs an instance accepts beyond `max_concurrent_jobs`, waiting for a slot.
    pub max_queued_jobs: usize,
    /// Entries fetched (small ones fully, with compression) ahead of the one being written.
    pub fetch_concurrency: usize,
    /// Entries up to this size are fetched whole and compressed in memory; larger ones stream.
    pub small_entry_bytes: u64,
    pub max_entries: usize,
    pub max_spec_bytes: usize,
    /// Request bodies of specs read, parsed and validated at once, together; at least one
    /// spec of `max_spec_bytes` is always admitted.
    pub max_parsing_spec_bytes: usize,
    /// How long a spec waits for its share of `max_parsing_spec_bytes` before the request is
    /// refused with `too_many_jobs`.
    pub spec_admission_wait: Duration,
    pub max_archive_bytes: u64,
    pub max_wait: Duration,
    pub job_retention: Duration,
    pub heartbeat_interval: Duration,
    pub lease: Duration,
    pub lease_skew_grace: Duration,
    pub shutdown_grace: Duration,
    /// How often a waiting request re-reads a job that runs on another instance.
    pub wait_poll_interval: Duration,

    /// Sources HEADed at once before anything is written.
    pub head_concurrency: usize,
    /// Reconnects allowed per source after its stream failed or stalled.
    pub source_reconnects: u32,
    /// Backoff between source reconnects, and retries of failed HEAD requests.
    pub source_retry: RetryPolicy,
    /// A source stream that yields nothing for this long is treated as broken and reconnected.
    pub source_idle_timeout: Duration,
    /// Archive bytes are coalesced into chunks of about this size before entering the upload.
    pub write_chunk_bytes: usize,
    /// Blocks of one large Deflate entry compressed at once, each holding about 2 MiB while it
    /// is in flight; `None` for one per CPU. The process-wide compression slots, one per CPU,
    /// still cap how many blocks compress at a time across all archives.
    pub compression_parallelism: Option<usize>,
}

impl Default for ZipSettings {
    fn default() -> Self {
        ZipSettings {
            max_concurrent_jobs: 2,
            max_queued_jobs: 64,
            fetch_concurrency: 16,
            small_entry_bytes: MIB,
            max_entries: 1_000_000,
            max_spec_bytes: 64 * MIB as usize,
            max_parsing_spec_bytes: 64 * MIB as usize,
            spec_admission_wait: Duration::from_secs(5),
            max_archive_bytes: TIB,
            max_wait: Duration::from_secs(30),
            job_retention: Duration::from_secs(168 * 60 * 60),
            heartbeat_interval: Duration::from_secs(15),
            lease: Duration::from_secs(60),
            lease_skew_grace: Duration::from_secs(10),
            shutdown_grace: Duration::from_secs(10),
            wait_poll_interval: Duration::from_secs(1),
            head_concurrency: 32,
            source_reconnects: 5,
            source_retry: RetryPolicy {
                max_attempts: 6,
                base_delay: Duration::from_millis(250),
                max_delay: Duration::from_secs(10),
            },
            source_idle_timeout: Duration::from_secs(60),
            write_chunk_bytes: MIB as usize,
            compression_parallelism: None,
        }
    }
}

impl ZipSettings {
    pub(crate) fn fetch_concurrency(&self) -> usize {
        self.fetch_concurrency.clamp(1, MAX_FETCH_CONCURRENCY)
    }

    pub(crate) fn small_entry_bytes(&self) -> u64 {
        self.small_entry_bytes.min(MAX_SMALL_ENTRY_BYTES)
    }

    pub(crate) fn head_concurrency(&self) -> usize {
        self.head_concurrency.clamp(1, MAX_FETCH_CONCURRENCY)
    }

    pub(crate) fn write_chunk_bytes(&self) -> usize {
        self.write_chunk_bytes
            .clamp(4 * KIB as usize, 16 * MIB as usize)
    }

    pub(crate) fn compression_parallelism(&self) -> usize {
        self.compression_parallelism
            .unwrap_or_else(cpu_count)
            .clamp(1, MAX_COMPRESSION_PARALLELISM)
    }

    /// At most half the lease, so one missed heartbeat never lets the lease run out.
    pub(crate) fn heartbeat_interval(&self) -> Duration {
        self.heartbeat_interval
            .min(self.lease / 2)
            .max(MIN_JOB_INTERVAL)
    }

    pub(crate) fn wait_poll_interval(&self) -> Duration {
        self.wait_poll_interval.max(MIN_JOB_INTERVAL)
    }

    /// Entries of the jobs queued or running on one instance, together. Queued jobs hold their
    /// whole spec in memory, so the job count alone does not bound memory; this lets the
    /// queue hold as many entries as the running slots, so one job of `max_entries` always fits
    /// on an idle instance.
    pub(crate) fn max_active_entries(&self) -> usize {
        self.max_concurrent_jobs
            .max(1)
            .saturating_mul(self.max_entries.max(1))
    }
}

const MIN_JOB_INTERVAL: Duration = Duration::from_millis(10);
