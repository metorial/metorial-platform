#![allow(dead_code)]

//! A backend for pipeline tests: real local storage for buckets, metadata and archives, plus
//! generated sources of any size (with injectable faults) and a discarding archive sink.

use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use async_trait::async_trait;
use bytes::Bytes;
use chrono::Utc;
use futures::StreamExt;
use object_store::metadata::MetadataStore;
use object_store::zip::{
    deflate_block_upper_bound, CompressionHint, EntryDigest, ObjectRef, ZipDestination,
    ZipEntrySpec, ZipJobSpec, ZipSettings, DEFLATE_BLOCK_BYTES,
};
use object_store::ObjectStoreService;
use object_store_backends::local::LocalBackend;
use object_store_backends::{
    Backend, BackendError, BackendResult, ByteRange, ByteStream, MultipartUpload, ObjectData,
    ObjectMetadata, ObjectPage, ObjectRangeData, PartReceipt, PublicUrlPurpose, PutOptions,
    RetryPolicy, SignedUrl, UploadLimits, UploadSettings, Uploader, WritePrecondition,
};

pub const KIB: u64 = 1024;
pub const MIB: u64 = 1024 * KIB;
pub const GIB: u64 = 1024 * MIB;

pub const SOURCE_BUCKET: &str = "files";
pub const GENERATED_BUCKET: &str = "gen";
pub const ARCHIVE_BUCKET: &str = "exports";
pub const SINK_BUCKET: &str = "sink";

const BLOCK_LEN: usize = MIB as usize;

/// Like S3: parts of at least 5 MiB, uploaded four at a time.
pub const S3_LIKE: UploadLimits = UploadLimits {
    min_part_size: 5 * MIB,
    max_part_size: 5 * GIB,
    max_parts: 10_000,
    part_alignment: 1,
    max_concurrency: 4,
    max_object_size: 5 * 1024 * GIB,
};

pub fn local_limits() -> UploadLimits {
    UploadLimits {
        max_concurrency: 1,
        ..UploadLimits::UNBOUNDED
    }
}

pub fn upload_settings() -> UploadSettings {
    UploadSettings {
        part_concurrency: 4,
        min_part_size: 5 * MIB,
        memory_budget_bytes: 64 * MIB,
        retry: fast_retry(),
        ..UploadSettings::default()
    }
}

pub fn fast_retry() -> RetryPolicy {
    RetryPolicy {
        max_attempts: 6,
        base_delay: Duration::from_millis(1),
        max_delay: Duration::from_millis(4),
    }
}

pub fn zip_settings() -> ZipSettings {
    ZipSettings {
        source_retry: fast_retry(),
        source_idle_timeout: Duration::from_secs(5),
        ..ZipSettings::default()
    }
}

pub fn cpus() -> u64 {
    std::thread::available_parallelism().map_or(4, |n| n.get()) as u64
}

