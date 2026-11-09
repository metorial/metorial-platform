//! Zip jobs: idempotent, leased archive builds that any instance can run, wait for, cancel, or
//! restart after the instance running them died.

mod admission;
mod error;
mod lease;
mod record;
mod remote;
mod runner;

use std::collections::HashMap;
use std::fmt::Display;
use std::future::Future;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use bytes::Bytes;
use chrono::{DateTime, Utc};
use futures::Stream;
use tokio::sync::{watch, Semaphore};
use tokio::time::Instant;
use tokio_util::sync::CancellationToken;
use tokio_util::task::TaskTracker;
use tracing::{info, warn};

pub use error::JobRequestError;
pub use record::{validate_job_id, ZipJob, ZipJobState, MAX_JOB_ID_BYTES};

use admission::{AdmittedSpec, SpecAdmission};
use lease::{LocalJob, StopReason};
use record::{JobStore, StoredJob};
use remote::{Polled, RemotePolls};

use super::{ZipErrorCode, ZipJobError, ZipJobSpec, ZipSettings};
use crate::error::{ServiceError, ServiceResult};
use crate::service::ObjectStoreService;

/// Rounds of read, decide and compare-and-swap before a request gives up on a record that keeps
/// changing underneath it.
const MAX_CAS_ROUNDS: usize = 8;

/// Job records examined per retention pass.
const RETENTION_PAGE: usize = 500;

/// Runs this instance's zip jobs and answers job requests. Job state lives in the backend, so
/// any instance can serve any request; only waiting is faster on the instance running the job.
pub struct ZipJobManager {
    service: Arc<ObjectStoreService>,
    store: JobStore,
    settings: ZipSettings,
    instance_id: String,
    permits: Arc<Semaphore>,
    /// The attempt each job runs here, if any.
    jobs: Mutex<HashMap<String, Arc<LocalJob>>>,
    /// Attempts accepted here and not yet finished, queued or running.
    active: AtomicUsize,
    /// Entries of those attempts.
    active_entries: AtomicUsize,
    admission: SpecAdmission,
    /// Requests waiting for a job to end.
    waiting: AtomicUsize,
    remote_polls: RemotePolls,
    shutdown: CancellationToken,
    tasks: TaskTracker,
    retention_cursor: Mutex<Option<String>>,
}

struct WaitingRequest<'a>(&'a AtomicUsize);

impl<'a> WaitingRequest<'a> {
    fn new(count: &'a AtomicUsize) -> Self {
        count.fetch_add(1, Ordering::AcqRel);
        WaitingRequest(count)
    }
}

impl Drop for WaitingRequest<'_> {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::AcqRel);
    }
}

/// One accepted attempt's share of the instance's job capacity.
struct Slot {
    manager: Arc<ZipJobManager>,
    entries: usize,
}

impl Drop for Slot {
    fn drop(&mut self) {
        self.manager
            .active_entries
            .fetch_sub(self.entries, Ordering::AcqRel);
        self.manager.active.fetch_sub(1, Ordering::AcqRel);
    }
}

impl ZipJobManager {
    pub fn new(service: Arc<ObjectStoreService>, settings: ZipSettings) -> Arc<Self> {
        let instance_id = uuid::Uuid::new_v4().simple().to_string();
        Self::with_instance_id(service, settings, instance_id)
    }

    pub fn with_instance_id(
        service: Arc<ObjectStoreService>,
        settings: ZipSettings,
        instance_id: String,
    ) -> Arc<Self> {
        let permits = Arc::new(Semaphore::new(settings.max_concurrent_jobs.max(1)));
        let admission = SpecAdmission::new(&settings);

        Arc::new(ZipJobManager {
            store: JobStore::new(service.backend().clone()),
            service,
            settings,
            instance_id,
            permits,
            jobs: Mutex::new(HashMap::new()),
            active: AtomicUsize::new(0),
            active_entries: AtomicUsize::new(0),
            admission,
            waiting: AtomicUsize::new(0),
            remote_polls: RemotePolls::default(),
            shutdown: CancellationToken::new(),
            tasks: TaskTracker::new(),
            retention_cursor: Mutex::new(None),
        })
    }

    pub fn instance_id(&self) -> &str {
        &self.instance_id
    }

    pub fn settings(&self) -> &ZipSettings {
        &self.settings
    }

    /// Attempts accepted by this instance that have not finished yet.
    pub fn active_jobs(&self) -> usize {
        self.active.load(Ordering::Acquire)
    }

