use std::sync::Arc;
use std::time::Duration;

use tokio::sync::OwnedSemaphorePermit;
use tokio::time::Instant;
use tokio_util::sync::CancellationToken;
use tracing::{info, warn, Instrument};

use super::lease::{Lease, LeaseError, LocalJob, StopReason};
use super::record::{StoredJob, ZipJob, ZipJobState};
use super::{Slot, ZipJobManager};
use crate::zip::{
    build_archive_owned, ArchiveResult, ZipErrorCode, ZipJobError, ZipJobSpec, ZipProgress,
};

const FINAL_WRITE_ATTEMPTS: u32 = 3;
const FINAL_WRITE_BACKOFF: Duration = Duration::from_millis(200);

pub(crate) fn spawn(
    manager: &Arc<ZipJobManager>,
    local: Arc<LocalJob>,
    stored: StoredJob,
    written_at: Instant,
    spec: ZipJobSpec,
    slot: Slot,
) {
    let progress = Arc::new(ZipProgress::new());
    let lease = Arc::new(Lease::new(
        manager.store.clone(),
        local.clone(),
        progress.clone(),
        &manager.instance_id,
        manager.settings.lease,
        stored,
        written_at,
    ));

    let span = tracing::info_span!(
        "zip_job",
        job = %local.id,
        attempt = local.attempt,
        instance = %manager.instance_id
    );

    let guard = RunGuard {
        manager: manager.clone(),
        lease: lease.clone(),
        local: local.clone(),
        slot: Some(slot),
        armed: true,
    };

    manager
        .tasks
        .spawn(run(manager.clone(), lease, local, spec, progress, guard).instrument(span));
}

async fn run(
    manager: Arc<ZipJobManager>,
    lease: Arc<Lease>,
    local: Arc<LocalJob>,
    spec: ZipJobSpec,
    progress: Arc<ZipProgress>,
    mut guard: RunGuard,
) {
    info!("Zip job attempt queued");
    let started = std::time::Instant::now();
    let done = CancellationToken::new();

    let work = async {
        let outcome = attempt(&manager, &lease, &local, spec, progress.clone()).await;
        done.cancel();
        outcome
    };
    let heartbeat = heartbeat(&manager, &lease, &local, &done);
    let ((outcome, permit), ()) = tokio::join!(work, heartbeat);

    let outcome = outcome.map_err(|error| explain_stop(&manager, &local, error));
    match &outcome {
        Ok(result) => info!(
            "Zip job attempt completed in {:?}: {} bytes",
            started.elapsed(),
            result.size
        ),
        Err(error) => warn!(
            "Zip job attempt failed after {:?}: {}",
            started.elapsed(),
            error
        ),
    }

    if let Some(job) = finish(&lease, outcome).await {
        local.publish(&job);
    }

    guard.armed = false;
    manager.unregister(&local);
    drop(permit);
}

/// Waits for a slot, marks the attempt running and builds the archive. The slot is returned
/// so it is only released after the final state is written.
async fn attempt(
    manager: &ZipJobManager,
    lease: &Arc<Lease>,
    local: &LocalJob,
    spec: ZipJobSpec,
    progress: Arc<ZipProgress>,
) -> (
    Result<ArchiveResult, ZipJobError>,
    Option<OwnedSemaphorePermit>,
) {
    let permit = tokio::select! {
        biased;
        _ = local.cancel.cancelled() => return (Err(ZipJobError::canceled()), None),
        permit = manager.permits.clone().acquire_owned() => match permit {
            Ok(permit) => permit,
            Err(_) => return (Err(ZipJobError::internal("the job slots were closed")), None),
        },
    };

    if let Err(error) = lease
        .update(|job, now| {
            job.state = ZipJobState::Running;
            job.started_at = Some(now);
        })
        .await
    {
        local.stop(error.stop_reason());
        return (
            Err(error.into_job_error("starting the attempt")),
            Some(permit),
        );
    }
    info!("Zip job attempt running");

    let outcome = build_archive_owned(
        &manager.service,
        spec,
        &manager.settings,
        local.cancel.clone(),
        progress,
        Some(lease.commit_check()),
    )
    .await;

    (outcome, Some(permit))
}