/// What `pipelines` concurrent large Deflate entries hold. Each has a block read ahead and up
/// to `compression_parallelism` compressed blocks waiting to be written in order; the running
/// compressions (input, output buffer and compressor) are capped at one per CPU process-wide.
pub fn deflate_heap_bound(settings: &ZipSettings, pipelines: u64) -> u64 {
    let block = DEFLATE_BLOCK_BYTES as u64;
    let compressed = deflate_block_upper_bound(block);
    let parallelism = settings
        .compression_parallelism
        .map_or(cpus(), |n| n as u64);
    let running = cpus().min(pipelines * parallelism);
    pipelines * (block + parallelism * compressed) + running * (block + compressed + 512 * KIB)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Content {
    Text,
    Random,
    Zeros,
    /// Lines of random words, which Deflate shrinks to about a quarter, about as slowly as
    /// real prose.
    Prose,
}

const PROSE_WORDS: &[&str] = &[
    "metorial", "skill", "export", "archive", "object", "storage", "bucket", "stream", "deflate",
    "upload", "server", "client", "request", "response", "plugin", "manifest", "the", "a", "of",
    "and", "to", "in", "is", "for", "with", "on", "that", "this", "be", "by", "from", "as",
];

fn block(content: Content) -> &'static Bytes {
    static BLOCKS: OnceLock<[Bytes; 4]> = OnceLock::new();
    let blocks = BLOCKS.get_or_init(|| {
        let mut state = 0x2545_F491_4F6C_DD1Du64;
        let mut next = move || {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            state
        };
        let mut prose = Vec::with_capacity(BLOCK_LEN + 256);
        let mut line = 0u64;
        while prose.len() < BLOCK_LEN {
            line += 1;
            for index in 0..5 + next() % 8 {
                if index > 0 {
                    prose.push(b' ');
                }
                let word = PROSE_WORDS[(next() % PROSE_WORDS.len() as u64) as usize];
                prose.extend_from_slice(word.as_bytes());
            }
            prose.extend_from_slice(format!(" #{line}\n").as_bytes());
        }
        prose.truncate(BLOCK_LEN);

        let mut text = Vec::with_capacity(BLOCK_LEN);
        let mut line = 0u64;
        while text.len() < BLOCK_LEN {
            text.extend_from_slice(
                format!(
                    "{line:08} Metorial skill export: the quick brown fox jumps over {}\n",
                    line % 97
                )
                .as_bytes(),
            );
            line += 1;
        }
        text.truncate(BLOCK_LEN);

        let mut state = 0x9E37_79B9_7F4A_7C15u64;
        let random: Vec<u8> = (0..BLOCK_LEN)
            .map(|_| {
                state ^= state << 13;
                state ^= state >> 7;
                state ^= state << 17;
                (state >> 24) as u8
            })
            .collect();

        [
            Bytes::from(text),
            Bytes::from(random),
            Bytes::from(vec![0u8; BLOCK_LEN]),
            Bytes::from(prose),
        ]
    });

    &blocks[match content {
        Content::Text => 0,
        Content::Random => 1,
        Content::Zeros => 2,
        Content::Prose => 3,
    }]
}

/// Bytes `[offset, offset + len)` of the generated object `(content, seed)`; zero-copy unless
/// the range wraps around the shared block.
pub fn generate(content: Content, seed: u64, offset: u64, len: usize) -> Bytes {
    let block = block(content);
    let start = ((offset + seed.wrapping_mul(4099)) % BLOCK_LEN as u64) as usize;
    if start + len <= BLOCK_LEN {
        return block.slice(start..start + len);
    }

    let mut out = Vec::with_capacity(len);
    let mut position = start;
    while out.len() < len {
        let take = (len - out.len()).min(BLOCK_LEN - position);
        out.extend_from_slice(&block[position..position + take]);
        position = 0;
    }
    Bytes::from(out)
}

pub fn generated_bytes(content: Content, seed: u64, size: u64) -> Vec<u8> {
    let mut out = Vec::with_capacity(size as usize);
    let mut offset = 0;
    while offset < size {
        let len = (size - offset).min(BLOCK_LEN as u64) as usize;
        out.extend_from_slice(&generate(content, seed, offset, len));
        offset += len as u64;
    }
    out
}

/// `(size, crc32)` of a generated object, computed without holding it.
pub fn generated_digest(content: Content, seed: u64, size: u64) -> (u64, u32) {
    let mut digest = EntryDigest::new();
    let mut offset = 0;
    while offset < size {
        let len = (size - offset).min(BLOCK_LEN as u64) as usize;
        digest.update_uncompressed(&generate(content, seed, offset, len));
        offset += len as u64;
    }
    let sizes = digest.finish();
    (sizes.uncompressed_size, sizes.crc32)
}

/// A source whose bytes are generated on demand, with knobs to make it misbehave.
#[derive(Debug, Clone)]
pub struct Synthetic {
    pub size: u64,
    pub content: Content,
    pub seed: u64,
    pub etag: String,
    pub content_type: Option<String>,
    /// Chunk size of the GET stream.
    pub chunk: usize,
    /// Bytes a GET actually streams when it differs from `size` (HEAD and GET still say `size`).
    pub served_len: Option<u64>,
    /// Size GET reports, if it differs from HEAD.
    pub get_size: Option<u64>,
    /// ETag every GET reports, if it differs from HEAD.
    pub get_etag: Option<String>,
    /// From the given 0-based connection on, GETs report this ETag.
    pub etag_from_connection: Option<(u32, String)>,
    /// Each connection takes the next offset and fails once it has streamed up to it.
    pub failures: VecDeque<u64>,
    /// Every connection fails after streaming this many bytes.
    pub fail_every_connection_after: Option<u64>,
    /// Pause before each chunk.
    pub chunk_delay: Duration,
    connections: u32,
}

