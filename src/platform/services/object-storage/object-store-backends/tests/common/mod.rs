#![allow(dead_code)]

use async_trait::async_trait;
use bytes::Bytes;
use chrono::Utc;
use object_store_backends::{
    Backend, BackendError, BackendResult, ByteRange, ByteStream, MultipartUpload, ObjectData,
    ObjectMetadata, ObjectPage, ObjectRangeData, PartReceipt, PublicUrlPurpose, PutOptions,
    RetryPolicy, SignedUrl, UploadLimits, UploadSettings, Uploader, WritePrecondition,
};
use std::collections::{BTreeMap, HashMap};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::Notify;

pub const KIB: u64 = 1024;
pub const MIB: u64 = 1024 * KIB;

pub const FAKE_LIMITS: UploadLimits = UploadLimits {
    min_part_size: MIB,
    max_part_size: 64 * MIB,
    max_parts: 10_000,
    part_alignment: 1,
    max_concurrency: u32::MAX,
    max_object_size: u64::MAX,
};

pub fn fast_retries() -> RetryPolicy {
    RetryPolicy {
        max_attempts: 6,
        base_delay: Duration::from_millis(1),
        max_delay: Duration::from_millis(4),
    }
}

pub fn test_settings() -> UploadSettings {
    UploadSettings {
        part_concurrency: 4,
        min_part_size: MIB,
        memory_budget_bytes: 64 * MIB,
        single_request_threshold: MIB,
        retry: fast_retries(),
    }
}

pub fn pattern(len: usize, seed: u64) -> Vec<u8> {
    let mut state = seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1;
    let mut data = Vec::with_capacity(len);

    while data.len() < len {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        let take = (len - data.len()).min(8);
        data.extend_from_slice(&state.to_le_bytes()[..take]);
    }
    data
}

pub fn chunks_of(data: &[u8], chunk: usize) -> ByteStream {
    let chunks: Vec<_> = data
        .chunks(chunk.max(1))
        .map(|c| Ok(Bytes::copy_from_slice(c)))
        .collect();
    Box::pin(futures::stream::iter(chunks))
}

pub fn failing_after(data: &[u8], chunk: usize) -> ByteStream {
    let mut items: Vec<Result<Bytes, std::io::Error>> = data
        .chunks(chunk.max(1))
        .map(|c| Ok(Bytes::copy_from_slice(c)))
        .collect();
    items.push(Err(std::io::Error::new(
        std::io::ErrorKind::ConnectionReset,
        "client went away",
    )));
    Box::pin(futures::stream::iter(items))
}

pub fn sha256_hex(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(data))
}

#[derive(Debug, Clone, Copy)]
pub enum Failure {
    Retryable,
    Permanent,
    /// `complete` only: the object is committed, but the response is lost.
    LostResponse,
    /// `complete` only: the backend discards the upload without committing it, and the response
    /// is lost.
    Discarded,
}

