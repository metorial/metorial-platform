use std::borrow::Cow;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::task::{Context, Poll};

use bytes::{Bytes, BytesMut};
use futures::future::Either;
use futures::stream::FuturesOrdered;
use futures::{Stream, StreamExt};
use object_store_backends::{
    Backend, BackendResult, ByteStream, ChannelByteStream, ObjectMetadata, PutOptions, RetryPolicy,
    UploadedObject,
};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;
use tokio_util::task::AbortOnDropHandle;
use tracing::{info, warn};

use super::bounds::archive_size_upper_bound_for_data;
use super::commit::{CommitCheck, CommitGate, GatedBackend};
use super::digest::EntryDigest;
use super::entry::{
    compress_small, compression_slot, deflate_block, join_error, sample_compresses,
    spawn_compression, try_compression_slot, EntryPlan, LargeMode, SmallMode, DEFLATE_BLOCK_BYTES,
    SAMPLE_BYTES,
};
use super::error::{ZipErrorCode, ZipJobError};
use super::plan::plan_renames;
use super::settings::ZipSettings;
use super::source::{ReconnectPolicy, SourceReader, SourceVersion};
use super::spec::{CompressionHint, ZipEntrySpec, ZipJobSpec};
use super::writer::{DeclaredSizes, EntryHeader, EntrySizes, Method, ZipWriter};
use crate::error::ServiceError;
use crate::service::ObjectStoreService;

/// Chunks queued between the archive producer and the uploader; each is at most
/// `ZipSettings::write_chunk_bytes`.
const UPLOAD_CHANNEL_CHUNKS: usize = 4;

/// Writes at least this large skip coalescing and go to the upload as they are.
const PASSTHROUGH_BYTES: usize = 64 * 1024;

/// Live counters for one archive build, readable at any time (e.g. for a job heartbeat).
#[derive(Debug, Default)]
pub struct ZipProgress {
    entries_total: AtomicU64,
    entries_done: AtomicU64,
    bytes_read: AtomicU64,
    bytes_written: AtomicU64,
    bytes_estimate: AtomicU64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZipProgressSnapshot {
    pub entries_total: u64,
    pub entries_done: u64,
    /// Source bytes read so far, including bytes re-read after a reconnect.
    pub bytes_read: u64,
    /// Archive bytes handed to the upload so far.
    pub bytes_written: u64,
    /// Upper bound on the archive size, known once every source has been HEADed.
    pub bytes_estimate: u64,
}

impl ZipProgress {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn snapshot(&self) -> ZipProgressSnapshot {
        ZipProgressSnapshot {
            entries_total: self.entries_total.load(Ordering::Relaxed),
            entries_done: self.entries_done.load(Ordering::Relaxed),
            bytes_read: self.bytes_read.load(Ordering::Relaxed),
            bytes_written: self.bytes_written.load(Ordering::Relaxed),
            bytes_estimate: self.bytes_estimate.load(Ordering::Relaxed),
        }
    }

