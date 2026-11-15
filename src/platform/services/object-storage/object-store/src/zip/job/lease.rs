use chrono::{DateTime, Utc};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tokio::sync::watch;
use tokio::time::Instant;
use tokio_util::sync::CancellationToken;
use tracing::warn;

use super::record::{lease_deadline, JobStore, StoredJob, ZipJob, ZipJobState};
use crate::error::ServiceError;
use crate::zip::{CommitCheck, ZipErrorCode, ZipJobError, ZipProgress};

const COMMIT_RENEWAL_BACKOFF: Duration = Duration::from_millis(100);
const MAX_COMMIT_RENEWAL_BACKOFF: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum StopReason {
    Canceled,
    LeaseLost,
    Shutdown,
}

/// The attempt of a job running on this instance, as seen by its waiters and by requests that
/// need to stop it.
pub(crate) struct LocalJob {
    pub id: String,
    pub attempt: u32,
    pub cancel: CancellationToken,
    reason: OnceLock<StopReason>,
    updates: watch::Sender<ZipJob>,
}

impl LocalJob {
    pub fn new(job: &ZipJob, cancel: CancellationToken) -> Self {
        LocalJob {
            id: job.id.clone(),
            attempt: job.attempt,
            cancel,
            reason: OnceLock::new(),
            updates: watch::Sender::new(job.clone()),
        }
    }

    pub fn subscribe(&self) -> watch::Receiver<ZipJob> {
        self.updates.subscribe()
    }

    /// The first reason given wins.
    pub fn stop(&self, reason: StopReason) {
        let _ = self.reason.set(reason);
        self.cancel.cancel();
    }

    pub fn stop_reason(&self) -> Option<StopReason> {
        self.reason.get().copied()
    }

    /// Publishes the stored state of this attempt. An ended attempt is never shown as active
    /// again, whatever order concurrent writers publish in.
    pub fn publish(&self, job: &ZipJob) {
        if job.attempt != self.attempt {
            return;
        }

        self.updates.send_if_modified(|current| {
            if !current.is_active() && job.is_active() {
                return false;
            }
            *current = job.clone();
            true
        });
    }
}

pub(crate) enum LeaseError {
    /// Someone else wrote the record: it was canceled, marked dead, or moved to a new attempt.
    Lost(Box<ZipJob>),
    Deleted,
    Backend(ServiceError),
}

impl LeaseError {
    pub fn stop_reason(&self) -> StopReason {
        match self {
            LeaseError::Lost(job) if job.state == ZipJobState::Canceled => StopReason::Canceled,
            _ => StopReason::LeaseLost,
        }
    }

    pub fn into_job_error(self, context: &str) -> ZipJobError {
        match self {
            LeaseError::Lost(job) if job.state == ZipJobState::Canceled => ZipJobError::canceled(),
            LeaseError::Lost(job) => ZipJobError::new(
                ZipErrorCode::LeaseExpired,
                format!(
                    "{}: the job is now {:?} attempt {} of {}",
                    context, job.state, job.attempt, job.owner
                ),
            ),
            LeaseError::Deleted => ZipJobError::new(
                ZipErrorCode::LeaseExpired,
                format!("{}: the job record was deleted", context),
            ),
            LeaseError::Backend(error) => ZipJobError::from_service(context, error),
        }
    }
}

/// The owner's handle on its attempt's record. All of the owner's writes go through here, one
/// at a time, as compare-and-swaps on top of the owner's previous write, so the owner can never
/// overwrite a state it has not seen.
pub(crate) struct Lease {
    store: JobStore,
    local: Arc<LocalJob>,
    progress: Arc<ZipProgress>,
    owner: String,
    duration: Duration,
    current: tokio::sync::Mutex<StoredJob>,
    deadline: Mutex<Instant>,
}