impl Synthetic {
    pub fn new(content: Content, seed: u64, size: u64) -> Self {
        Synthetic {
            size,
            content,
            seed,
            etag: format!("etag-{seed}-{size}"),
            content_type: None,
            chunk: 64 * KIB as usize,
            served_len: None,
            get_size: None,
            get_etag: None,
            etag_from_connection: None,
            failures: VecDeque::new(),
            fail_every_connection_after: None,
            chunk_delay: Duration::ZERO,
            connections: 0,
        }
    }

    pub fn chunk(mut self, chunk: usize) -> Self {
        self.chunk = chunk.max(1);
        self
    }

    pub fn failing_at(mut self, offsets: &[u64]) -> Self {
        self.failures = offsets.iter().copied().collect();
        self
    }

    pub fn bytes(&self) -> Vec<u8> {
        generated_bytes(self.content, self.seed, self.size)
    }

    pub fn digest(&self) -> (u64, u32) {
        generated_digest(self.content, self.seed, self.size)
    }

    fn metadata(&self, key: &str, size: u64, etag: &str) -> ObjectMetadata {
        ObjectMetadata {
            key: key.to_string(),
            size,
            content_type: self.content_type.clone(),
            etag: etag.to_string(),
            last_modified: Utc::now(),
            custom_metadata: HashMap::new(),
        }
    }

    fn connect(&mut self, start: u64) -> (String, u64, ByteStream) {
        let connection = self.connections;
        self.connections += 1;

        let etag = match &self.etag_from_connection {
            Some((from, etag)) if connection >= *from => etag.clone(),
            _ => self.get_etag.clone().unwrap_or_else(|| self.etag.clone()),
        };
        let size = self.get_size.unwrap_or(self.size);

        let end = self.served_len.unwrap_or(self.size);
        let fail_at = self.failures.pop_front().or(self
            .fail_every_connection_after
            .map(|after| start.saturating_add(after)));

        let (content, seed, chunk, delay) = (self.content, self.seed, self.chunk, self.chunk_delay);
        let stream = futures::stream::unfold(Some(start), move |position| async move {
            let position = position?;
            if let Some(fail_at) = fail_at {
                if position >= fail_at && position < end {
                    return Some((
                        Err(std::io::Error::new(
                            std::io::ErrorKind::ConnectionReset,
                            "injected source failure",
                        )),
                        None,
                    ));
                }
            }
            if position >= end {
                return None;
            }

            if !delay.is_zero() {
                tokio::time::sleep(delay).await;
            }

            let mut len = (end - position).min(chunk as u64);
            if let Some(fail_at) = fail_at.filter(|&fail_at| fail_at > position) {
                len = len.min(fail_at - position);
            }
            let data = generate(content, seed, position, len as usize);
            Some((Ok(data), Some(position + len)))
        });

        (etag, size, Box::pin(stream))
    }
}

#[derive(Debug, Default)]
pub struct Calls {
    pub head: AtomicU64,
    pub get: AtomicU64,
    pub get_range: AtomicU64,
    pub put_single: AtomicU64,
    pub start_multipart: AtomicU64,
    pub upload_part: AtomicU64,
    pub complete: AtomicU64,
    pub abort: AtomicU64,
    pub other: AtomicU64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct CallCounts {
    pub head: u64,
    pub get: u64,
    pub get_range: u64,
    pub put_single: u64,
    pub start_multipart: u64,
    pub upload_part: u64,
    pub complete: u64,
    pub abort: u64,
    pub other: u64,
}

impl Calls {
    pub fn snapshot(&self) -> CallCounts {
        let load = |counter: &AtomicU64| counter.load(Ordering::SeqCst);
        CallCounts {
            head: load(&self.head),
            get: load(&self.get),
            get_range: load(&self.get_range),
            put_single: load(&self.put_single),
            start_multipart: load(&self.start_multipart),
            upload_part: load(&self.upload_part),
            complete: load(&self.complete),
            abort: load(&self.abort),
            other: load(&self.other),
        }
    }