    fn add(counter: &AtomicU64, amount: u64) {
        counter.fetch_add(amount, Ordering::Relaxed);
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveResult {
    pub size: u64,
    /// Hex SHA-256 of the archive bytes.
    pub sha256: String,
    /// The destination backend's ETag for the archive object.
    pub etag: String,
    /// Every entry whose archive path differs from its requested path, in archive order.
    pub renamed_entries: Vec<RenamedEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenamedEntry {
    pub path: String,
    pub archive_path: String,
}

/// Builds the archive described by `spec` and uploads it to its destination.
///
/// Validates the spec, HEADs every source, and rejects the archive with `too_large` before
/// anything is uploaded if its upper-bound size exceeds the limit. Entries are then written in
/// path order: small ones are fetched and compressed up to `fetch_concurrency` ahead, large ones
/// stream through when their turn comes. The output depends only on the spec, the sources, and
/// `small_entry_bytes`, never on concurrency, part sizes or timing.
///
/// `before_commit` runs right before the upload is committed and can veto it. On any error or
/// on cancellation, the upload is aborted and the destination is left as it was. A cancellation
/// that arrives after the commit has started is ignored, and the build completes.
pub async fn build_archive(
    service: &ObjectStoreService,
    spec: &ZipJobSpec,
    settings: &ZipSettings,
    cancel: CancellationToken,
    progress: Arc<ZipProgress>,
    before_commit: Option<CommitCheck>,
) -> Result<ArchiveResult, ZipJobError> {
    let spec = Cow::Borrowed(spec);
    build(service, spec, settings, cancel, progress, before_commit).await
}

/// [`build_archive`], taking the spec so that its entries' strings move into the plan and the
/// rest of it is freed before any source is read.
pub async fn build_archive_owned(
    service: &ObjectStoreService,
    spec: ZipJobSpec,
    settings: &ZipSettings,
    cancel: CancellationToken,
    progress: Arc<ZipProgress>,
    before_commit: Option<CommitCheck>,
) -> Result<ArchiveResult, ZipJobError> {
    let spec = Cow::Owned(spec);
    build(service, spec, settings, cancel, progress, before_commit).await
}

#[tracing::instrument(
    level = "info",
    skip_all,
    fields(
        destination = %format!("{}/{}", spec.destination.bucket, spec.destination.key),
        entries = spec.entries.len(),
    )
)]
async fn build(
    service: &ObjectStoreService,
    spec: Cow<'_, ZipJobSpec>,
    settings: &ZipSettings,
    cancel: CancellationToken,
    progress: Arc<ZipProgress>,
    before_commit: Option<CommitCheck>,
) -> Result<ArchiveResult, ZipJobError> {
    let level = spec.deflate_level();
    let content_type = spec.content_type().to_string();
    let planned = tokio::select! {
        biased;
        _ = cancel.cancelled() => return Err(ZipJobError::canceled()),
        planned = plan_archive(service, spec, settings, &progress) => planned?,
    };

    info!(
        "Building archive of {} entries, at most {} bytes",
        planned.entries.len(),
        planned.size_bound
    );

    let gate = Arc::new(CommitGate::new(before_commit, cancel.clone()));
    let destination = GatedBackend {
        inner: service.backend().clone(),
        gate: gate.clone(),
    };

    let context = Arc::new(EntryContext {
        backend: service.backend().clone(),
        buckets: planned.buckets,
        level,
        reconnect: ReconnectPolicy {
            max_reconnects: settings.source_reconnects,
            backoff: settings.source_retry,
            idle_timeout: settings.source_idle_timeout,
        },
        progress: progress.clone(),
        cancel: cancel.clone(),
        compression_parallelism: settings.compression_parallelism(),
    });

    let (sender, receiver) = ChannelByteStream::channel(UPLOAD_CHANNEL_CHUNKS);
    let sealed = Arc::new(AtomicBool::new(false));
    let stream: ByteStream = Box::pin(SealedStream {
        inner: receiver,
        sealed: sealed.clone(),
    });

    let opts = PutOptions {
        content_type: Some(content_type),
        metadata: HashMap::new(),
        size_hint: Some(planned.size_bound),
        exact_size: None,
    };
    let upload =
        service
            .archive_uploader()
            .upload(&destination, &planned.destination_key, stream, opts);

    let sink = ArchiveSink {
        sender,
        pending: BytesMut::new(),
        chunk_bytes: settings.write_chunk_bytes(),
        written: 0,
        progress: progress.clone(),
    };
    let produce = produce(
        context,
        planned.entries,
        sink,
        sealed,
        settings.fetch_concurrency(),
    );

    let mut work = Box::pin(run_upload(produce, upload, &gate));
    let mut commit_started = false;

    let outcome = loop {
        tokio::select! {
            biased;
            outcome = &mut work => break outcome,
            _ = cancel.cancelled(), if !commit_started => {
                if gate.cancel() {
                    drop(work);
                    gate.abort_started().await;
                    warn!("Archive canceled; upload aborted");
                    return Err(ZipJobError::canceled());
                }
                commit_started = true;
            }
        }
    };

    let (uploaded, produced_bytes) = outcome.inspect_err(|error| {
        warn!("Archive failed: {}", error);
    })?;

    if uploaded.metadata.size != produced_bytes {
        return Err(ZipJobError::internal(format!(
            "uploaded {} bytes, but the archive has {}",
            uploaded.metadata.size, produced_bytes
        )));
    }

    info!(
        "Archive complete: {} bytes, sha256 {}",
        uploaded.metadata.size, uploaded.digests.sha256
    );

    Ok(ArchiveResult {
        size: uploaded.metadata.size,
        sha256: uploaded.digests.sha256,
        etag: uploaded.metadata.etag,
        renamed_entries: planned.renamed_entries,
    })
}

struct PlannedArchive {
    destination_key: String,
    buckets: Vec<Box<str>>,
    entries: Vec<EntryJob>,
    size_bound: u64,
    renamed_entries: Vec<RenamedEntry>,
}

/// One entry, in archive order, with everything needed to write it. A million-entry archive
/// holds one per entry until it is written, so it stays small: strings are boxed, the source
/// bucket is an index into `PlannedArchive::buckets`, and `bucket/key` is formatted on use.
struct EntryJob {
    archive_path: Box<str>,
    key: Box<str>,
    etag: Box<str>,
    /// Until the source is HEADed, the size the spec expects (if `expects_size`); then its size.
    size: u64,
    crc32: Option<u32>,
    bucket: u32,
    expects_size: bool,
    compression: CompressionHint,
    plan: EntryPlan,
}

async fn plan_archive(
    service: &ObjectStoreService,
    spec: Cow<'_, ZipJobSpec>,
    settings: &ZipSettings,
    progress: &ZipProgress,
) -> Result<PlannedArchive, ZipJobError> {
    spec.validate_fields(settings)?;
    let destination_bucket = spec.destination.bucket.clone();
    let destination_key = format!("{}/{}", spec.destination.bucket, spec.destination.key);
    let limit = spec.archive_limit(settings);

    let (buckets, mut entries) = entry_jobs(spec)?;
    progress
        .entries_total
        .store(entries.len() as u64, Ordering::Relaxed);

    entries.sort_unstable_by(|a, b| a.archive_path.cmp(&b.archive_path));
    let renames = plan_renames(entries.len(), |index| &entries[index].archive_path, true)
        .map_err(ZipJobError::from_path)?;
    let renamed_entries: Vec<RenamedEntry> = renames
        .into_iter()
        .map(|(index, archive_path)| {
            let renamed = archive_path.clone().into_boxed_str();
            let path = std::mem::replace(&mut entries[index].archive_path, renamed);
            RenamedEntry {
                path: path.into(),
                archive_path,
            }
        })
        .collect();

    let metadata = service.metadata();
    match metadata.get_bucket(&destination_bucket).await {
        Ok(_) => {}
        Err(ServiceError::BucketNotFound(bucket)) => {
            return Err(ZipJobError::invalid_spec(format!(
                "destination bucket {:?} does not exist",
                bucket
            )))
        }
        Err(error) => return Err(ZipJobError::from_service("destination", error)),
    }

    let mut source_buckets: Vec<&str> = buckets.iter().map(|bucket| &**bucket).collect();
    source_buckets.sort_unstable();
    for bucket in source_buckets {
        metadata.get_bucket(bucket).await.map_err(|error| {
            ZipJobError::from_service(&format!("source bucket {}", bucket), error)
        })?;
    }

    // Each HEAD fills in its entry right away, so a million-entry archive never holds a
    // million full object metadata records.
    let backend = service.backend();
    let small_entry_bytes = settings.small_entry_bytes();
    let mut heads = FuturesOrdered::new();
    let mut started = 0;
    for index in 0..entries.len() {
        while started < entries.len() && heads.len() < settings.head_concurrency() {
            let key = source_key(&buckets, &entries[started]);
            heads.push_back(head_source(backend.clone(), key, settings.source_retry));
            started += 1;
        }
        let Some(head) = heads.next().await else {
            break;
        };
        plan_entry(&mut entries[index], head?, small_entry_bytes)?;
    }
    drop(heads);

    let size_bound = archive_size_upper_bound_for_data(entries.iter().map(|entry| {
        (
            entry.archive_path.len(),
            entry.plan.max_data_size(entry.size),
        )
    }));
    progress.bytes_estimate.store(size_bound, Ordering::Relaxed);

    if size_bound > limit {
        return Err(ZipJobError::new(
            ZipErrorCode::TooLarge,
            format!(
                "the archive could be up to {} bytes, more than the limit of {}",
                size_bound, limit
            ),
        ));
    }

    let backend_limit = backend.upload_limits().max_object_size;
    if size_bound > backend_limit {
        return Err(ZipJobError::new(
            ZipErrorCode::TooLarge,
            format!(
                "the archive could be up to {} bytes, more than the backend's maximum of {}",
                size_bound, backend_limit
            ),
        ));
    }

    Ok(PlannedArchive {
        destination_key,
        buckets,
        entries,
        size_bound,
        renamed_entries,
    })
}

/// The spec's entries in spec order, with their source buckets interned. The strings of an
/// owned spec move into the entries, and the rest of it is freed as they do.
fn entry_jobs(spec: Cow<'_, ZipJobSpec>) -> Result<(Vec<Box<str>>, Vec<EntryJob>), ZipJobError> {
    let specs: Box<dyn Iterator<Item = ZipEntrySpec> + '_> = match spec {
        Cow::Borrowed(spec) => Box::new(spec.entries.iter().cloned()),
        Cow::Owned(spec) => Box::new(spec.entries.into_iter()),
    };