/// Renews the lease until `done`, while queued and while running. Stops the attempt when the
/// record was taken away, or when the lease runs out before a renewal got through.
async fn heartbeat(
    manager: &ZipJobManager,
    lease: &Lease,
    local: &LocalJob,
    done: &CancellationToken,
) {
    let interval = manager.settings.heartbeat_interval();

    loop {
        tokio::select! {
            biased;
            _ = done.cancelled() => return,
            _ = tokio::time::sleep_until(lease.deadline()) => {
                warn!("Zip job lease ran out before it could be renewed");
                local.stop(StopReason::LeaseLost);
                return;
            }
            _ = tokio::time::sleep(interval) => {}
        }

        // A renewal in flight is awaited rather than dropped: dropping a backend write midway can
        // leave a half-written record or temporary file behind.
        let renewal = lease.update(|_, _| {});
        tokio::pin!(renewal);
        let renewed = tokio::select! {
            biased;
            renewed = &mut renewal => renewed,
            _ = tokio::time::sleep_until(lease.deadline()) => {
                warn!("Zip job lease ran out while renewing it");
                local.stop(StopReason::LeaseLost);
                let _ = renewal.await;
                return;
            }
        };

        match renewed {
            Ok(_) => {}
            Err(LeaseError::Backend(error)) => {
                warn!("Failed to renew the zip job lease, retrying: {}", error);
            }
            Err(error) => {
                warn!("Zip job lease lost; stopping the attempt");
                local.stop(error.stop_reason());
                return;
            }
        }
    }
}

/// The pipeline reports any stop as `canceled`; this says why it stopped.
fn explain_stop(manager: &ZipJobManager, local: &LocalJob, error: ZipJobError) -> ZipJobError {
    if error.code != ZipErrorCode::Canceled {
        return error;
    }

    let reason = local.stop_reason().or_else(|| {
        manager
            .shutdown
            .is_cancelled()
            .then_some(StopReason::Shutdown)
    });

    match reason {
        Some(StopReason::Shutdown) => ZipJobError::new(
            ZipErrorCode::Interrupted,
            "the instance shut down before the archive was finished",
        ),
        Some(StopReason::LeaseLost) => ZipJobError::new(
            ZipErrorCode::LeaseExpired,
            "the instance lost the job's lease before the archive was finished",
        ),
        Some(StopReason::Canceled) | None => error,
    }
}

/// Writes the attempt's final state, unless someone else already ended the attempt; either way
/// returns the stored state, or `None` if it cannot be read.
///
/// A commit that failed is reported as `backend_error` even though the object may have been
/// written: a failed multipart completion returns no ETag, so the object at the destination
/// cannot be told apart from an older one of the same size. Retrying is safe, since another
/// attempt writes the same bytes.
async fn finish(lease: &Lease, outcome: Result<ArchiveResult, ZipJobError>) -> Option<ZipJob> {
    for attempt in 1..=FINAL_WRITE_ATTEMPTS {
        let outcome = outcome.clone();
        match lease.update(move |job, now| job.finish(outcome, now)).await {
            Ok(job) => return Some(job),
            Err(LeaseError::Lost(job)) => return Some(*job),
            Err(LeaseError::Deleted) => return None,
            Err(LeaseError::Backend(error)) => {
                warn!(
                    "Failed to write the zip job's final state (try {}): {}",
                    attempt, error
                );
                tokio::time::sleep(FINAL_WRITE_BACKOFF * attempt).await;
            }
        }
    }
    None
}

/// Ends the attempt as `failed` / `internal` if its task panics or is dropped before writing a
/// final state, so waiters on this instance get an answer instead of a lease that runs out.
struct RunGuard {
    manager: Arc<ZipJobManager>,
    lease: Arc<Lease>,
    local: Arc<LocalJob>,
    slot: Option<Slot>,
    armed: bool,
}

impl Drop for RunGuard {
    fn drop(&mut self) {
        let slot = self.slot.take();
        if !self.armed {
            return;
        }

        let manager = self.manager.clone();
        let lease = self.lease.clone();
        let local = self.local.clone();
        let cleanup = async move {
            let error = ZipJobError::internal("the job task ended unexpectedly");
            if let Some(job) = finish(&lease, Err(error)).await {
                local.publish(&job);
            }
            manager.unregister(&local);
            drop(slot);
        };

        match tokio::runtime::Handle::try_current() {
            Ok(handle) => {
                handle.spawn(cleanup);
            }
            Err(_) => self.manager.unregister(&self.local),
        }
    }
}
