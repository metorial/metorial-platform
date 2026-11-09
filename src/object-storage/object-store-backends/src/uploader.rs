use bytes::Bytes;
use std::future::Future;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use tokio::task::{JoinError, JoinSet};
use tracing::{debug, warn};

use crate::backend::{Backend, ByteStream, ObjectMetadata};
use crate::error::{BackendError, BackendResult};
use crate::multipart::{
    MultipartUpload, PartReceipt, PutOptions, UploadLimits, UploadedObject, GIB, KIB, MIB,
};
use crate::upload::{ChunkedUpload, SINGLE_REQUEST_THRESHOLD};

const BUDGET_UNIT: u64 = KIB;

/// Part buffers start this small and double while they are filled in small steps.
const INITIAL_BUFFER: u64 = 4 * KIB;

/// Part buffers grow in small steps up to this size; past it, the rest of the part is reserved
/// at once.
const INCREMENTAL_LIMIT: u64 = MIB;

/// One part in this many of the memory budget is set aside for buffers still growing in small
/// steps, so the rest of a part can always be reserved without waiting on those buffers.
const INCREMENTAL_SHARE: u64 = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub base_delay: Duration,
    pub max_delay: Duration,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 6,
            base_delay: Duration::from_millis(250),
            max_delay: Duration::from_secs(10),
        }
    }
}

impl RetryPolicy {
    /// The pause after the `attempt`-th failed attempt: exponential, capped, with the upper half
    /// jittered so parts that failed together don't retry together.
    pub fn delay(&self, attempt: u32) -> Duration {
        let factor = 1u32
            .checked_shl(attempt.saturating_sub(1))
            .unwrap_or(u32::MAX);
        let exponential = self.base_delay.saturating_mul(factor).min(self.max_delay);
        let half = exponential / 2;
        half + jitter(exponential - half)
    }
}