    let mut buckets: Vec<Box<str>> = Vec::new();
    let mut bucket_ids: HashMap<String, u32> = HashMap::new();
    let mut entries = Vec::with_capacity(specs.size_hint().0);
    for entry in specs {
        let bucket = match bucket_ids.get(&entry.source.bucket) {
            Some(&bucket) => bucket,
            None => {
                let bucket = u32::try_from(buckets.len())
                    .map_err(|_| ZipJobError::invalid_spec("too many source buckets"))?;
                buckets.push(entry.source.bucket.as_str().into());
                bucket_ids.insert(entry.source.bucket, bucket);
                bucket
            }
        };
        entries.push(EntryJob {
            archive_path: entry.path.into_boxed_str(),
            key: entry.source.key.into_boxed_str(),
            etag: Box::default(),
            size: entry.size.unwrap_or(0),
            crc32: entry.crc32,
            bucket,
            expects_size: entry.size.is_some(),
            compression: entry.compression,
            plan: EntryPlan::Empty,
        });
    }
    Ok((buckets, entries))
}

fn source_key(buckets: &[Box<str>], entry: &EntryJob) -> String {
    format!("{}/{}", buckets[entry.bucket as usize], entry.key)
}

fn plan_entry(
    entry: &mut EntryJob,
    head: ObjectMetadata,
    small_entry_bytes: u64,
) -> Result<(), ZipJobError> {
    if entry.expects_size && entry.size != head.size {
        return Err(ZipJobError::source_changed(format!(
            "{} is {} bytes, but the spec says {}",
            head.key, head.size, entry.size
        )));
    }

    entry.plan = EntryPlan::decide(
        entry.compression,
        &entry.archive_path,
        head.content_type.as_deref(),
        head.size,
        small_entry_bytes,
    );
    entry.size = head.size;
    entry.etag = head.etag.into_boxed_str();
    Ok(())
}

async fn head_source(
    backend: Arc<dyn Backend>,
    key: String,
    retry: RetryPolicy,
) -> Result<ObjectMetadata, ZipJobError> {
    let mut attempt = 1;

    loop {
        match backend.head_object(&key).await {
            Ok(mut head) => {
                head.key = key;
                head.custom_metadata = HashMap::new();
                return Ok(head);
            }
            Err(error) if error.is_retryable() && attempt < retry.max_attempts => {
                tokio::time::sleep(retry.delay(attempt)).await;
                attempt += 1;
            }
            Err(error) => {
                return Err(ZipJobError::from_backend(&format!("source {}", key), error));
            }
        }
    }
}

/// Drives the producer and the upload together. The upload only completes after the producer
/// sealed the stream; a producer error is reported in preference to the upload error it caused.
async fn run_upload<P, U>(
    produce: P,
    upload: U,
    gate: &CommitGate,
) -> Result<(UploadedObject, u64), ZipJobError>
where
    P: Future<Output = Result<u64, ProduceError>>,
    U: Future<Output = BackendResult<UploadedObject>>,
{
    tokio::pin!(produce);
    tokio::pin!(upload);
    let mut produced = None;

    let uploaded = loop {
        tokio::select! {
            result = &mut produce, if produced.is_none() => produced = Some(result),
            result = &mut upload => break result,
        }
    };

    match uploaded {
        Ok(uploaded) => {
            let produced = match produced {
                Some(produced) => produced,
                None => produce.await,
            };
            match produced {
                Ok(bytes) => Ok((uploaded, bytes)),
                Err(ProduceError::Job(error)) => Err(error),
                Err(ProduceError::UploadClosed) => Err(ZipJobError::internal(
                    "the upload completed before the archive was finished",
                )),
            }
        }
        Err(error) => match produced {
            Some(Err(ProduceError::Job(produce_error))) => Err(produce_error),
            _ => Err(gate
                .veto()
                .unwrap_or_else(|| ZipJobError::from_backend("uploading the archive", error))),
        },
    }
}

enum ProduceError {
    Job(ZipJobError),
    UploadClosed,
}

impl From<ZipJobError> for ProduceError {
    fn from(error: ZipJobError) -> Self {
        ProduceError::Job(error)
    }
}

impl From<super::writer::ZipError> for ProduceError {
    fn from(error: super::writer::ZipError) -> Self {
        ProduceError::Job(ZipJobError::from_writer(error))
    }
}

/// What every entry task shares.
struct EntryContext {
    backend: Arc<dyn Backend>,
    buckets: Vec<Box<str>>,
    level: u32,
    reconnect: ReconnectPolicy,
    progress: Arc<ZipProgress>,
    cancel: CancellationToken,
    compression_parallelism: usize,
}

impl EntryContext {
    fn reader(&self, job: &EntryJob) -> SourceReader {
        let version = SourceVersion {
            size: job.size,
            etag: job.etag.to_string(),
        };
        let key = self.source_key(job);
        SourceReader::new(self.backend.clone(), key, version, self.reconnect.clone())
    }