    /// Requests on this instance waiting for a job to end.
    pub fn waiting_requests(&self) -> usize {
        self.waiting.load(Ordering::Acquire)
    }

    fn capacity(&self) -> usize {
        self.settings.max_concurrent_jobs.max(1) + self.settings.max_queued_jobs
    }

    /// Creates the job, joins the attempt already under way, or starts a new attempt after a
    /// failed or canceled one; then waits up to `wait` for it to end.
    pub async fn submit(
        self: &Arc<Self>,
        id: &str,
        spec: ZipJobSpec,
        wait: Duration,
    ) -> Result<ZipJob, JobRequestError> {
        validate_job_id(id).map_err(JobRequestError::InvalidJobId)?;
        let admitted = admission::check(spec, self.settings.clone()).await?;
        self.submit_admitted(id, admitted, wait).await
    }

    /// [`submit`](Self::submit) for a spec still to be read from a request body. Nothing is
    /// read while this instance could not take another attempt, unless the id names a job the
    /// request can only join; and bodies wait at most `spec_admission_wait` for their share of
    /// `max_parsing_spec_bytes`.
    pub async fn submit_body<S, E>(
        self: &Arc<Self>,
        id: &str,
        content_length: Option<u64>,
        body: S,
        wait: Duration,
    ) -> Result<ZipJob, JobRequestError>
    where
        S: Stream<Item = Result<Bytes, E>>,
        E: Display,
    {
        validate_job_id(id).map_err(JobRequestError::InvalidJobId)?;
        self.check_room(id).await?;
        let admitted = self
            .admission
            .read(content_length, body, &self.settings)
            .await?;
        self.submit_admitted(id, admitted, wait).await
    }

    async fn submit_admitted(
        self: &Arc<Self>,
        id: &str,
        admitted: AdmittedSpec,
        wait: Duration,
    ) -> Result<ZipJob, JobRequestError> {
        self.check_destination(&admitted.spec).await?;

        let job = self
            .detached({
                let this = self.clone();
                let id = id.to_string();
                async move { this.start_or_join(&id, admitted).await }
            })
            .await?;
        self.wait_for(job, wait).await
    }

    async fn check_room(&self, id: &str) -> Result<(), JobRequestError> {
        let Some(refusal) = self.refusal() else {
            return Ok(());
        };
        match self.load(id).await? {
            Some(stored)
                if stored.job.is_active() || stored.job.state == ZipJobState::Completed =>
            {
                Ok(())
            }
            _ => Err(refusal),
        }
    }

    /// Why this instance would refuse to start any new attempt right now.
    fn refusal(&self) -> Option<JobRequestError> {
        if self.shutdown.is_cancelled() {
            return Some(JobRequestError::ShuttingDown);
        }

        let capacity = self.capacity();
        if self.active.load(Ordering::Acquire) >= capacity {
            return Some(JobRequestError::TooManyJobs(capacity));
        }

        let limit = self.settings.max_active_entries();
        let active = self.active_entries.load(Ordering::Acquire);
        (active >= limit).then_some(JobRequestError::TooManyEntries {
            active,
            requested: 1,
            limit,
        })
    }

    /// Runs `work` on a task of its own, so a request dropped by a disconnecting client cannot
    /// stop a record write midway or leave a new attempt's record without its runner.
    async fn detached<T, E>(
        &self,
        work: impl Future<Output = Result<T, E>> + Send + 'static,
    ) -> Result<T, E>
    where
        T: Send + 'static,
        E: From<ServiceError> + Send + 'static,
    {
        self.tasks.spawn(work).await.unwrap_or_else(|error| {
            Err(ServiceError::Internal(format!("zip job request task failed: {}", error)).into())
        })
    }

    async fn check_destination(&self, spec: &ZipJobSpec) -> Result<(), JobRequestError> {
        match self
            .service
            .metadata()
            .get_bucket(&spec.destination.bucket)
            .await
        {
            Ok(_) => Ok(()),
            Err(ServiceError::BucketNotFound(bucket)) => {
                Err(JobRequestError::InvalidSpec(ZipJobError::invalid_spec(
                    format!("destination bucket {:?} does not exist", bucket),
                )))
            }
            Err(error) => Err(error.into()),
        }
    }