impl Failure {
    fn error(self, what: &str) -> BackendError {
        match self {
            Failure::Retryable | Failure::LostResponse | Failure::Discarded => {
                BackendError::Retryable(format!("{} throttled", what))
            }
            Failure::Permanent => BackendError::Provider(format!("{} rejected", what)),
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct Faults {
    /// Part number -> (how many attempts fail, how).
    pub parts: HashMap<u32, (u32, Failure)>,
    pub part_delays: HashMap<u32, Duration>,
    pub part_delay: Duration,
    pub single: Option<(u32, Failure)>,
    pub start: Option<(u32, Failure)>,
    pub complete: Option<(u32, Failure)>,
}

#[derive(Debug, Default)]
pub struct Calls {
    pub single_puts: u32,
    pub single_attempts: u32,
    pub starts: u32,
    pub start_attempts: u32,
    pub completes: u32,
    pub complete_attempts: u32,
    pub aborts: u32,
    pub part_attempts: HashMap<u32, u32>,
    pub completed_parts: Vec<Vec<PartReceipt>>,
    pub size_hints: Vec<Option<u64>>,
}

#[derive(Default)]
pub struct FakeState {
    pub calls: Mutex<Calls>,
    pub objects: Mutex<HashMap<String, (ObjectMetadata, Bytes)>>,
    pub faults: Mutex<Faults>,
    pub parts_in_flight: AtomicUsize,
    pub max_parts_in_flight: AtomicUsize,
    pub bytes_in_flight: AtomicU64,
    pub max_bytes_in_flight: AtomicU64,
    pub bytes_received: AtomicU64,
    pub part_started: Notify,
}

impl FakeState {
    pub fn calls(&self) -> std::sync::MutexGuard<'_, Calls> {
        self.calls.lock().unwrap()
    }

    pub fn object(&self, key: &str) -> Option<(ObjectMetadata, Bytes)> {
        self.objects.lock().unwrap().get(key).cloned()
    }

    pub fn faults(&self) -> std::sync::MutexGuard<'_, Faults> {
        self.faults.lock().unwrap()
    }

    fn should_fail(slot: &mut Option<(u32, Failure)>) -> Option<Failure> {
        match slot {
            Some((remaining, failure)) if *remaining > 0 => {
                *remaining -= 1;
                Some(*failure)
            }
            _ => None,
        }
    }
}

/// An in-memory backend that checks every multipart upload against its limits. With `keep_data`
/// off it only counts bytes, so arbitrarily large uploads can be pushed through it.
pub struct FakeBackend {
    pub uploader: Arc<Uploader>,
    pub limits: UploadLimits,
    pub state: Arc<FakeState>,
    pub keep_data: bool,
}

impl FakeBackend {
    pub fn new(settings: UploadSettings) -> Self {
        Self::with_uploader(Arc::new(Uploader::new(settings)))
    }

    pub fn with_uploader(uploader: Arc<Uploader>) -> Self {
        Self {
            uploader,
            limits: FAKE_LIMITS,
            state: Arc::default(),
            keep_data: true,
        }
    }

    pub fn limits(mut self, limits: UploadLimits) -> Self {
        self.limits = limits;
        self
    }

    pub fn discarding(mut self) -> Self {
        self.keep_data = false;
        self
    }

    fn metadata(&self, key: &str, size: u64, opts: &PutOptions) -> ObjectMetadata {
        ObjectMetadata {
            key: key.to_string(),
            size,
            content_type: opts.content_type.clone(),
            etag: uuid::Uuid::new_v4().simple().to_string(),
            last_modified: Utc::now(),
            custom_metadata: opts.metadata.clone(),
        }
    }
}

struct InFlight<'a>(&'a FakeState, u64);

impl<'a> InFlight<'a> {
    fn enter(state: &'a FakeState, bytes: u64) -> Self {
        let parts = state.parts_in_flight.fetch_add(1, Ordering::SeqCst) + 1;
        state.max_parts_in_flight.fetch_max(parts, Ordering::SeqCst);
        let held = state.bytes_in_flight.fetch_add(bytes, Ordering::SeqCst) + bytes;
        state.max_bytes_in_flight.fetch_max(held, Ordering::SeqCst);
        Self(state, bytes)
    }
}

impl Drop for InFlight<'_> {
    fn drop(&mut self) {
        self.0.parts_in_flight.fetch_sub(1, Ordering::SeqCst);
        self.0.bytes_in_flight.fetch_sub(self.1, Ordering::SeqCst);
    }
}

pub struct FakeUpload {
    key: String,
    metadata: ObjectMetadata,
    limits: UploadLimits,
    state: Arc<FakeState>,
    keep_data: bool,
    parts: Mutex<BTreeMap<u32, (u64, Bytes)>>,
    /// Completed or discarded; like S3, the backend no longer knows the upload.
    gone: AtomicBool,
}