    fn source_key(&self, job: &EntryJob) -> String {
        source_key(&self.buckets, job)
    }

    async fn next_chunk(&self, reader: &mut SourceReader) -> Result<Option<Bytes>, ZipJobError> {
        if self.cancel.is_cancelled() {
            return Err(ZipJobError::canceled());
        }

        let chunk = reader.next_chunk().await?;
        if let Some(chunk) = &chunk {
            ZipProgress::add(&self.progress.bytes_read, chunk.len() as u64);
        }
        Ok(chunk)
    }

    fn check_crc(&self, job: &EntryJob, actual: u32) -> Result<(), ZipJobError> {
        match job.crc32 {
            Some(expected) if expected != actual => Err(ZipJobError::new(
                ZipErrorCode::CrcMismatch,
                format!(
                    "{} has CRC-32 {:#010x}, but the spec says {:#010x}",
                    self.source_key(job),
                    actual,
                    expected
                ),
            )),
            _ => Ok(()),
        }
    }
}

enum Prepared {
    /// Sizes are known, so the header carries them and no data descriptor follows.
    Whole {
        header: EntryHeader,
        data: Bytes,
        sizes: EntrySizes,
    },
    Streamed(EntryJob),
}

fn prepare(
    context: &Arc<EntryContext>,
    job: EntryJob,
) -> impl Future<Output = Result<Prepared, ZipJobError>> {
    match job.plan {
        EntryPlan::Empty => Either::Left(futures::future::ready(Ok(Prepared::Whole {
            header: EntryHeader {
                path: job.archive_path.into(),
                method: Method::Stored,
                sizes: DeclaredSizes::Known(EntrySizes::stored(&[])),
            },
            data: Bytes::new(),
            sizes: EntrySizes::stored(&[]),
        }))),
        EntryPlan::Small(mode) => {
            let task =
                AbortOnDropHandle::new(tokio::spawn(fetch_small(context.clone(), job, mode)));
            Either::Right(Either::Left(async move {
                task.await.map_err(|error| {
                    ZipJobError::internal(format!("entry task failed: {}", error))
                })?
            }))
        }
        EntryPlan::Large(_) => Either::Right(Either::Right(futures::future::ready(Ok(
            Prepared::Streamed(job),
        )))),
    }
}

async fn fetch_small(
    context: Arc<EntryContext>,
    job: EntryJob,
    mode: SmallMode,
) -> Result<Prepared, ZipJobError> {
    let mut reader = context.reader(&job);
    let mut data = Vec::with_capacity(usize::try_from(job.size).unwrap_or(0));
    while let Some(chunk) = context.next_chunk(&mut reader).await? {
        data.extend_from_slice(&chunk);
    }

    let crc32 = crc32fast::hash(&data);
    context.check_crc(&job, crc32)?;

    let uncompressed_size = data.len() as u64;
    let compressed = compress_small(mode, context.level, data).await?;
    let sizes = EntrySizes {
        crc32,
        compressed_size: compressed.data.len() as u64,
        uncompressed_size,
    };

    Ok(Prepared::Whole {
        header: EntryHeader {
            path: job.archive_path.into(),
            method: compressed.method,
            sizes: DeclaredSizes::Known(sizes),
        },
        data: Bytes::from(compressed.data),
        sizes,
    })
}

async fn produce(
    context: Arc<EntryContext>,
    entries: Vec<EntryJob>,
    mut sink: ArchiveSink,
    sealed: Arc<AtomicBool>,
    fetch_concurrency: usize,
) -> Result<u64, ProduceError> {
    let mut writer = ZipWriter::new();
    let mut prepared = futures::stream::iter(entries)
        .map(|job| prepare(&context, job))
        .buffered(fetch_concurrency);

    while let Some(entry) = prepared.next().await {
        match entry? {
            Prepared::Whole {
                header,
                data,
                sizes,
            } => {
                sink.write(writer.begin_entry(header)?).await?;
                sink.write(data).await?;
                sink.write(writer.end_entry(sizes)?).await?;
            }
            Prepared::Streamed(job) => {
                stream_entry(&context, job, &mut writer, &mut sink).await?;
            }
        }
        ZipProgress::add(&context.progress.entries_done, 1);
    }
    drop(prepared);

    for chunk in writer.finish_chunked(sink.chunk_bytes)? {
        sink.write(chunk).await?;
    }
    sink.flush().await?;

    sealed.store(true, Ordering::Release);
    Ok(sink.written)
}

async fn stream_entry(
    context: &EntryContext,
    job: EntryJob,
    writer: &mut ZipWriter,
    sink: &mut ArchiveSink,
) -> Result<(), ProduceError> {
    let EntryPlan::Large(mode) = job.plan else {
        return Err(ZipJobError::internal("only large entries are streamed").into());
    };

    let mut reader = context.reader(&job);
    let mut sample = None;

    let method = match mode {
        LargeMode::Store => Method::Stored,
        LargeMode::Deflate => Method::Deflate,
        LargeMode::Sample => {
            let head = read_sample(context, &mut reader).await?;
            let deflate = sample_compresses(context.level, head.clone()).await?;
            sample = Some(head);
            if deflate {
                Method::Deflate
            } else {
                Method::Stored
            }
        }
    };

    let size = job.size;
    let sizes = match (method, job.crc32) {
        (Method::Stored, Some(crc32)) => DeclaredSizes::Known(EntrySizes {
            crc32,
            compressed_size: size,
            uncompressed_size: size,
        }),
        _ => DeclaredSizes::Unknown {
            max_uncompressed_size: size,
        },
    };

    sink.write(writer.begin_entry(EntryHeader {
        path: job.archive_path.to_string(),
        method,
        sizes,
    })?)
    .await?;

    let mut digest = EntryDigest::new();
    match method {
        Method::Stored => {
            let mut next = sample;
            loop {
                let chunk = match next.take() {
                    Some(chunk) => chunk,
                    None => match context.next_chunk(&mut reader).await? {
                        Some(chunk) => chunk,
                        None => break,
                    },
                };
                digest.update_uncompressed(&chunk);
                digest.add_compressed(chunk.len() as u64);
                sink.write(chunk).await?;
            }
        }
        Method::Deflate => {
            let compressed_size =
                deflate_entry(context, &mut reader, sample, &mut digest, sink).await?;
            digest.add_compressed(compressed_size);
        }
    }

    let actual = digest.finish();
    context.check_crc(&job, actual.crc32)?;
    if actual.uncompressed_size != size {
        return Err(ZipJobError::source_changed(format!(
            "{} produced {} bytes, HEAD reported {}",
            context.source_key(&job),
            actual.uncompressed_size,
            size
        ))
        .into());
    }

    sink.write(writer.end_entry(actual)?).await
}

async fn read_sample(
    context: &EntryContext,
    reader: &mut SourceReader,
) -> Result<Bytes, ZipJobError> {
    let mut sample = BytesMut::with_capacity(SAMPLE_BYTES);
    while sample.len() < SAMPLE_BYTES {
        match context.next_chunk(reader).await? {
            Some(chunk) => sample.extend_from_slice(&chunk),
            None => break,
        }
    }
    Ok(sample.freeze())
}

/// Streams the source through Deflate in `DEFLATE_BLOCK_BYTES` blocks that are compressed
/// independently, up to `compression_parallelism` at a time, and written in order. Returns the
/// compressed size.
///
/// While some of its blocks are compressing, an entry only starts another when a compression
/// slot is free right away, so busy CPUs stop it from reading further ahead: across all jobs,
/// at most one block per entry waits for a slot.
async fn deflate_entry(
    context: &EntryContext,
    reader: &mut SourceReader,
    sample: Option<Bytes>,
    digest: &mut EntryDigest,
    sink: &mut ArchiveSink,
) -> Result<u64, ProduceError> {
    if let Some(sample) = &sample {
        digest.update_uncompressed(sample);
    }
    let mut source = BlockSource {
        context,
        reader,
        digest,
        carry: sample,
        source_done: false,
        finished: false,
    };

    let level = context.level;
    let mut compressing: FuturesOrdered<BlockTask> = FuturesOrdered::new();
    let mut waiting = None;
    let mut compressed_size = 0u64;
    loop {
        while compressing.len() < context.compression_parallelism {
            if waiting.is_none() {
                waiting = source.next_block().await?;
            }
            let Some((block, last)) = waiting.take() else {
                break;
            };
            let slot = if compressing.is_empty() {
                compression_slot().await?
            } else if let Some(slot) = try_compression_slot() {
                slot
            } else {
                waiting = Some((block, last));
                break;
            };
            let work = move || deflate_block(level, &block, last);
            compressing.push_back(AbortOnDropHandle::new(spawn_compression(slot, work)));
        }

        let Some(out) = compressing.next().await else {
            return Ok(compressed_size);
        };
        let out = out.map_err(join_error)??;
        compressed_size += out.len() as u64;
        sink.write(Bytes::from(out)).await?;
    }
}

type BlockTask = AbortOnDropHandle<Result<Vec<u8>, ZipJobError>>;

/// Cuts a source into the blocks of [`deflate_block`](super::entry::deflate_block): full
/// `DEFLATE_BLOCK_BYTES` blocks, then a last block with the rest, which is empty when the size
/// is a multiple of the block size. Where the blocks end depends only on the size, never on
/// how the source chunks its stream.
struct BlockSource<'a> {
    context: &'a EntryContext,
    reader: &'a mut SourceReader,
    digest: &'a mut EntryDigest,
    /// Source bytes already read (and digested) but not yet in a block.
    carry: Option<Bytes>,
    source_done: bool,
    finished: bool,
}