fn jitter(limit: Duration) -> Duration {
    use std::hash::{BuildHasher, Hasher};

    let nanos = u64::try_from(limit.as_nanos()).unwrap_or(u64::MAX);
    if nanos == 0 {
        return Duration::ZERO;
    }

    let mut hasher = std::collections::hash_map::RandomState::new().build_hasher();
    hasher.write_u64(nanos);
    Duration::from_nanos(hasher.finish() % nanos)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UploadSettings {
    /// Parts uploaded at once per upload, further limited by `UploadLimits::max_concurrency`.
    pub part_concurrency: u32,
    /// Smallest size for parts after the first, raised to the backend's minimum when lower.
    pub min_part_size: u64,
    /// Bytes that all uploads sharing this uploader may hold in part buffers at once.
    pub memory_budget_bytes: u64,
    /// Objects up to this size are written with a single request.
    pub single_request_threshold: u64,
    pub retry: RetryPolicy,
}

impl Default for UploadSettings {
    fn default() -> Self {
        Self {
            part_concurrency: 4,
            min_part_size: 16 * MIB,
            memory_budget_bytes: GIB,
            single_request_threshold: SINGLE_REQUEST_THRESHOLD,
            retry: RetryPolicy::default(),
        }
    }
}

/// Chooses part sizes for one upload.
///
/// The first part doubles as the probe that decides between a single request and a multipart
/// upload, so it is just over the single-request threshold. Later parts are sized from the size
/// hint so that the hinted size fills about 90% of `max_parts`. Without a hint, or once the
/// stream has outgrown the hint, sizes double every `max_parts / 10` parts. Parts never exceed
/// the memory budget's main pool (unless the backend's minimum does), so a bogus hint can't
/// inflate buffers.
#[derive(Debug, Clone)]
pub struct PartSizer {
    head: u64,
    min: u64,
    max: u64,
    growth_step: u32,
    hint: Option<(u64, u64)>,
}

impl PartSizer {
    pub fn new(limits: &UploadLimits, settings: &UploadSettings, size_hint: Option<u64>) -> Self {
        let alignment = limits.part_alignment.max(1);
        let provider_max = align_down(limits.max_part_size, alignment).max(alignment);
        let provider_min = align_up(limits.min_part_size.max(1), alignment).min(provider_max);
        let min = align_up(settings.min_part_size.max(provider_min), alignment).min(provider_max);
        let main_pool = BudgetSplit::of(settings.memory_budget_bytes).main_bytes();
        let max = provider_max.min(align_down(main_pool, alignment)).max(min);

        let head = align_up(
            settings
                .single_request_threshold
                .saturating_add(1)
                .max(provider_min),
            alignment,
        )
        .min(provider_max);

        let hint = size_hint.map(|hint| {
            let hint = hint.min(limits.max_object_size);
            let target_parts = (limits.max_parts as u64 * 9 / 10).max(1);
            let part = align_up(align_up(hint.div_ceil(target_parts), MIB), alignment);
            (hint, part.clamp(min, max))
        });

        Self {
            head,
            min,
            max,
            growth_step: (limits.max_parts / 10).max(1),
            hint,
        }
    }

    pub fn head_size(&self) -> u64 {
        self.head
    }

    /// Size of the part at 0-based `index`, after `uploaded` bytes have been cut.
    pub fn part_size(&self, index: u32, uploaded: u64) -> u64 {
        if index == 0 {
            return self.head;
        }

        match self.hint {
            Some((hint, part)) if uploaded < hint => part,
            Some((_, part)) => part.max(self.grown(index)),
            None => self.grown(index),
        }
    }

    /// Bytes a part of `size` starting at `offset` will hold if the size hint is right.
    pub fn expected_part_size(&self, size: u64, offset: u64) -> u64 {
        match self.hint {
            Some((hint, _)) if hint > offset => (hint - offset).min(size),
            _ => size,
        }
    }

    fn grown(&self, index: u32) -> u64 {
        let doublings = index / self.growth_step;
        if doublings >= u64::BITS {
            return self.max;
        }

        self.min
            .checked_mul(1u64 << doublings)
            .map_or(self.max, |size| size.min(self.max))
    }
}

fn align_up(value: u64, alignment: u64) -> u64 {
    value
        .checked_next_multiple_of(alignment)
        .unwrap_or_else(|| align_down(u64::MAX, alignment))
}

fn align_down(value: u64, alignment: u64) -> u64 {
    value - value % alignment
}

fn to_usize(value: u64) -> usize {
    usize::try_from(value).unwrap_or(usize::MAX)
}

fn budget_units(bytes: u64) -> u64 {
    bytes.div_ceil(BUDGET_UNIT)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct BudgetSplit {
    incremental: u32,
    main: u32,
}

impl BudgetSplit {
    fn of(budget_bytes: u64) -> Self {
        let total = (budget_bytes / BUDGET_UNIT).clamp(1, u32::MAX as u64) as u32;
        let incremental = total / INCREMENTAL_SHARE as u32;

        Self {
            incremental,
            main: total - incremental,
        }
    }

    fn main_bytes(&self) -> u64 {
        self.main as u64 * BUDGET_UNIT
    }

    fn total_bytes(&self) -> u64 {
        (self.incremental as u64 + self.main as u64) * BUDGET_UNIT
    }
}

/// The memory budget, in two pools. A part buffer first grows in small steps from the
/// incremental pool, which is only ever taken without waiting. Once that pool is out, or the
/// buffer passes `INCREMENTAL_LIMIT`, the rest of the part comes from the main pool in one piece,
/// and is waited for while holding incremental permits at most. No upload ever waits on a pool it
/// already holds, so uploads can't deadlock each other by each holding part of what the others
/// need, and uploads that trickle in stay out of the main pool while the incremental one lasts.
#[derive(Debug)]
struct Budget {
    split: BudgetSplit,
    incremental: Arc<Semaphore>,
    main: Arc<Semaphore>,
    reserved: AtomicU64,
    peak: AtomicU64,
}

impl Budget {
    fn new(budget_bytes: u64) -> Self {
        let split = BudgetSplit::of(budget_bytes);

        Self {
            split,
            incremental: Arc::new(Semaphore::new(split.incremental as usize)),
            main: Arc::new(Semaphore::new(split.main as usize)),
            reserved: AtomicU64::new(0),
            peak: AtomicU64::new(0),
        }
    }

    fn track(&self, units: u32) {
        let bytes = units as u64 * BUDGET_UNIT;
        let reserved = self.reserved.fetch_add(bytes, Ordering::Relaxed) + bytes;
        self.peak.fetch_max(reserved, Ordering::Relaxed);
    }

    fn untrack(&self, permit: Option<OwnedSemaphorePermit>) {
        if let Some(permit) = permit {
            let bytes = permit.num_permits() as u64 * BUDGET_UNIT;
            self.reserved.fetch_sub(bytes, Ordering::Relaxed);
        }
    }
}

/// The budget held for one part buffer, from its first byte until the backend has confirmed the
/// part. It grows with the buffer: by doubling from the incremental pool up to
/// `INCREMENTAL_LIMIT`, then to the bytes the part is expected to hold, from the main pool.
pub(crate) struct Reservation {
    budget: Arc<Budget>,
    incremental: Option<OwnedSemaphorePermit>,
    main: Option<OwnedSemaphorePermit>,
    expected: u64,
    limit: u64,
}

impl Reservation {
    fn new(budget: Arc<Budget>, expected: u64, limit: u64) -> Self {
        Self {
            budget,
            incremental: None,
            main: None,
            expected: expected.clamp(1, limit.max(1)),
            limit: limit.max(1),
        }
    }

    fn held(permit: &Option<OwnedSemaphorePermit>) -> u64 {
        permit
            .as_ref()
            .map_or(0, |permit| permit.num_permits() as u64)
    }

    /// Reserves enough for a buffer that has to hold `needed` bytes and currently has room for
    /// `capacity`, and returns the capacity to grow the buffer to.
    pub(crate) async fn grow(&mut self, needed: u64, capacity: u64) -> BackendResult<u64> {
        let needed = needed.min(self.limit);
        let whole = if needed <= self.expected {
            self.expected
        } else {
            self.limit
        };

        if self.main.is_none() && needed <= INCREMENTAL_LIMIT {
            let doubled = capacity.saturating_mul(2).max(INITIAL_BUFFER);
            let target = doubled.min(whole).min(INCREMENTAL_LIMIT).max(needed);

            if self.take_incremental(target) {
                return Ok(target);
            }
        }

        self.take_main(whole).await?;
        Ok(whole)
    }

    fn take_incremental(&mut self, bytes: u64) -> bool {
        let held = Self::held(&self.incremental);
        let wanted = budget_units(bytes);
        if wanted <= held {
            return true;
        }
        if wanted > self.budget.split.incremental as u64 {
            return false;
        }

        let additional = (wanted - held) as u32;
        let Ok(permit) = self
            .budget
            .incremental
            .clone()
            .try_acquire_many_owned(additional)
        else {
            return false;
        };

        self.budget.track(additional);
        match &mut self.incremental {
            Some(held) => held.merge(permit),
            None => self.incremental = Some(permit),
        }
        true
    }

    // A part larger than the whole main pool takes all of it rather than waiting forever. A part
    // that outgrows its size hint tops up what it holds if that is free; otherwise it gives the
    // main permits back before waiting, so it briefly holds more data than it has reserved.
    async fn take_main(&mut self, bytes: u64) -> BackendResult<()> {
        let wanted = budget_units(bytes).clamp(1, self.budget.split.main as u64) as u32;
        let held = Self::held(&self.main) as u32;
        if wanted <= held {
            return Ok(());
        }

        if let Some(main) = &mut self.main {
            if let Ok(permit) = self
                .budget
                .main
                .clone()
                .try_acquire_many_owned(wanted - held)
            {
                self.budget.track(wanted - held);
                main.merge(permit);
                return Ok(());
            }
        }

        self.budget.untrack(self.main.take());

        let permit = self
            .budget
            .main
            .clone()
            .acquire_many_owned(wanted)
            .await
            .map_err(|_| budget_closed())?;

        self.budget.untrack(self.incremental.take());
        self.budget.track(wanted);
        self.main = Some(permit);
        Ok(())
    }
}

impl Drop for Reservation {
    fn drop(&mut self) {
        self.budget.untrack(self.incremental.take());
        self.budget.untrack(self.main.take());
    }
}

fn budget_closed() -> BackendError {
    BackendError::Internal("upload memory budget is closed".to_string())
}

/// Streams objects into a backend: one request for small objects, otherwise a multipart upload
/// with parallel, retried parts. Every part buffer is covered by a memory budget shared by all
/// uploads that use the same `Uploader`, from its first byte until the backend has confirmed it,
/// so concurrent uploads wait for memory instead of exhausting it. A buffer's reservation grows
/// with the data that actually arrived, so slow or small uploads hold little of the budget.
pub struct Uploader {
    settings: UploadSettings,
    budget: Arc<Budget>,
}

impl Default for Uploader {
    fn default() -> Self {
        Self::new(UploadSettings::default())
    }
}

impl std::fmt::Debug for Uploader {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Uploader")
            .field("settings", &self.settings)
            .field("reserved_bytes", &self.reserved_bytes())
            .finish()
    }
}

impl Uploader {
    pub fn new(settings: UploadSettings) -> Self {
        let budget = Arc::new(Budget::new(settings.memory_budget_bytes));
        Self { settings, budget }
    }

    pub fn settings(&self) -> &UploadSettings {
        &self.settings
    }

    pub fn budget_bytes(&self) -> u64 {
        self.budget.split.total_bytes()
    }

    pub fn reserved_bytes(&self) -> u64 {
        self.budget.reserved.load(Ordering::Relaxed)
    }

    pub fn peak_reserved_bytes(&self) -> u64 {
        self.budget.peak.load(Ordering::Relaxed)
    }

    fn reservation(&self, sizer: &PartSizer, size: u64, offset: u64) -> Reservation {
        Reservation::new(
            self.budget.clone(),
            sizer.expected_part_size(size, offset),
            size,
        )
    }

    #[tracing::instrument(level = "debug", skip_all, fields(key = %key, size_hint = ?opts.size_hint))]
    pub async fn upload<B>(
        &self,
        backend: &B,
        key: &str,
        stream: ByteStream,
        opts: PutOptions,
    ) -> BackendResult<UploadedObject>
    where
        B: Backend + ?Sized,
    {
        let limits = backend.upload_limits();
        let sizer = PartSizer::new(&limits, &self.settings, opts.size_hint);
        let mut input = ChunkedUpload::new(stream);

        let mut head_reservation = self.reservation(&sizer, sizer.head_size(), 0);
        let head = input
            .next_part_within(to_usize(sizer.head_size()), &mut head_reservation)
            .await?;

        let metadata = if head.len() as u64 <= self.settings.single_request_threshold
            && input.is_exhausted().await?
        {
            let metadata = with_retries(&self.settings.retry, || {
                backend.put_single(key, head.clone(), &opts)
            })
            .await?;
            drop(head);
            drop(head_reservation);
            metadata
        } else {
            let upload =
                with_retries(&self.settings.retry, || backend.start_multipart(key, &opts)).await?;

            let concurrency = self
                .settings
                .part_concurrency
                .min(limits.max_concurrency)
                .max(1) as usize;
            let mut session = PartSession::new(upload, concurrency);

            debug!(
                "Starting multipart upload of {} (first part {} bytes, {} in parallel)",
                key,
                head.len(),
                concurrency
            );

            let completed = match self
                .upload_parts(
                    &mut session,
                    &limits,
                    &sizer,
                    &mut input,
                    head,
                    head_reservation,
                )
                .await
            {
                Ok(parts) => {
                    self.complete(backend, key, session.upload.clone(), parts)
                        .await
                }
                Err(error) => Err(error),
            };

            match completed {
                Ok(metadata) => {
                    session.settled = true;
                    metadata
                }
                Err(error) => {
                    warn!("Aborting multipart upload of {}: {}", key, error);
                    session.abort().await;
                    return Err(error);
                }
            }
        };

        Ok(UploadedObject {
            metadata: ObjectMetadata {
                size: input.total_size(),
                ..metadata
            },
            sha256: input.sha256(),
        })
    }

    async fn upload_parts(
        &self,
        session: &mut PartSession,
        limits: &UploadLimits,
        sizer: &PartSizer,
        input: &mut ChunkedUpload,
        head: Bytes,
        head_reservation: Reservation,
    ) -> BackendResult<Vec<PartReceipt>> {
        let mut next = Some((head, head_reservation));
        let mut number: u64 = 1;
        let mut offset: u64 = 0;

        loop {
            let (data, reservation) = match next.take() {
                Some(part) => part,
                None => {
                    if session.race(input.is_exhausted()).await? {
                        break;
                    }

                    if number > limits.max_parts as u64 {
                        return Err(BackendError::TooLarge(format!(
                            "the object needs more than the backend's {} parts ({} bytes uploaded); \
                             pass a size hint or raise uploads.memory_budget_bytes",
                            limits.max_parts, offset
                        )));
                    }

                    let size = sizer.part_size((number - 1) as u32, offset);
                    let mut reservation = self.reservation(sizer, size, offset);
                    let data = session
                        .race(input.next_part_within(to_usize(size), &mut reservation))
                        .await?;
                    (data, reservation)
                }
            };

            let end = offset + data.len() as u64;
            if end > limits.max_object_size {
                return Err(BackendError::TooLarge(format!(
                    "the object exceeds the backend's maximum of {} bytes",
                    limits.max_object_size
                )));
            }

            session.wait_for_slot().await?;
            session.spawn(
                number as u32,
                offset,
                data,
                reservation,
                self.settings.retry,
            );

            offset = end;
            number += 1;
        }

        session.join_all().await
    }

    async fn complete<B>(
        &self,
        backend: &B,
        key: &str,
        upload: Arc<dyn MultipartUpload>,
        parts: Vec<PartReceipt>,
    ) -> BackendResult<ObjectMetadata>
    where
        B: Backend + ?Sized,
    {
        let size: u64 = parts.iter().map(|part| part.size).sum();
        debug!(
            "Completing multipart upload: {} parts, {} bytes",
            parts.len(),
            size
        );

        let mut attempts = 0;
        let completed = with_retries(&self.settings.retry, || {
            attempts += 1;
            upload.complete(parts.clone())
        })
        .await;

        match completed {
            Err(BackendError::NotFound(gone)) => {
                if attempts > 1 {
                    if let Some(metadata) = self.committed_unseen(backend, key, size).await {
                        return Ok(metadata);
                    }
                }
                Err(BackendError::Provider(gone))
            }
            completed => completed,
        }
    }

    /// The object an earlier `complete` committed even though its response never arrived: the
    /// backend no longer knows the upload, and the key holds an object of the uploaded size.
    async fn committed_unseen<B>(&self, backend: &B, key: &str, size: u64) -> Option<ObjectMetadata>
    where
        B: Backend + ?Sized,
    {
        match with_retries(&self.settings.retry, || backend.head_object(key)).await {
            Ok(metadata) if metadata.size == size => {
                warn!(
                    "An earlier attempt to complete the upload of {} committed it; its response \
                     was lost",
                    key
                );
                Some(metadata)
            }
            Ok(metadata) => {
                warn!(
                    "The upload of {} is gone and the key holds {} bytes, not the {} uploaded",
                    key, metadata.size, size
                );
                None
            }
            Err(error) => {
                warn!(
                    "The upload of {} is gone and its object can't be read: {}",
                    key, error
                );
                None
            }
        }
    }
}

/// The parts of one multipart upload in flight. Dropped before it is settled (the upload future
/// was cancelled), it stops the part tasks and aborts the upload in the background.
struct PartSession {
    upload: Arc<dyn MultipartUpload>,
    tasks: JoinSet<BackendResult<PartReceipt>>,
    receipts: Vec<PartReceipt>,
    concurrency: usize,
    settled: bool,
}

impl PartSession {
    fn new(upload: Arc<dyn MultipartUpload>, concurrency: usize) -> Self {
        Self {
            upload,
            tasks: JoinSet::new(),
            receipts: Vec::new(),
            concurrency,
            settled: false,
        }
    }

    fn record(
        &mut self,
        joined: Option<Result<BackendResult<PartReceipt>, JoinError>>,
    ) -> BackendResult<()> {
        match joined {
            None => Ok(()),
            Some(Ok(Ok(receipt))) => {
                self.receipts.push(receipt);
                Ok(())
            }
            Some(Ok(Err(error))) => Err(error),
            Some(Err(error)) => Err(BackendError::Internal(format!(
                "part upload task failed: {}",
                error
            ))),
        }
    }

    /// Runs `operation` while collecting finished parts, and gives up on it as soon as a part
    /// fails for good.
    async fn race<T>(
        &mut self,
        operation: impl Future<Output = BackendResult<T>>,
    ) -> BackendResult<T> {
        tokio::pin!(operation);

        loop {
            if self.tasks.is_empty() {
                return operation.await;
            }

            tokio::select! {
                biased;
                joined = self.tasks.join_next() => self.record(joined)?,
                result = &mut operation => return result,
            }
        }
    }

    async fn wait_for_slot(&mut self) -> BackendResult<()> {
        while self.tasks.len() >= self.concurrency {
            let joined = self.tasks.join_next().await;
            self.record(joined)?;
        }
        Ok(())
    }

    fn spawn(
        &mut self,
        number: u32,
        offset: u64,
        data: Bytes,
        reservation: Reservation,
        retry: RetryPolicy,
    ) {
        let upload = self.upload.clone();

        self.tasks.spawn(async move {
            let result =
                with_retries(&retry, || upload.upload_part(number, offset, data.clone())).await;
            drop(data);
            drop(reservation);
            result
        });
    }

    async fn join_all(&mut self) -> BackendResult<Vec<PartReceipt>> {
        while let Some(joined) = self.tasks.join_next().await {
            self.record(Some(joined))?;
        }

        let mut parts = std::mem::take(&mut self.receipts);
        parts.sort_by_key(|part| part.number);
        Ok(parts)
    }

    async fn abort(&mut self) {
        self.settled = true;
        self.tasks.shutdown().await;
        self.upload.abort().await;
    }
}

impl Drop for PartSession {
    fn drop(&mut self) {
        if self.settled {
            return;
        }

        let mut tasks = std::mem::take(&mut self.tasks);
        let upload = self.upload.clone();

        match tokio::runtime::Handle::try_current() {
            Ok(runtime) => {
                runtime.spawn(async move {
                    tasks.shutdown().await;
                    upload.abort().await;
                });
            }
            Err(_) => warn!("Upload cancelled outside a runtime; it cannot be aborted"),
        }
    }
}

async fn with_retries<T, F, Fut>(policy: &RetryPolicy, mut operation: F) -> BackendResult<T>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = BackendResult<T>>,
{
    let mut attempt = 1;

    loop {
        match operation().await {
            Err(error) if error.is_retryable() && attempt < policy.max_attempts => {
                let delay = policy.delay(attempt);
                warn!(
                    "Retrying in {:?} after attempt {} of {} failed: {}",
                    delay, attempt, policy.max_attempts, error
                );
                tokio::time::sleep(delay).await;
                attempt += 1;
            }
            result => return result,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::multipart::TIB;

    const MAIN_POOL: u64 = 896 * MIB;

    const S3: UploadLimits = UploadLimits {
        min_part_size: 5 * MIB,
        max_part_size: 5 * GIB,
        max_parts: 10_000,
        part_alignment: 1,
        max_concurrency: u32::MAX,
        max_object_size: 5 * TIB,
    };

    const AZURE: UploadLimits = UploadLimits {
        min_part_size: 1,
        max_part_size: 4000 * MIB,
        max_parts: 50_000,
        part_alignment: 1,
        max_concurrency: u32::MAX,
        max_object_size: 50_000 * 4000 * MIB,
    };

    const GCS: UploadLimits = UploadLimits {
        min_part_size: 256 * KIB,
        max_part_size: 5 * TIB,
        max_parts: u32::MAX,
        part_alignment: 256 * KIB,
        max_concurrency: 1,
        max_object_size: 5 * TIB,
    };

    fn sizer(limits: &UploadLimits, hint: Option<u64>) -> PartSizer {
        PartSizer::new(limits, &UploadSettings::default(), hint)
    }

    /// Cuts `total` bytes the way the driver does and checks every part against the limits.
    fn cut(
        limits: &UploadLimits,
        settings: &UploadSettings,
        hint: Option<u64>,
        total: u64,
    ) -> Vec<u64> {
        let sizer = PartSizer::new(limits, settings, hint);
        let effective_min = settings.min_part_size.max(limits.min_part_size);
        let mut parts = Vec::new();
        let mut uploaded = 0u64;

        while uploaded < total {
            let index = parts.len() as u32;
            let size = sizer.part_size(index, uploaded).min(total - uploaded);
            parts.push(size);
            uploaded += size;
        }

        let last = parts.len() - 1;
        for (index, &size) in parts.iter().enumerate() {
            assert!(
                size <= limits.max_part_size,
                "part {} too large: {}",
                index,
                size
            );
            if index == last {
                continue;
            }
            assert!(
                size >= limits.min_part_size,
                "part {} below the provider minimum",
                index
            );
            assert_eq!(
                size % limits.part_alignment,
                0,
                "part {} is not aligned",
                index
            );
            if index > 0 {
                assert!(
                    size >= effective_min,
                    "part {} below the configured minimum",
                    index
                );
            }
        }

        parts
    }

    fn fits(limits: &UploadLimits, hint: Option<u64>, total: u64) -> usize {
        let parts = cut(limits, &UploadSettings::default(), hint, total);
        assert!(
            parts.len() <= limits.max_parts as usize,
            "{} bytes (hint {:?}) needs {} parts",
            total,
            hint,
            parts.len()
        );
        parts.len()
    }

    #[test]
    fn starts_just_past_the_single_request_threshold() {
        assert_eq!(sizer(&S3, None).head_size(), 8 * MIB + 1);
        assert_eq!(sizer(&AZURE, Some(10 * GIB)).head_size(), 8 * MIB + 1);
        assert_eq!(sizer(&GCS, None).head_size(), 8 * MIB + 256 * KIB);
        assert_eq!(sizer(&S3, None).part_size(0, 0), 8 * MIB + 1);
    }

    #[test]
    fn grows_parts_without_a_hint() {
        let s3 = sizer(&S3, None);
        assert_eq!(s3.part_size(1, 0), 16 * MIB);
        assert_eq!(s3.part_size(999, 0), 16 * MIB);
        assert_eq!(s3.part_size(1000, 0), 32 * MIB);
        assert_eq!(s3.part_size(5999, 0), 512 * MIB);
        assert_eq!(s3.part_size(6000, 0), MAIN_POOL);
        assert_eq!(s3.part_size(9999, 0), MAIN_POOL);
        assert_eq!(s3.part_size(u32::MAX, 0), MAIN_POOL);

        for total in [
            100 * MIB,
            10 * GIB,
            200 * GIB,
            TIB,
            4 * TIB,
            4 * TIB + 350 * GIB,
        ] {
            fits(&S3, None, total);
        }
    }

    #[test]
    fn does_not_grow_parts_where_the_part_count_is_unbounded() {
        let gcs = sizer(&GCS, None);
        assert_eq!(gcs.part_size(1, 0), 16 * MIB);
        assert_eq!(gcs.part_size(100_000, 0), 16 * MIB);
        assert_eq!(gcs.part_size(u32::MAX, 0), MAIN_POOL);

        let local = sizer(&UploadLimits::UNBOUNDED, None);
        assert_eq!(local.part_size(1_000_000, 0), 16 * MIB);
    }

    #[test]
    fn sizes_parts_from_the_hint() {
        assert_eq!(sizer(&S3, Some(200 * GIB)).part_size(1, 0), 23 * MIB);
        assert_eq!(sizer(&S3, Some(500 * GIB)).part_size(1, 0), 57 * MIB);
        assert_eq!(sizer(&S3, Some(TIB)).part_size(1, 0), 117 * MIB);
        assert_eq!(sizer(&S3, Some(5 * TIB)).part_size(1, 0), 583 * MIB);

        for total in [200 * GIB, 500 * GIB, TIB, 4 * TIB + 900 * GIB, 5 * TIB] {
            let parts = fits(&S3, Some(total), total);
            assert!(parts <= 9_001, "{} bytes took {} parts", total, parts);
        }
    }

    #[test]
    fn never_sizes_below_the_minimum() {
        for hint in [0, 1, 8 * MIB, 100 * MIB] {
            assert_eq!(sizer(&S3, Some(hint)).part_size(1, 0), 16 * MIB);
            assert_eq!(sizer(&AZURE, Some(hint)).part_size(1, 0), 16 * MIB);
        }

        let settings = UploadSettings {
            min_part_size: MIB,
            ..UploadSettings::default()
        };
        assert_eq!(
            PartSizer::new(&S3, &settings, None).part_size(1, 0),
            5 * MIB
        );
        assert_eq!(
            PartSizer::new(&S3, &settings, Some(0)).part_size(5, 0),
            5 * MIB
        );
    }

    #[test]
    fn caps_untrusted_hints() {
        let huge = sizer(&S3, Some(u64::MAX));
        assert_eq!(huge.part_size(1, 0), 583 * MIB);
        assert_eq!(sizer(&S3, Some(6 * TIB)).part_size(1, 0), 583 * MIB);
        fits(&S3, Some(u64::MAX), 5 * TIB);
        fits(&S3, Some(u64::MAX), 20 * MIB);

        let unbounded = sizer(&UploadLimits::UNBOUNDED, Some(u64::MAX));
        assert_eq!(unbounded.part_size(1, 0), MAIN_POOL);
        assert_eq!(unbounded.part_size(u32::MAX, u64::MAX), MAIN_POOL);

        let small_budget = UploadSettings {
            memory_budget_bytes: 64 * MIB,
            ..UploadSettings::default()
        };
        assert_eq!(
            PartSizer::new(&S3, &small_budget, Some(5 * TIB)).part_size(1, 0),
            56 * MIB
        );
        assert_eq!(
            PartSizer::new(&S3, &small_budget, None).part_size(9_999, 0),
            56 * MIB
        );
    }

    #[test]
    fn grows_past_a_hint_that_was_too_small() {
        let lying = sizer(&S3, Some(GIB));
        assert_eq!(lying.part_size(1, 0), 16 * MIB);
        assert_eq!(lying.part_size(5000, 2 * GIB), 512 * MIB);

        fits(&S3, Some(GIB), 4 * TIB);
        fits(&S3, Some(0), TIB);
        fits(&S3, Some(4 * TIB), 4 * TIB + 800 * GIB);
        fits(&S3, Some(200 * GIB), TIB);
        fits(&AZURE, Some(GIB), 10 * TIB);
    }

    #[test]
    fn fits_large_objects_in_azure_blocks() {
        assert_eq!(sizer(&AZURE, Some(10 * TIB)).part_size(1, 0), 234 * MIB);
        fits(&AZURE, Some(10 * TIB), 10 * TIB);
        fits(&AZURE, Some(40 * TIB), 40 * TIB);
        fits(&AZURE, None, 10 * TIB);
    }

    #[test]
    fn aligns_gcs_chunks() {
        let settings = UploadSettings {
            min_part_size: MIB + 1,
            ..UploadSettings::default()
        };
        let gcs = PartSizer::new(&GCS, &settings, None);
        assert_eq!(gcs.part_size(1, 0), MIB + 256 * KIB);

        let hinted = PartSizer::new(&GCS, &settings, Some(3 * GIB + 7));
        assert_eq!(hinted.part_size(1, 0) % (256 * KIB), 0);

        cut(&GCS, &settings, None, 50 * MIB + 3);
        cut(&GCS, &UploadSettings::default(), Some(TIB), TIB);
    }

    #[test]
    fn falls_back_to_the_minimum_when_the_budget_is_smaller() {
        let tiny = UploadSettings {
            memory_budget_bytes: MIB,
            ..UploadSettings::default()
        };
        let s3 = PartSizer::new(&S3, &tiny, Some(5 * TIB));
        assert_eq!(s3.part_size(1, 0), 16 * MIB);
        assert_eq!(s3.part_size(9_000, 0), 16 * MIB);
    }

    #[test]
    fn clamps_a_minimum_above_the_backend_maximum() {
        let limits = UploadLimits {
            max_part_size: 4 * MIB,
            ..UploadLimits::UNBOUNDED
        };
        let sizer = sizer(&limits, Some(TIB));
        assert_eq!(sizer.head_size(), 4 * MIB);
        assert_eq!(sizer.part_size(1, 0), 4 * MIB);
    }

    #[test]
    fn aligns_without_overflowing() {
        assert_eq!(
            align_up(u64::MAX, 256 * KIB),
            u64::MAX - (u64::MAX % (256 * KIB))
        );
        assert_eq!(align_up(0, 256 * KIB), 0);
        assert_eq!(align_up(1, 256 * KIB), 256 * KIB);
        assert_eq!(align_down(256 * KIB + 1, 256 * KIB), 256 * KIB);

        let limits = UploadLimits {
            max_parts: 10,
            ..UploadLimits::UNBOUNDED
        };
        assert_eq!(
            sizer(&limits, None).part_size(u32::MAX, u64::MAX),
            MAIN_POOL
        );
    }

    #[test]
    fn backs_off_exponentially_with_jitter() {
        let policy = RetryPolicy::default();

        for (attempt, full) in [
            (1, 250),
            (2, 500),
            (3, 1000),
            (5, 4000),
            (6, 8000),
            (7, 10_000),
            (40, 10_000),
        ] {
            let full = Duration::from_millis(full);
            for _ in 0..20 {
                let delay = policy.delay(attempt);
                assert!(
                    delay >= full / 2 && delay <= full,
                    "attempt {}: {:?}",
                    attempt,
                    delay
                );
            }
        }
    }

    fn budgeted(budget: u64) -> Uploader {
        Uploader::new(UploadSettings {
            memory_budget_bytes: budget,
            ..UploadSettings::default()
        })
    }

    fn reservation(uploader: &Uploader, expected: u64, limit: u64) -> Reservation {
        Reservation::new(uploader.budget.clone(), expected, limit)
    }

    #[test]
    fn splits_the_budget_into_two_pools() {
        assert_eq!(
            BudgetSplit::of(GIB),
            BudgetSplit {
                incremental: 128 * 1024,
                main: 896 * 1024
            }
        );
        assert_eq!(BudgetSplit::of(GIB).main_bytes(), MAIN_POOL);
        assert_eq!(BudgetSplit::of(GIB).total_bytes(), GIB);
        assert_eq!(BudgetSplit::of(0).total_bytes(), KIB);
    }

    #[tokio::test]
    async fn grows_with_the_buffer_and_tracks_the_peak() {
        let uploader = budgeted(64 * MIB);
        let mut part = reservation(&uploader, 8 * MIB, 8 * MIB);

        assert_eq!(part.grow(1, 0).await.unwrap(), 4 * KIB);
        assert_eq!(uploader.reserved_bytes(), 4 * KIB);

        assert_eq!(part.grow(4 * KIB + 1, 4 * KIB).await.unwrap(), 8 * KIB);
        assert_eq!(part.grow(700 * KIB, 8 * KIB).await.unwrap(), 700 * KIB);
        assert_eq!(part.grow(700 * KIB + 1, 700 * KIB).await.unwrap(), MIB);
        assert_eq!(uploader.reserved_bytes(), MIB);

        assert_eq!(part.grow(MIB + 1, MIB).await.unwrap(), 8 * MIB);
        assert_eq!(uploader.reserved_bytes(), 8 * MIB);
        assert_eq!(uploader.budget.incremental.available_permits(), 8 * 1024);

        drop(part);
        assert_eq!(uploader.reserved_bytes(), 0);
        assert_eq!(uploader.peak_reserved_bytes(), 8 * MIB);
    }

    #[tokio::test]
    async fn reserves_no_more_than_a_small_hint() {
        let uploader = budgeted(64 * MIB);
        let mut part = reservation(&uploader, 1000, 8 * MIB + 1);

        assert_eq!(part.grow(1000, 0).await.unwrap(), 1000);
        assert_eq!(uploader.reserved_bytes(), KIB);

        assert_eq!(part.grow(1001, 1000).await.unwrap(), 4 * KIB);
    }

    #[tokio::test]
    async fn takes_the_main_pool_when_the_incremental_one_is_out() {
        let uploader = budgeted(64 * KIB);
        let mut tricklers = Vec::new();
        for _ in 0..2 {
            let mut part = reservation(&uploader, MIB, MIB);
            assert_eq!(part.grow(1, 0).await.unwrap(), 4 * KIB);
            tricklers.push(part);
        }

        let mut part = reservation(&uploader, 20 * KIB, MIB);
        assert_eq!(part.grow(1, 0).await.unwrap(), 20 * KIB);
        assert!(part.main.is_some());
        assert_eq!(uploader.reserved_bytes(), 28 * KIB);
    }

    #[tokio::test]
    async fn waits_for_the_main_pool_without_holding_it() {
        let uploader = budgeted(8 * MIB);
        let mut holder = reservation(&uploader, 7 * MIB, 7 * MIB);
        holder.grow(2 * MIB, 0).await.unwrap();

        let mut waiter = reservation(&uploader, 2 * MIB, 2 * MIB);
        assert_eq!(waiter.grow(1, 0).await.unwrap(), 4 * KIB);
        let blocked =
            tokio::time::timeout(Duration::from_millis(50), waiter.grow(MIB + 1, MIB)).await;
        assert!(blocked.is_err(), "must wait while the main pool is in use");

        drop(holder);
        assert_eq!(waiter.grow(MIB + 1, MIB).await.unwrap(), 2 * MIB);
        assert_eq!(uploader.reserved_bytes(), 2 * MIB);
    }

    #[tokio::test]
    async fn tops_up_a_part_that_outgrows_its_hint() {
        let uploader = budgeted(64 * MIB);
        let mut part = reservation(&uploader, 2 * MIB, 8 * MIB);
        part.grow(2 * MIB, 0).await.unwrap();
        assert_eq!(uploader.reserved_bytes(), 2 * MIB);

        assert_eq!(part.grow(2 * MIB + 1, 2 * MIB).await.unwrap(), 8 * MIB);
        assert_eq!(uploader.reserved_bytes(), 8 * MIB);
    }

    #[tokio::test]
    async fn caps_a_part_larger_than_the_main_pool() {
        let uploader = budgeted(8 * MIB);
        let mut part = reservation(&uploader, GIB, GIB);

        assert_eq!(part.grow(2 * MIB, 0).await.unwrap(), GIB);
        assert_eq!(uploader.reserved_bytes(), 7 * MIB);
    }
}