    pub fn reset(&self) {
        for counter in [
            &self.head,
            &self.get,
            &self.get_range,
            &self.put_single,
            &self.start_multipart,
            &self.upload_part,
            &self.complete,
            &self.abort,
            &self.other,
        ] {
            counter.store(0, Ordering::SeqCst);
        }
    }
}

fn bump(counter: &AtomicU64) {
    counter.fetch_add(1, Ordering::SeqCst);
}

#[derive(Debug, Clone, Default)]
pub struct SinkObject {
    pub size: u64,
    pub parts: Vec<u64>,
}

pub struct TestBackend {
    inner: LocalBackend,
    uploader: Arc<Uploader>,
    limits: UploadLimits,
    synthetic: Mutex<HashMap<String, Synthetic>>,
    sink: Arc<Mutex<HashMap<String, SinkObject>>>,
    pub calls: Arc<Calls>,
    pub part_delay: Mutex<Duration>,
}

fn is_sink(key: &str) -> bool {
    key.starts_with("sink/")
}

impl TestBackend {
    pub fn new(root: &std::path::Path, settings: UploadSettings, limits: UploadLimits) -> Self {
        let uploader = Arc::new(Uploader::new(settings));
        TestBackend {
            inner: LocalBackend::new(root.to_path_buf(), "data".to_string())
                .with_uploader(uploader.clone()),
            uploader,
            limits,
            synthetic: Mutex::new(HashMap::new()),
            sink: Arc::default(),
            calls: Arc::default(),
            part_delay: Mutex::new(Duration::ZERO),
        }
    }

    pub fn add_synthetic(&self, key: &str, source: Synthetic) {
        self.synthetic
            .lock()
            .unwrap()
            .insert(key.to_string(), source);
    }

    pub fn update_synthetic(&self, key: &str, update: impl FnOnce(&mut Synthetic)) {
        update(self.synthetic.lock().unwrap().get_mut(key).unwrap());
    }

    pub fn sink_object(&self, key: &str) -> Option<SinkObject> {
        self.sink.lock().unwrap().get(key).cloned()
    }

    pub fn uploader_handle(&self) -> &Uploader {
        &self.uploader
    }

    pub fn shared_uploader(&self) -> Arc<Uploader> {
        self.uploader.clone()
    }
}

struct SinkUpload {
    key: String,
    parts: Mutex<Vec<(u32, u64)>>,
    sink: Arc<Mutex<HashMap<String, SinkObject>>>,
    calls: Arc<Calls>,
    delay: Duration,
}

#[async_trait]
impl MultipartUpload for SinkUpload {
    async fn upload_part(
        &self,
        number: u32,
        offset: u64,
        data: Bytes,
    ) -> BackendResult<PartReceipt> {
        bump(&self.calls.upload_part);
        if !self.delay.is_zero() {
            tokio::time::sleep(self.delay).await;
        }
        let size = data.len() as u64;
        drop(data);
        self.parts.lock().unwrap().push((number, size));
        Ok(PartReceipt {
            number,
            offset,
            size,
            etag: None,
        })
    }

    async fn complete(&self, parts: Vec<PartReceipt>) -> BackendResult<ObjectMetadata> {
        bump(&self.calls.complete);
        let sizes: Vec<u64> = parts.iter().map(|part| part.size).collect();
        let size = sizes.iter().sum();
        self.sink
            .lock()
            .unwrap()
            .insert(self.key.clone(), SinkObject { size, parts: sizes });
        Ok(ObjectMetadata {
            key: self.key.clone(),
            size,
            content_type: None,
            etag: format!("sink-{}-parts", parts.len()),
            last_modified: Utc::now(),
            custom_metadata: HashMap::new(),
        })
    }

    async fn abort(&self) {
        bump(&self.calls.abort);
    }
}

struct CountingUpload {
    inner: Arc<dyn MultipartUpload>,
    calls: Arc<Calls>,
}

#[async_trait]
impl MultipartUpload for CountingUpload {
    async fn upload_part(
        &self,
        number: u32,
        offset: u64,
        data: Bytes,
    ) -> BackendResult<PartReceipt> {
        bump(&self.calls.upload_part);
        self.inner.upload_part(number, offset, data).await
    }