    /// The admitted spec's budget is released when this returns: by then the spec is either
    /// counted in its attempt's slot or dropped.
    async fn start_or_join(
        self: &Arc<Self>,
        id: &str,
        admitted: AdmittedSpec,
    ) -> Result<ZipJob, JobRequestError> {
        let AdmittedSpec {
            spec,
            hash: spec_hash,
            budget: _budget,
        } = admitted;
        let mut spec = Some(spec);

        for _ in 0..MAX_CAS_ROUNDS {
            let current = self.load(id).await?;
            let written_at = Instant::now();
            let now = Utc::now();

            let next = match &current {
                None => ZipJob::first_attempt(
                    id,
                    &spec_hash,
                    &self.instance_id,
                    now,
                    self.settings.lease,
                ),
                Some(stored) if stored.job.spec_hash != spec_hash => {
                    return Err(JobRequestError::SpecConflict(id.to_string()))
                }
                Some(stored) if stored.job.state == ZipJobState::Completed => {
                    return Ok(stored.job.clone())
                }
                Some(stored) if stored.job.is_active() => return Ok(stored.job.clone()),
                Some(stored) => {
                    stored
                        .job
                        .next_attempt(&self.instance_id, now, self.settings.lease)
                }
            };

            if self.shutdown.is_cancelled() {
                return Err(JobRequestError::ShuttingDown);
            }
            let slot = self.reserve_slot(spec.as_ref().map_or(0, |spec| spec.entries.len()))?;

            let local = Arc::new(LocalJob::new(&next, self.shutdown.child_token()));
            self.register(&local);

            let written = match &current {
                None => self.store.create(&next).await,
                Some(stored) => self.store.replace(&next, &stored.etag).await,
            };

            match written {
                Ok(Some(stored)) => {
                    info!(
                        "Starting zip job {} attempt {} on this instance",
                        id, stored.job.attempt
                    );
                    let job = stored.job.clone();
                    let spec = spec.take().ok_or_else(|| {
                        ServiceError::Internal("zip job spec already used".to_string())
                    })?;
                    runner::spawn(self, local, stored, written_at, spec, slot);
                    return Ok(job);
                }
                Ok(None) => self.unregister(&local),
                Err(error) => {
                    self.unregister(&local);
                    return Err(error.into());
                }
            }
        }

        Err(JobRequestError::Contended(id.to_string()))
    }

    fn reserve_slot(self: &Arc<Self>, entries: usize) -> Result<Slot, JobRequestError> {
        let capacity = self.capacity();
        self.active
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |active| {
                (active < capacity).then_some(active + 1)
            })
            .map_err(|_| JobRequestError::TooManyJobs(capacity))?;