impl BlockSource<'_> {
    /// The next block and whether it is the last.
    async fn next_block(&mut self) -> Result<Option<(Bytes, bool)>, ZipJobError> {
        if self.finished {
            return Ok(None);
        }

        let mut block = BytesMut::new();
        loop {
            let mut chunk = match self.carry.take() {
                Some(chunk) => chunk,
                None if self.source_done => break,
                None => match self.context.next_chunk(self.reader).await? {
                    Some(chunk) => {
                        self.digest.update_uncompressed(&chunk);
                        chunk
                    }
                    None => {
                        self.source_done = true;
                        break;
                    }
                },
            };

            let room = DEFLATE_BLOCK_BYTES - block.len();
            if chunk.len() > room {
                self.carry = Some(chunk.split_off(room));
            }
            if block.is_empty() && chunk.len() == DEFLATE_BLOCK_BYTES {
                return Ok(Some((chunk, false)));
            }
            if block.capacity() == 0 {
                block.reserve(DEFLATE_BLOCK_BYTES);
            }
            block.extend_from_slice(&chunk);
            if block.len() == DEFLATE_BLOCK_BYTES {
                return Ok(Some((block.freeze(), false)));
            }
        }

        self.finished = true;
        Ok(Some((block.freeze(), true)))
    }
}