impl Lease {
    pub fn new(
        store: JobStore,
        local: Arc<LocalJob>,
        progress: Arc<ZipProgress>,
        owner: &str,
        duration: Duration,
        stored: StoredJob,
        written_at: Instant,
    ) -> Self {
        Lease {
            store,
            local,
            progress,
            owner: owner.to_string(),
            duration,
            current: tokio::sync::Mutex::new(stored),
            deadline: Mutex::new(written_at + duration),
        }
    }

    /// When the lease this instance last wrote runs out, by the local clock. Measured from
    /// before the write was sent, so it never ends later than the stored lease.
    pub fn deadline(&self) -> Instant {
        *self
            .deadline
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// Writes `change` on top of the owner's last write, with the current progress.
    pub async fn update(
        &self,
        change: impl FnOnce(&mut ZipJob, DateTime<Utc>),
    ) -> Result<ZipJob, LeaseError> {
        let mut current = self.current.lock().await;
        let sent_at = Instant::now();
        let now = Utc::now();

        let mut next = current.job.clone();
        change(&mut next, now);
        next.progress = self.progress.snapshot();
        next.updated_at = now;
        if next.is_active() {
            next.lease_expires_at = Some(lease_deadline(now, self.duration));
        }

        let mut etag = Some(current.etag.clone());
        for _ in 0..2 {
            let written = match &etag {
                Some(etag) => self.store.replace(&next, etag).await,
                None => self.store.create(&next).await,
            };
            match written {
                Ok(Some(stored)) => {
                    *current = stored;
                    if next.is_active() {
                        *self
                            .deadline
                            .lock()
                            .unwrap_or_else(|poisoned| poisoned.into_inner()) =
                            sent_at + self.duration;
                    }
                    self.local.publish(&next);
                    return Ok(next);
                }
                Ok(None) => {}
                Err(error) => return Err(LeaseError::Backend(error)),
            }

            match self.store.read(&next.id).await {
                // Nobody else ever writes an attempt without changing its state, owner or number,
                // so this is our own earlier write whose response was lost.
                Ok(Some(stored)) if stored.job.is_attempt(&self.owner, self.local.attempt) => {
                    etag = Some(stored.etag);
                }
                Ok(Some(stored)) => {
                    self.local.publish(&stored.job);
                    return Err(LeaseError::Lost(Box::new(stored.job)));
                }
                // Retention only deletes ended records and records whose lease ran out, and our
                // lease has not, so it deleted this attempt's record by racing the write of it
                // (it has no conditional delete). Writing it again only succeeds if nobody
                // created a new record meanwhile.
                Ok(None) if current.job.is_active() && Instant::now() < self.deadline() => {
                    warn!(
                        "Zip job {} attempt {} lost its record while its lease was live; writing it again",
                        next.id, next.attempt
                    );
                    etag = None;
                }
                Ok(None) => return Err(LeaseError::Deleted),
                Err(error) => return Err(LeaseError::Backend(error)),
            }
        }

        Err(LeaseError::Backend(ServiceError::Internal(
            "the job record kept changing".to_string(),
        )))
    }

    /// Runs right before the archive is committed: renews the lease and so proves that this
    /// instance still owns a running attempt. If that fails, the upload is aborted.
    pub fn commit_check(self: &Arc<Self>) -> CommitCheck {
        let lease = self.clone();
        Box::new(move || Box::pin(async move { lease.renew_before_commit().await }))
    }

    /// Transient backend errors are retried for as long as the lease lasts, since giving up
    /// throws away the whole archive; anything that says the attempt is no longer ours vetoes
    /// right away.
    async fn renew_before_commit(&self) -> Result<(), ZipJobError> {
        const CONTEXT: &str = "renewing the lease before committing";

        if Instant::now() >= self.deadline() {
            return Err(ZipJobError::new(
                ZipErrorCode::LeaseExpired,
                format!("{}: the lease ran out", CONTEXT),
            ));
        }

        let mut backoff = COMMIT_RENEWAL_BACKOFF;
        loop {
            let error = match self.update(|_, _| {}).await {
                Ok(_) => return Ok(()),
                Err(LeaseError::Backend(error)) if is_transient(&error) => error,
                Err(error) => return Err(error.into_job_error(CONTEXT)),
            };

            if Instant::now() + backoff >= self.deadline() {
                return Err(LeaseError::Backend(error).into_job_error(CONTEXT));
            }
            warn!(
                "Failed to renew the zip job lease before committing, retrying in {:?}: {}",
                backoff, error
            );
            tokio::time::sleep(backoff).await;
            backoff = (backoff * 2).min(MAX_COMMIT_RENEWAL_BACKOFF);
        }
    }
}

fn is_transient(error: &ServiceError) -> bool {
    matches!(error, ServiceError::Backend(error) if error.is_retryable())
}

#[cfg(test)]
mod tests {
    use super::super::record::testing::FaultyBackend;
    use super::*;
    use object_store_backends::local::LocalBackend;
    use object_store_backends::Backend;
    use std::sync::atomic::Ordering;
    use tempfile::TempDir;