    async fn complete(&self, parts: Vec<PartReceipt>) -> BackendResult<ObjectMetadata> {
        bump(&self.calls.complete);
        self.inner.complete(parts).await
    }

    async fn abort(&self) {
        bump(&self.calls.abort);
        self.inner.abort().await
    }
}

#[async_trait]
impl Backend for TestBackend {
    async fn init(&self) -> BackendResult<()> {
        self.inner.init().await
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
        bump(&self.calls.put_single);
        if is_sink(key) {
            let size = data.len() as u64;
            self.sink.lock().unwrap().insert(
                key.to_string(),
                SinkObject {
                    size,
                    parts: vec![size],
                },
            );
            return Ok(ObjectMetadata {
                key: key.to_string(),
                size,
                content_type: opts.content_type.clone(),
                etag: "sink-single".to_string(),
                last_modified: Utc::now(),
                custom_metadata: HashMap::new(),
            });
        }
        self.inner.put_single(key, data, opts).await
    }

    async fn start_multipart(
        &self,
        key: &str,
        opts: &PutOptions,
    ) -> BackendResult<Arc<dyn MultipartUpload>> {
        bump(&self.calls.start_multipart);
        if is_sink(key) {
            return Ok(Arc::new(SinkUpload {
                key: key.to_string(),
                parts: Mutex::default(),
                sink: self.sink.clone(),
                calls: self.calls.clone(),
                delay: *self.part_delay.lock().unwrap(),
            }));
        }
        let inner = self.inner.start_multipart(key, opts).await?;
        Ok(Arc::new(CountingUpload {
            inner,
            calls: self.calls.clone(),
        }))
    }

    async fn put_object_if(
        &self,
        key: &str,
        data: Bytes,
        content_type: Option<String>,
        precondition: WritePrecondition,
    ) -> BackendResult<ObjectMetadata> {
        bump(&self.calls.other);
        self.inner
            .put_object_if(key, data, content_type, precondition)
            .await
    }

    async fn get_object(&self, key: &str) -> BackendResult<ObjectData> {
        bump(&self.calls.get);
        let connected = self.synthetic.lock().unwrap().get_mut(key).map(|source| {
            let (etag, size, stream) = source.connect(0);
            (source.metadata(key, size, &etag), stream)
        });
        match connected {
            Some((metadata, stream)) => Ok(ObjectData { metadata, stream }),
            None => self.inner.get_object(key).await,
        }
    }

    async fn get_object_range(
        &self,
        key: &str,
        range: ByteRange,
    ) -> BackendResult<ObjectRangeData> {
        bump(&self.calls.get_range);
        let connected = {
            let mut synthetic = self.synthetic.lock().unwrap();
            match synthetic.get_mut(key) {
                None => None,
                Some(source) => {
                    let reported = source.get_size.unwrap_or(source.size);
                    let (start, end) = range
                        .resolve(reported)
                        .ok_or(BackendError::RangeNotSatisfiable { size: reported })?;
                    let (etag, size, stream) = source.connect(start);
                    Some(ObjectRangeData {
                        metadata: source.metadata(key, size, &etag),
                        start,
                        end,
                        stream,
                    })
                }
            }
        };
        match connected {
            Some(part) => Ok(part),
            None => self.inner.get_object_range(key, range).await,
        }
    }

    async fn head_object(&self, key: &str) -> BackendResult<ObjectMetadata> {
        bump(&self.calls.head);
        let head = self
            .synthetic
            .lock()
            .unwrap()
            .get(key)
            .map(|source| source.metadata(key, source.size, &source.etag));
        match head {
            Some(head) => Ok(head),
            None => self.inner.head_object(key).await,
        }
    }

    async fn delete_object(&self, key: &str) -> BackendResult<()> {
        bump(&self.calls.other);
        self.inner.delete_object(key).await
    }

    async fn list_objects(
        &self,
        prefix: Option<&str>,
        max_keys: Option<usize>,
        continuation_token: Option<&str>,
    ) -> BackendResult<ObjectPage> {
        bump(&self.calls.other);
        self.inner
            .list_objects(prefix, max_keys, continuation_token)
            .await
    }