#[async_trait]
impl MultipartUpload for FakeUpload {
    async fn upload_part(
        &self,
        number: u32,
        offset: u64,
        data: Bytes,
    ) -> BackendResult<PartReceipt> {
        let size = data.len() as u64;
        let _in_flight = InFlight::enter(&self.state, size);
        self.state.part_started.notify_waiters();

        let (failure, delay) = {
            let mut calls = self.state.calls();
            *calls.part_attempts.entry(number).or_default() += 1;

            let mut faults = self.state.faults();
            let delay = faults
                .part_delays
                .get(&number)
                .copied()
                .unwrap_or(faults.part_delay);
            let failure = faults
                .parts
                .get_mut(&number)
                .and_then(|(remaining, failure)| {
                    (*remaining > 0).then(|| {
                        *remaining -= 1;
                        *failure
                    })
                });
            (failure, delay)
        };

        if !delay.is_zero() {
            tokio::time::sleep(delay).await;
        }

        if let Some(failure) = failure {
            return Err(failure.error(&format!("part {}", number)));
        }

        if size > self.limits.max_part_size {
            return Err(BackendError::Provider(format!(
                "part {} is {} bytes, over the maximum",
                number, size
            )));
        }

        self.state.bytes_received.fetch_add(size, Ordering::SeqCst);
        let stored = if self.keep_data { data } else { Bytes::new() };
        self.parts.lock().unwrap().insert(number, (offset, stored));

        Ok(PartReceipt {
            number,
            offset,
            size,
            etag: Some(format!("part-{}", number)),
        })
    }

    async fn complete(&self, parts: Vec<PartReceipt>) -> BackendResult<ObjectMetadata> {
        let failure = {
            let mut calls = self.state.calls();
            calls.complete_attempts += 1;
            FakeState::should_fail(&mut self.state.faults().complete)
        };
        if self.gone.load(Ordering::SeqCst) {
            return Err(BackendError::NotFound(format!("upload of {}", self.key)));
        }
        match failure {
            Some(Failure::LostResponse) | None => {}
            Some(Failure::Discarded) => {
                self.gone.store(true, Ordering::SeqCst);
                return Err(Failure::Discarded.error("complete"));
            }
            Some(failure) => return Err(failure.error("complete")),
        }

        let uploaded = self.parts.lock().unwrap().clone();
        let mut expected_offset = 0;
        let mut data = Vec::new();

        for (index, part) in parts.iter().enumerate() {
            let invalid = |reason: &str| {
                Err(BackendError::Internal(format!(
                    "invalid part {} ({:?}): {}",
                    index, part, reason
                )))
            };

            if part.number != index as u32 + 1 {
                return invalid("numbers are not contiguous");
            }
            if part.offset != expected_offset {
                return invalid("offsets are not contiguous");
            }

            let is_final = index + 1 == parts.len();
            if !is_final && part.size < self.limits.min_part_size {
                return invalid("non-final part is under the minimum size");
            }
            if !is_final && !part.size.is_multiple_of(self.limits.part_alignment) {
                return invalid("non-final part is not aligned");
            }

            match uploaded.get(&part.number) {
                Some((offset, _)) if *offset != part.offset => return invalid("offset mismatch"),
                Some((_, bytes)) if self.keep_data && bytes.len() as u64 != part.size => {
                    return invalid("size mismatch")
                }
                Some((_, bytes)) => data.extend_from_slice(bytes),
                None => return invalid("part was never uploaded"),
            }

            expected_offset += part.size;
        }

        if parts.len() as u64 > self.limits.max_parts as u64 {
            return Err(BackendError::Internal("too many parts".to_string()));
        }

        let metadata = ObjectMetadata {
            size: expected_offset,
            ..self.metadata.clone()
        };

        {
            let mut calls = self.state.calls();
            calls.completes += 1;
            calls.completed_parts.push(parts);
        }

        self.state
            .objects
            .lock()
            .unwrap()
            .insert(self.key.clone(), (metadata.clone(), Bytes::from(data)));
        self.gone.store(true, Ordering::SeqCst);

        if let Some(failure @ Failure::LostResponse) = failure {
            return Err(failure.error("complete"));
        }
        Ok(metadata)
    }