    const LEASE: Duration = Duration::from_secs(60);

    fn job(attempt: u32, state: ZipJobState) -> ZipJob {
        let mut job = ZipJob::first_attempt("job", "hash", "me", Utc::now(), LEASE);
        job.attempt = attempt;
        job.state = state;
        job
    }

    async fn store() -> (TempDir, JobStore) {
        let dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(dir.path().to_path_buf(), "jobs".to_string());
        backend.init().await.unwrap();
        (dir, JobStore::new(Arc::new(backend)))
    }

    async fn lease(store: &JobStore) -> (Arc<LocalJob>, Lease) {
        lease_for(store, LEASE).await
    }

    async fn lease_for(store: &JobStore, duration: Duration) -> (Arc<LocalJob>, Lease) {
        let first = job(1, ZipJobState::Queued);
        let stored = store.create(&first).await.unwrap().unwrap();
        let local = Arc::new(LocalJob::new(&first, CancellationToken::new()));
        let progress = Arc::new(ZipProgress::new());
        let lease = Lease::new(
            store.clone(),
            local.clone(),
            progress,
            "me",
            duration,
            stored,
            Instant::now(),
        );
        (local, lease)
    }

    async fn run_commit_check(lease: Lease) -> Result<(), ZipJobError> {
        Arc::new(lease).commit_check()().await
    }

    async fn take_over(store: &JobStore) {
        let current = store.read("job").await.unwrap().unwrap();
        let next = current.job.next_attempt("other", Utc::now(), LEASE);
        store.replace(&next, &current.etag).await.unwrap().unwrap();
    }

    #[tokio::test]
    async fn retries_transient_failures_before_committing() {
        let (_dir, backend) = FaultyBackend::new().await;
        let store = backend.store();
        let (_local, lease) = lease(&store).await;
        let before = lease.deadline();
        backend.transient_failures.store(3, Ordering::SeqCst);
        let writes = backend.writes();

        let lease = Arc::new(lease);
        lease.commit_check()().await.unwrap();

        assert_eq!(backend.writes() - writes, 4);
        assert!(lease.deadline() > before);
        let stored = store.read("job").await.unwrap().unwrap().job;
        assert!(stored.is_attempt("me", 1));
    }

    #[tokio::test]
    async fn vetoes_the_commit_at_once_when_the_attempt_was_taken_over() {
        let (_dir, backend) = FaultyBackend::new().await;
        let store = backend.store();
        let (_local, lease) = lease(&store).await;
        take_over(&store).await;
        let writes = backend.writes();

        let error = run_commit_check(lease).await.unwrap_err();

        assert_eq!(error.code, ZipErrorCode::LeaseExpired);
        assert_eq!(backend.writes() - writes, 1);
    }

    #[tokio::test]
    async fn vetoes_the_commit_at_once_when_writes_keep_failing_their_precondition() {
        let (_dir, backend) = FaultyBackend::new().await;
        let store = backend.store();
        let (_local, lease) = lease(&store).await;
        backend.fail_preconditions.store(true, Ordering::SeqCst);
        let writes = backend.writes();
        let started = Instant::now();

        assert!(run_commit_check(lease).await.is_err());

        assert_eq!(backend.writes() - writes, 2);
        assert!(started.elapsed() < LEASE / 2);
    }