/// Coalesces archive bytes into chunks of about `chunk_bytes` and hands them to the upload.
struct ArchiveSink {
    sender: mpsc::Sender<Result<Bytes, std::io::Error>>,
    pending: BytesMut,
    chunk_bytes: usize,
    written: u64,
    progress: Arc<ZipProgress>,
}

impl ArchiveSink {
    async fn write(&mut self, mut data: Bytes) -> Result<(), ProduceError> {
        if data.is_empty() {
            return Ok(());
        }

        self.written = self.written.checked_add(data.len() as u64).ok_or_else(|| {
            ZipJobError::new(ZipErrorCode::TooLarge, "archive exceeds 2^64 bytes")
        })?;

        if data.len() < PASSTHROUGH_BYTES {
            self.pending.extend_from_slice(&data);
            if self.pending.len() >= self.chunk_bytes {
                self.flush().await?;
            }
            return Ok(());
        }

        self.flush().await?;
        while data.len() > self.chunk_bytes {
            let chunk = data.split_to(self.chunk_bytes);
            self.send(chunk).await?;
        }
        self.send(data).await
    }

    async fn flush(&mut self) -> Result<(), ProduceError> {
        if self.pending.is_empty() {
            return Ok(());
        }
        let chunk = self.pending.split().freeze();
        self.send(chunk).await
    }