        let limit = self.settings.max_active_entries();
        let reserved =
            self.active_entries
                .fetch_update(Ordering::AcqRel, Ordering::Acquire, |active| {
                    active.checked_add(entries).filter(|&total| total <= limit)
                });
        match reserved {
            Ok(_) => Ok(Slot {
                manager: self.clone(),
                entries,
            }),
            Err(active) => {
                self.active.fetch_sub(1, Ordering::AcqRel);
                Err(JobRequestError::TooManyEntries {
                    active,
                    requested: entries,
                    limit,
                })
            }
        }
    }

    pub async fn get(
        self: &Arc<Self>,
        id: &str,
        wait: Duration,
    ) -> Result<ZipJob, JobRequestError> {
        validate_job_id(id).map_err(JobRequestError::InvalidJobId)?;

        let job = self
            .load(id)
            .await?
            .ok_or_else(|| JobRequestError::NotFound(id.to_string()))?
            .job;
        self.wait_for(job, wait).await
    }

    /// Marks the job canceled. Its owner stops at its next heartbeat or before committing, or
    /// right away when that is this instance. Ended jobs are returned unchanged.
    pub async fn cancel(self: &Arc<Self>, id: &str) -> Result<ZipJob, JobRequestError> {
        validate_job_id(id).map_err(JobRequestError::InvalidJobId)?;

        let this = self.clone();
        let id = id.to_string();
        self.detached(async move { this.cancel_now(&id).await })
            .await
    }

    async fn cancel_now(&self, id: &str) -> Result<ZipJob, JobRequestError> {
        for _ in 0..MAX_CAS_ROUNDS {
            let stored = self
                .load(id)
                .await?
                .ok_or_else(|| JobRequestError::NotFound(id.to_string()))?;
            if !stored.job.is_active() {
                return Ok(stored.job);
            }

            let mut canceled = stored.job.clone();
            canceled.finish(Err(ZipJobError::canceled()), Utc::now());
            if let Some(written) = self.store.replace(&canceled, &stored.etag).await? {
                info!("Canceled zip job {} attempt {}", id, written.job.attempt);
                self.notify_local(&written.job, StopReason::Canceled);
                return Ok(written.job);
            }
        }

        Err(JobRequestError::Contended(id.to_string()))
    }

    /// Reads the record, ending it as `failed` / `lease_expired` if its runner is gone.
    async fn load(&self, id: &str) -> Result<Option<StoredJob>, JobRequestError> {
        for _ in 0..MAX_CAS_ROUNDS {
            let Some(stored) = self.store.read(id).await? else {
                return Ok(None);
            };

            // Backends on case-insensitive file systems map `Job` and `job` to one record.
            if stored.job.id != id {
                return Err(JobRequestError::IdCollision {
                    id: id.to_string(),
                    existing: stored.job.id,
                });
            }

            let now = Utc::now();
            if !stored
                .job
                .lease_expired(now, self.settings.lease_skew_grace)
            {
                return Ok(Some(stored));
            }

            let mut expired = stored.job.clone();
            expired.finish(
                Err(ZipJobError::new(
                    ZipErrorCode::LeaseExpired,
                    format!(
                        "instance {} stopped renewing the lease of attempt {}",
                        stored.job.owner, stored.job.attempt
                    ),
                )),
                now,
            );

            let write = {
                let store = self.store.clone();
                let etag = stored.etag.clone();
                async move { store.replace(&expired, &etag).await }
            };
            if let Some(written) = self.detached(write).await? {
                warn!(
                    "Zip job {} attempt {} on {} lost its lease; marked failed",
                    id, written.job.attempt, written.job.owner
                );
                self.notify_local(&written.job, StopReason::LeaseLost);
                return Ok(Some(written));
            }
        }

        Err(
            ServiceError::Internal(format!("zip job {} kept changing while it was read", id))
                .into(),
        )
    }

    async fn wait_for(
        self: &Arc<Self>,
        mut job: ZipJob,
        wait: Duration,
    ) -> Result<ZipJob, JobRequestError> {
        let wait = wait.min(self.settings.max_wait);
        let deadline = Instant::now() + wait;
        if !job.is_active() || wait.is_zero() {
            return Ok(job);
        }
        let _waiting = WaitingRequest::new(&self.waiting);
        let mut remote = None;

        loop {
            if !job.is_active() || Instant::now() >= deadline {
                return Ok(job);
            }

            // On shutdown a local attempt still publishes how it ended (`interrupted`), so only
            // waits on other instances' jobs are cut short.
            if let Some(mut updates) = self.subscribe(&job.id, job.attempt) {
                remote = None;
                let ended = tokio::select! {
                    biased;
                    ended = updates.wait_for(|job| !job.is_active()) => {
                        Some(ended.map(|job| job.clone()).ok())
                    }
                    _ = tokio::time::sleep_until(deadline) => None,
                };

                match ended {
                    Some(Some(ended)) => return Ok(ended),
                    // The attempt is gone from this instance; the record says how it ended.
                    Some(None) => job = self.reload(&job.id).await?,
                    None => return Ok(updates.borrow().clone()),
                }
                continue;
            }

            let polls = remote.get_or_insert_with(|| self.remote_polls.watch(self, &job));
            let polled = tokio::select! {
                biased;
                _ = self.shutdown.cancelled() => return Ok(job),
                changed = polls.changed() => changed.ok().map(|()| polls.borrow_and_update().clone()),
                _ = tokio::time::sleep_until(deadline) => return Ok(job),
            };
            job = match polled {
                Some(Polled::Job(polled)) => *polled,
                Some(Polled::Failed) => self.reload(&job.id).await?,
                None => {
                    remote = None;
                    self.reload(&job.id).await?
                }
            };
        }
    }

    async fn reload(&self, id: &str) -> Result<ZipJob, JobRequestError> {
        self.load(id)
            .await?
            .map(|stored| stored.job)
            .ok_or_else(|| JobRequestError::NotFound(id.to_string()))
    }

    fn registry(&self) -> std::sync::MutexGuard<'_, HashMap<String, Arc<LocalJob>>> {
        self.jobs
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn register(&self, local: &Arc<LocalJob>) {
        self.registry().insert(local.id.clone(), local.clone());
    }

    fn unregister(&self, local: &Arc<LocalJob>) {
        let mut jobs = self.registry();
        if jobs
            .get(&local.id)
            .is_some_and(|current| Arc::ptr_eq(current, local))
        {
            jobs.remove(&local.id);
        }
    }

    fn local_attempt(&self, id: &str, attempt: u32) -> Option<Arc<LocalJob>> {
        self.registry()
            .get(id)
            .filter(|local| local.attempt == attempt)
            .cloned()
    }

    fn subscribe(&self, id: &str, attempt: u32) -> Option<watch::Receiver<ZipJob>> {
        self.local_attempt(id, attempt)
            .map(|local| local.subscribe())
    }

    /// Tells this instance's runner of `job`'s attempt, if there is one, that someone else
    /// ended it.
    fn notify_local(&self, job: &ZipJob, reason: StopReason) {
        if let Some(local) = self.local_attempt(&job.id, job.attempt) {
            local.stop(reason);
            local.publish(job);
        }
    }

    /// Stops accepting attempts, stops every local one, and waits up to `shutdown_grace` for
    /// them to abort their uploads and record themselves as `interrupted`. Attempts that are
    /// still stuck after that are marked `interrupted` here, so a new `PUT` can restart them
    /// right away instead of waiting for the lease to run out.
    pub async fn shutdown(&self) {
        self.shutdown.cancel();
        self.tasks.close();

        let running = self.registry().len();
        if running > 0 {
            info!("Interrupting {} zip jobs for shutdown", running);
        }

        if tokio::time::timeout(self.settings.shutdown_grace, self.tasks.wait())
            .await
            .is_ok()
        {
            return;
        }

        let stuck: Vec<Arc<LocalJob>> = self.registry().values().cloned().collect();
        for local in stuck {
            warn!(
                "Zip job {} attempt {} did not stop in time; marking it interrupted",
                local.id, local.attempt
            );
            if let Err(error) = self.interrupt(&local).await {
                warn!("Failed to mark zip job {} interrupted: {}", local.id, error);
            }
        }
    }

    pub fn is_shutting_down(&self) -> bool {
        self.shutdown.is_cancelled()
    }

    async fn interrupt(&self, local: &LocalJob) -> ServiceResult<()> {
        for _ in 0..MAX_CAS_ROUNDS {
            let Some(stored) = self.store.read(&local.id).await? else {
                return Ok(());
            };
            if !stored.job.is_attempt(&self.instance_id, local.attempt) {
                return Ok(());
            }

            let mut interrupted = stored.job.clone();
            interrupted.finish(
                Err(ZipJobError::new(
                    ZipErrorCode::Interrupted,
                    "the instance shut down before the archive was finished",
                )),
                Utc::now(),
            );
            if let Some(written) = self.store.replace(&interrupted, &stored.etag).await? {
                local.publish(&written.job);
                return Ok(());
            }
        }
        Ok(())
    }

    /// Deletes job records that ended more than `job_retention` ago.
    pub async fn delete_expired_records(&self) -> ServiceResult<usize> {
        let retention = chrono::Duration::from_std(self.settings.job_retention)
            .unwrap_or(chrono::Duration::MAX);
        match Utc::now().checked_sub_signed(retention) {
            Some(cutoff) => self.delete_records_older_than(cutoff).await,
            None => Ok(0),
        }
    }

    /// Deletes ended job records last written before `cutoff`, including records whose runner
    /// died without ending them. Examines one page of records per call and resumes after it on
    /// the next call.
    pub async fn delete_records_older_than(&self, cutoff: DateTime<Utc>) -> ServiceResult<usize> {
        let now = Utc::now();
        let token = self
            .retention_cursor
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone();
        let page = self.store.list(RETENTION_PAGE, token.as_deref()).await?;
        *self
            .retention_cursor
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = page.next_continuation_token;

        let mut deleted = 0;
        for object in page.objects {
            if object.last_modified > cutoff {
                continue;
            }
            let Some(id) = JobStore::id_of(&object.key) else {
                continue;
            };
            let Some(stored) = self.store.read(id).await? else {
                continue;
            };

            let ended = !stored.job.is_active()
                || stored
                    .job
                    .lease_expired(now, self.settings.lease_skew_grace);
            if ended
                && stored.job.updated_at <= cutoff
                && self.store.delete_if_unchanged(id, &stored.etag).await?
            {
                deleted += 1;
            }
        }

        if deleted > 0 {
            info!("Deleted {} expired zip job records", deleted);
        }
        Ok(deleted)
    }
}