    #[tokio::test]
    async fn vetoes_the_commit_when_failures_outlast_the_lease() {
        let lease_for_test = Duration::from_millis(1500);
        let (_dir, backend) = FaultyBackend::new().await;
        let store = backend.store();
        let (_local, lease) = lease_for(&store, lease_for_test).await;
        let deadline = lease.deadline();
        backend
            .transient_failures
            .store(usize::MAX, Ordering::SeqCst);
        let writes = backend.writes();

        let error = run_commit_check(lease).await.unwrap_err();

        assert_eq!(error.code, ZipErrorCode::BackendError, "{error:?}");
        assert!(backend.writes() - writes > 1);
        assert!(Instant::now() < deadline + Duration::from_secs(10));
    }

    #[tokio::test]
    async fn vetoes_the_commit_at_once_after_the_lease_ran_out() {
        let (_dir, backend) = FaultyBackend::new().await;
        let store = backend.store();
        let (_local, lease) = lease_for(&store, Duration::from_millis(1)).await;
        tokio::time::sleep(Duration::from_millis(20)).await;
        let writes = backend.writes();

        let error = run_commit_check(lease).await.unwrap_err();

        assert_eq!(error.code, ZipErrorCode::LeaseExpired);
        assert_eq!(backend.writes(), writes);
    }

    #[test]
    fn never_shows_an_ended_attempt_as_active_again() {
        let local = LocalJob::new(&job(2, ZipJobState::Running), CancellationToken::new());
        let updates = local.subscribe();

        local.publish(&job(1, ZipJobState::Completed));
        assert_eq!(updates.borrow().state, ZipJobState::Running);

        local.publish(&job(2, ZipJobState::Canceled));
        local.publish(&job(2, ZipJobState::Running));
        assert_eq!(updates.borrow().state, ZipJobState::Canceled);
    }

    #[test]
    fn keeps_the_first_stop_reason() {
        let local = LocalJob::new(&job(1, ZipJobState::Running), CancellationToken::new());
        assert_eq!(local.stop_reason(), None);

        local.stop(StopReason::Canceled);
        local.stop(StopReason::Shutdown);

        assert!(local.cancel.is_cancelled());
        assert_eq!(local.stop_reason(), Some(StopReason::Canceled));
    }

    #[test]
    fn maps_a_lost_lease_to_the_reason_it_was_lost() {
        let canceled = LeaseError::Lost(Box::new(job(1, ZipJobState::Canceled)));
        assert_eq!(canceled.stop_reason(), StopReason::Canceled);
        assert_eq!(canceled.into_job_error("x").code, ZipErrorCode::Canceled);

        let taken = LeaseError::Lost(Box::new(job(2, ZipJobState::Running)));
        assert_eq!(taken.stop_reason(), StopReason::LeaseLost);
        assert_eq!(taken.into_job_error("x").code, ZipErrorCode::LeaseExpired);

        assert_eq!(
            LeaseError::Deleted.into_job_error("x").code,
            ZipErrorCode::LeaseExpired
        );
    }

    #[tokio::test]
    async fn renews_the_lease_and_publishes_each_write() {
        let (_dir, store) = store().await;
        let (local, lease) = lease(&store).await;
        let updates = local.subscribe();
        let before = lease.deadline();

        tokio::time::sleep(Duration::from_millis(5)).await;
        let running = lease
            .update(|job, _| job.state = ZipJobState::Running)
            .await
            .ok()
            .unwrap();

        assert!(lease.deadline() > before);
        assert!(running.lease_expires_at.unwrap() > Utc::now());
        assert_eq!(updates.borrow().state, ZipJobState::Running);
        assert_eq!(store.read("job").await.unwrap().unwrap().job, running);
    }