    async fn send(&mut self, chunk: Bytes) -> Result<(), ProduceError> {
        let len = chunk.len() as u64;
        self.sender
            .send(Ok(chunk))
            .await
            .map_err(|_| ProduceError::UploadClosed)?;
        ZipProgress::add(&self.progress.bytes_written, len);
        Ok(())
    }
}

/// The upload's input. It only ends cleanly once the producer has sealed it after the last
/// byte; if the producer stops early for any reason, the upload sees an error and aborts.
struct SealedStream {
    inner: ChannelByteStream,
    sealed: Arc<AtomicBool>,
}

impl Stream for SealedStream {
    type Item = Result<Bytes, std::io::Error>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.get_mut();
        match Pin::new(&mut this.inner).poll_next(cx) {
            Poll::Ready(None) if !this.sealed.load(Ordering::Acquire) => Poll::Ready(Some(Err(
                std::io::Error::other("the archive was not finished"),
            ))),
            other => other,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spawnable<F: Future + Send + 'static>(_: F) {}

    #[allow(dead_code)]
    fn build_archive_can_run_on_a_spawned_task(service: Arc<ObjectStoreService>, spec: ZipJobSpec) {
        spawnable(async move {
            build_archive(
                &service,
                &spec,
                &ZipSettings::default(),
                CancellationToken::new(),
                Arc::new(ZipProgress::new()),
                None,
            )
            .await
        });
    }
}