    async fn abort(&self) {
        self.state.calls().aborts += 1;
    }
}

#[async_trait]
impl Backend for FakeBackend {
    async fn init(&self) -> BackendResult<()> {
        Ok(())
    }

    fn uploader(&self) -> &Uploader {
        &self.uploader
    }

    fn upload_limits(&self) -> UploadLimits {
        self.limits
    }

    async fn put_single(
        &self,
        key: &str,
        data: Bytes,
        opts: &PutOptions,
    ) -> BackendResult<ObjectMetadata> {
        let failure = {
            let mut calls = self.state.calls();
            calls.single_attempts += 1;
            FakeState::should_fail(&mut self.state.faults().single)
        };
        if let Some(failure) = failure {
            return Err(failure.error("put"));
        }

        {
            let mut calls = self.state.calls();
            calls.single_puts += 1;
            calls.size_hints.push(opts.size_hint);
        }

        let metadata = self.metadata(key, data.len() as u64, opts);
        self.state
            .bytes_received
            .fetch_add(data.len() as u64, Ordering::SeqCst);
        self.state
            .objects
            .lock()
            .unwrap()
            .insert(key.to_string(), (metadata.clone(), data));
        Ok(metadata)
    }

    async fn start_multipart(
        &self,
        key: &str,
        opts: &PutOptions,
    ) -> BackendResult<Arc<dyn MultipartUpload>> {
        let failure = {
            let mut calls = self.state.calls();
            calls.start_attempts += 1;
            FakeState::should_fail(&mut self.state.faults().start)
        };
        if let Some(failure) = failure {
            return Err(failure.error("start"));
        }

        {
            let mut calls = self.state.calls();
            calls.starts += 1;
            calls.size_hints.push(opts.size_hint);
        }

        Ok(Arc::new(FakeUpload {
            key: key.to_string(),
            metadata: self.metadata(key, 0, opts),
            limits: self.limits,
            state: self.state.clone(),
            keep_data: self.keep_data,
            parts: Mutex::default(),
            gone: AtomicBool::new(false),
        }))
    }

    async fn put_object_if(
        &self,
        _key: &str,
        _data: Bytes,
        _content_type: Option<String>,
        _precondition: WritePrecondition,
    ) -> BackendResult<ObjectMetadata> {
        Err(BackendError::Internal("unsupported".to_string()))
    }

    async fn get_object(&self, key: &str) -> BackendResult<ObjectData> {
        let (metadata, data) = self
            .state
            .object(key)
            .ok_or_else(|| BackendError::NotFound(key.to_string()))?;

        let chunks: Vec<_> = (0..data.len())
            .step_by(64 * KIB as usize)
            .map(|start| Ok(data.slice(start..(start + 64 * KIB as usize).min(data.len()))))
            .collect();

        Ok(ObjectData {
            metadata,
            stream: Box::pin(futures::stream::iter(chunks)),
        })
    }

    async fn get_object_range(
        &self,
        _key: &str,
        _range: ByteRange,
    ) -> BackendResult<ObjectRangeData> {
        Err(BackendError::Internal("unsupported".to_string()))
    }

    async fn head_object(&self, key: &str) -> BackendResult<ObjectMetadata> {
        self.state
            .object(key)
            .map(|(metadata, _)| metadata)
            .ok_or_else(|| BackendError::NotFound(key.to_string()))
    }

    async fn delete_object(&self, key: &str) -> BackendResult<()> {
        self.state.objects.lock().unwrap().remove(key);
        Ok(())
    }

    async fn list_objects(
        &self,
        _prefix: Option<&str>,
        _max_keys: Option<usize>,
        _continuation_token: Option<&str>,
    ) -> BackendResult<ObjectPage> {
        Err(BackendError::Internal("unsupported".to_string()))
    }

    async fn get_public_url(
        &self,
        _key: &str,
        _expiration_secs: u64,
        _purpose: PublicUrlPurpose,
    ) -> BackendResult<SignedUrl> {
        Err(BackendError::Internal("unsupported".to_string()))
    }
}