    #[tokio::test]
    async fn adopts_its_own_write_whose_response_was_lost() {
        let (_dir, store) = store().await;
        let (_local, lease) = lease(&store).await;
        let current = store.read("job").await.unwrap().unwrap();
        let mut rewritten = current.job.clone();
        rewritten.updated_at = Utc::now();
        store
            .replace(&rewritten, &current.etag)
            .await
            .unwrap()
            .unwrap();

        let renewed = lease.update(|_, _| {}).await.ok().unwrap();

        assert_eq!(store.read("job").await.unwrap().unwrap().job, renewed);
    }

    #[tokio::test]
    async fn loses_the_lease_to_a_cancel_or_a_newer_attempt() {
        let (_dir, store) = store().await;
        let (local, lease) = lease(&store).await;
        let current = store.read("job").await.unwrap().unwrap();
        let mut canceled = current.job.clone();
        canceled.finish(Err(ZipJobError::canceled()), Utc::now());
        store
            .replace(&canceled, &current.etag)
            .await
            .unwrap()
            .unwrap();

        let Err(LeaseError::Lost(seen)) = lease.update(|_, _| {}).await else {
            panic!("the lease survived a cancel");
        };
        assert_eq!(seen.state, ZipJobState::Canceled);
        assert_eq!(local.subscribe().borrow().state, ZipJobState::Canceled);
        assert_eq!(store.read("job").await.unwrap().unwrap().job, canceled);

        let (_dir, store) = self::store().await;
        let (local, lease) = self::lease(&store).await;
        let current = store.read("job").await.unwrap().unwrap();
        let next = current.job.next_attempt("other", Utc::now(), LEASE);
        store.replace(&next, &current.etag).await.unwrap().unwrap();

        let Err(LeaseError::Lost(seen)) = lease.update(|_, _| {}).await else {
            panic!("the lease survived a takeover");
        };
        assert_eq!(seen.attempt, 2);
        assert_eq!(local.subscribe().borrow().attempt, 1);
        assert_eq!(store.read("job").await.unwrap().unwrap().job, next);
    }

    #[tokio::test]
    async fn notices_a_record_deleted_after_its_lease_ran_out() {
        let (_dir, store) = store().await;
        let (_local, lease) = lease_for(&store, Duration::from_millis(1)).await;
        let current = store.read("job").await.unwrap().unwrap();
        assert!(store
            .delete_if_unchanged("job", &current.etag)
            .await
            .unwrap());
        tokio::time::sleep(Duration::from_millis(20)).await;

        assert!(matches!(
            lease.update(|_, _| {}).await,
            Err(LeaseError::Deleted)
        ));
        assert!(store.read("job").await.unwrap().is_none());
    }

    #[tokio::test]
    async fn writes_again_a_record_deleted_under_its_live_lease() {
        let (_dir, store) = store().await;
        let (_local, lease) = lease(&store).await;
        let current = store.read("job").await.unwrap().unwrap();
        assert!(store
            .delete_if_unchanged("job", &current.etag)
            .await
            .unwrap());

        let running = lease
            .update(|job, _| job.state = ZipJobState::Running)
            .await
            .ok()
            .unwrap();

        assert_eq!(store.read("job").await.unwrap().unwrap().job, running);
        lease.update(|_, _| {}).await.ok().unwrap();
    }

    #[tokio::test]
    async fn loses_a_deleted_record_to_one_created_meanwhile() {
        let (_dir, store) = store().await;
        let (_local, lease) = lease(&store).await;
        let current = store.read("job").await.unwrap().unwrap();
        assert!(store
            .delete_if_unchanged("job", &current.etag)
            .await
            .unwrap());
        let recreated = ZipJob::first_attempt("job", "hash", "other", Utc::now(), LEASE);
        store.create(&recreated).await.unwrap().unwrap();

        let Err(LeaseError::Lost(seen)) = lease.update(|_, _| {}).await else {
            panic!("the lease overwrote a newer record");
        };
        assert_eq!(seen.owner, "other");
        assert_eq!(store.read("job").await.unwrap().unwrap().job, recreated);
    }
}