    async fn get_public_url(
        &self,
        key: &str,
        expiration_secs: u64,
        purpose: PublicUrlPurpose,
    ) -> BackendResult<SignedUrl> {
        self.inner
            .get_public_url(key, expiration_secs, purpose)
            .await
    }
}

pub struct Harness {
    pub backend: Arc<TestBackend>,
    pub service: Arc<ObjectStoreService>,
    _root: tempfile::TempDir,
}

impl Harness {
    pub async fn new() -> Self {
        Self::with(upload_settings(), local_limits()).await
    }

    pub async fn with(settings: UploadSettings, limits: UploadLimits) -> Self {
        Self::build(settings, limits, None).await
    }

    /// Archives are written through `archive_uploader` instead of the backend's uploader.
    pub async fn with_archive_uploader(
        settings: UploadSettings,
        limits: UploadLimits,
        archive_uploader: Arc<Uploader>,
    ) -> Self {
        Self::build(settings, limits, Some(archive_uploader)).await
    }

    async fn build(
        settings: UploadSettings,
        limits: UploadLimits,
        archive_uploader: Option<Arc<Uploader>>,
    ) -> Self {
        let root = tempfile::Builder::new()
            .prefix("zip-pipeline-")
            .tempdir()
            .unwrap();
        let backend = Arc::new(TestBackend::new(root.path(), settings, limits));
        backend.init().await.unwrap();

        let metadata = Arc::new(MetadataStore::new(backend.clone()).await.unwrap());
        let mut service = ObjectStoreService::new(backend.clone(), metadata);
        if let Some(uploader) = archive_uploader {
            service = service.with_archive_uploader(uploader);
        }
        let service = Arc::new(service);
        for bucket in [SOURCE_BUCKET, GENERATED_BUCKET, ARCHIVE_BUCKET, SINK_BUCKET] {
            service.create_bucket(bucket).await.unwrap();
        }
        backend.calls.reset();

        Harness {
            backend,
            service,
            _root: root,
        }
    }

    pub async fn put(&self, bucket: &str, key: &str, data: Vec<u8>) {
        let stream: ByteStream =
            Box::pin(futures::stream::once(async move { Ok(Bytes::from(data)) }));
        self.service
            .put_object(bucket, key, stream, None, HashMap::new())
            .await
            .unwrap();
    }

    pub fn add_generated(&self, key: &str, source: Synthetic) {
        self.backend
            .add_synthetic(&format!("{GENERATED_BUCKET}/{key}"), source);
    }

    pub fn update_generated(&self, key: &str, update: impl FnOnce(&mut Synthetic)) {
        self.backend
            .update_synthetic(&format!("{GENERATED_BUCKET}/{key}"), update);
    }

    pub async fn read(&self, bucket: &str, key: &str) -> Vec<u8> {
        let mut object = self.service.get_object(bucket, key).await.unwrap();
        let mut data = Vec::new();
        while let Some(chunk) = object.stream.next().await {
            data.extend_from_slice(&chunk.unwrap());
        }
        data
    }

    pub async fn exists(&self, bucket: &str, key: &str) -> bool {
        self.service.object_exists(bucket, key).await.unwrap()
    }

    pub fn calls(&self) -> CallCounts {
        self.backend.calls.snapshot()
    }

    pub fn root(&self) -> &std::path::Path {
        self._root.path()
    }
}

pub fn entry(path: &str, bucket: &str, key: &str) -> ZipEntrySpec {
    ZipEntrySpec {
        path: path.to_string(),
        source: ObjectRef {
            bucket: bucket.to_string(),
            key: key.to_string(),
        },
        compression: CompressionHint::Auto,
        size: None,
        crc32: None,
    }
}

pub fn spec(bucket: &str, key: &str, entries: Vec<ZipEntrySpec>) -> ZipJobSpec {
    ZipJobSpec {
        destination: ZipDestination {
            bucket: bucket.to_string(),
            key: key.to_string(),
            content_type: None,
        },
        entries,
        deflate_level: None,
        max_archive_bytes: None,
    }
}
