use bytes::Bytes;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use object_store_backends::{Backend, BackendError, ObjectPage, WritePrecondition};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tracing::warn;

use crate::error::{ServiceError, ServiceResult};
use crate::zip::{ArchiveResult, ZipErrorCode, ZipJobError, ZipProgressSnapshot};

pub(crate) const JOBS_PREFIX: &str = ".metadata/zip-jobs/";

pub const MAX_JOB_ID_BYTES: usize = 128;

/// Reads of one record that may each find it replaced while it was being read.
const MAX_READ_ATTEMPTS: usize = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ZipJobState {
    Queued,
    Running,
    Completed,
    Failed,
    Canceled,
}

impl ZipJobState {
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            ZipJobState::Completed | ZipJobState::Failed | ZipJobState::Canceled
        )
    }
}

/// The persisted state of a zip job, stored at `.metadata/zip-jobs/<id>.json` and returned by
/// the job API as is. The spec is not stored; `spec_hash` identifies it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZipJob {
    pub id: String,
    pub state: ZipJobState,
    pub attempt: u32,
    pub spec_hash: String,
    /// The instance running the current attempt, or the last one that did.
    pub owner: String,
    pub progress: ZipProgressSnapshot,
    pub result: Option<ArchiveResult>,
    pub error: Option<ZipJobError>,
    /// Set while the job is queued or running; the owner keeps pushing it forward.
    pub lease_expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// When the current attempt got a slot and started building.
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
}

impl ZipJob {
    pub(crate) fn first_attempt(
        id: &str,
        spec_hash: &str,
        owner: &str,
        now: DateTime<Utc>,
        lease: Duration,
    ) -> Self {
        ZipJob {
            id: id.to_string(),
            state: ZipJobState::Queued,
            attempt: 1,
            spec_hash: spec_hash.to_string(),
            owner: owner.to_string(),
            progress: ZipProgressSnapshot::default(),
            result: None,
            error: None,
            lease_expires_at: Some(lease_deadline(now, lease)),
            created_at: now,
            updated_at: now,
            started_at: None,
            finished_at: None,
        }
    }

    pub(crate) fn next_attempt(&self, owner: &str, now: DateTime<Utc>, lease: Duration) -> Self {
        ZipJob {
            attempt: self.attempt.saturating_add(1),
            created_at: self.created_at,
            ..ZipJob::first_attempt(&self.id, &self.spec_hash, owner, now, lease)
        }
    }

    pub fn is_active(&self) -> bool {
        !self.state.is_terminal()
    }

    /// Whether the runner of this queued or running job is presumed dead: its lease ran out
    /// more than `grace` ago.
    pub fn lease_expired(&self, now: DateTime<Utc>, grace: Duration) -> bool {
        if !self.is_active() {
            return false;
        }

        match self.lease_expires_at {
            Some(expires_at) => now > lease_deadline(expires_at, grace),
            None => true,
        }
    }

    pub(crate) fn is_attempt(&self, owner: &str, attempt: u32) -> bool {
        self.is_active() && self.owner == owner && self.attempt == attempt
    }

    pub(crate) fn finish(
        &mut self,
        outcome: Result<ArchiveResult, ZipJobError>,
        now: DateTime<Utc>,
    ) {
        match outcome {
            Ok(result) => {
                self.state = ZipJobState::Completed;
                self.result = Some(result);
                self.error = None;
            }
            Err(error) if error.code == ZipErrorCode::Canceled => {
                self.state = ZipJobState::Canceled;
                self.error = Some(error);
            }
            Err(error) => {
                self.state = ZipJobState::Failed;
                self.error = Some(error);
            }
        }

        self.lease_expires_at = None;
        self.updated_at = now;
        self.finished_at = Some(now);
    }
}

pub(crate) fn lease_deadline(from: DateTime<Utc>, lease: Duration) -> DateTime<Utc> {
    from + chrono::Duration::from_std(lease).unwrap_or(chrono::Duration::MAX)
}

/// Job ids become object keys, so they are limited to a charset that cannot form a path.
pub fn validate_job_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > MAX_JOB_ID_BYTES {
        return Err(format!(
            "a job id must be 1 to {} characters long",
            MAX_JOB_ID_BYTES
        ));
    }

    if id.starts_with('.') {
        return Err("a job id may not start with a dot".to_string());
    }

    if !id
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
    {
        return Err("a job id may only contain A-Z, a-z, 0-9, '.', '_' and '-'".to_string());
    }

    Ok(())
}

#[derive(Debug, Clone)]
pub(crate) struct StoredJob {
    pub job: ZipJob,
    pub etag: String,
}

/// Job records in the backend. Every write is a compare-and-swap; `None` means the record
/// changed (or appeared) underneath and the caller has to re-read and decide again.
#[derive(Clone)]
pub(crate) struct JobStore {
    backend: Arc<dyn Backend>,
}

impl JobStore {
    pub fn new(backend: Arc<dyn Backend>) -> Self {
        JobStore { backend }
    }

    pub fn key(id: &str) -> String {
        format!("{}{}.json", JOBS_PREFIX, id)
    }

    pub fn id_of(key: &str) -> Option<&str> {
        key.strip_prefix(JOBS_PREFIX)?.strip_suffix(".json")
    }

    pub async fn read(&self, id: &str) -> ServiceResult<Option<StoredJob>> {
        let key = Self::key(id);

        // The ETag comes from a HEAD taken before the read, so it is never newer than the data:
        // a write landing in between makes the next CAS fail instead of overwriting state this
        // reader never saw.
        let mut etag = match self.head_etag(&key).await? {
            Some(etag) => etag,
            None => return Ok(None),
        };

        let mut attempt = 0;
        loop {
            attempt += 1;
            let error = match self.read_data(&key).await {
                Ok(Some(data)) => {
                    let job: ZipJob = serde_json::from_slice(&data)?;
                    return Ok(Some(StoredJob { job, etag }));
                }
                Ok(None) => return Ok(None),
                Err(error) => error,
            };

            // Backends that pin a read to the ETag they saw first (Azure) fail it when the
            // record is replaced meanwhile; that is a newer record to read, not an error.
            match self.head_etag(&key).await? {
                None => return Ok(None),
                Some(current) if current != etag && attempt < MAX_READ_ATTEMPTS => etag = current,
                Some(_) => return Err(error),
            }
        }
    }

    async fn head_etag(&self, key: &str) -> ServiceResult<Option<String>> {
        match self.backend.head_object(key).await {
            Ok(head) => Ok(Some(head.etag)),
            Err(BackendError::NotFound(_)) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    async fn read_data(&self, key: &str) -> ServiceResult<Option<Vec<u8>>> {
        let mut object = match self.backend.get_object(key).await {
            Ok(object) => object,
            Err(BackendError::NotFound(_)) => return Ok(None),
            Err(error) => return Err(error.into()),
        };

        let mut data = Vec::new();
        while let Some(chunk) = object.stream.next().await {
            let chunk = chunk.map_err(|error| ServiceError::Internal(error.to_string()))?;
            data.extend_from_slice(&chunk);
        }
        Ok(Some(data))
    }

    pub async fn create(&self, job: &ZipJob) -> ServiceResult<Option<StoredJob>> {
        self.write(job, WritePrecondition::IfAbsent).await
    }

    pub async fn replace(&self, job: &ZipJob, etag: &str) -> ServiceResult<Option<StoredJob>> {
        self.write(job, WritePrecondition::IfMatch(etag.to_string()))
            .await
    }

    async fn write(
        &self,
        job: &ZipJob,
        precondition: WritePrecondition,
    ) -> ServiceResult<Option<StoredJob>> {
        let data = Bytes::from(serde_json::to_vec(job)?);

        match self
            .backend
            .put_object_if(
                &Self::key(&job.id),
                data,
                Some("application/json".to_string()),
                precondition,
            )
            .await
        {
            Ok(metadata) => Ok(Some(StoredJob {
                job: job.clone(),
                etag: metadata.etag,
            })),
            Err(BackendError::PreconditionFailed(_)) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    pub async fn list(&self, max_keys: usize, token: Option<&str>) -> ServiceResult<ObjectPage> {
        match self
            .backend
            .list_objects(Some(JOBS_PREFIX), Some(max_keys), token)
            .await
        {
            Ok(page) => Ok(page),
            Err(BackendError::NotFound(_)) => Ok(ObjectPage {
                objects: Vec::new(),
                next_continuation_token: None,
            }),
            Err(error) => Err(error.into()),
        }
    }

    /// Deletes the record if it is still the version with `etag`, the version the caller judged;
    /// returns whether it is gone. Backends have no conditional delete, so a write landing
    /// between the final check and the delete is still lost. The owner of an attempt deleted
    /// that way writes its record again (see `Lease::update`); a record written after the
    /// delete is left alone and reported as not deleted.
    pub async fn delete_if_unchanged(&self, id: &str, etag: &str) -> ServiceResult<bool> {
        let key = Self::key(id);

        if self.head_etag(&key).await?.as_deref() != Some(etag) {
            return Ok(false);
        }

        match self.backend.delete_object(&key).await {
            Ok(()) | Err(BackendError::NotFound(_)) => {}
            Err(error) => return Err(error.into()),
        }

        match self.head_etag(&key).await? {
            None => Ok(true),
            Some(current) => {
                warn!(
                    "Zip job record {} was written again while it was being deleted ({} -> {}); kept it",
                    id, etag, current
                );
                Ok(false)
            }
        }
    }
}

#[cfg(test)]
pub(super) mod testing {
    use super::*;
    use async_trait::async_trait;
    use object_store_backends::local::LocalBackend;
    use object_store_backends::{
        BackendResult, ByteRange, MultipartUpload, ObjectData, ObjectMetadata, ObjectRangeData,
        PublicUrlPurpose, PutOptions, SignedUrl, UploadLimits, Uploader,
    };
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::Mutex;
    use tempfile::TempDir;

    /// A local backend whose conditional writes can be made to fail, and whose deletes can be
    /// followed by a racing write.
    pub struct FaultyBackend {
        inner: LocalBackend,
        pub conditional_writes: AtomicUsize,
        /// Conditional writes still to fail with a transient error.
        pub transient_failures: AtomicUsize,
        pub fail_preconditions: AtomicBool,
        /// Written to the deleted key right after the next delete.
        pub write_after_delete: Mutex<Option<Bytes>>,
    }

    impl FaultyBackend {
        pub async fn new() -> (TempDir, Arc<Self>) {
            let dir = TempDir::new().unwrap();
            let inner = LocalBackend::new(dir.path().to_path_buf(), "jobs".to_string());
            inner.init().await.unwrap();
            let backend = Arc::new(FaultyBackend {
                inner,
                conditional_writes: AtomicUsize::new(0),
                transient_failures: AtomicUsize::new(0),
                fail_preconditions: AtomicBool::new(false),
                write_after_delete: Mutex::new(None),
            });
            (dir, backend)
        }

        pub fn store(self: &Arc<Self>) -> JobStore {
            JobStore::new(self.clone())
        }

        pub fn writes(&self) -> usize {
            self.conditional_writes.load(Ordering::SeqCst)
        }
    }

    #[async_trait]
    impl Backend for FaultyBackend {
        async fn init(&self) -> BackendResult<()> {
            self.inner.init().await
        }

        fn uploader(&self) -> &Uploader {
            self.inner.uploader()
        }

        fn upload_limits(&self) -> UploadLimits {
            self.inner.upload_limits()
        }

        async fn put_single(
            &self,
            key: &str,
            data: Bytes,
            opts: &PutOptions,
        ) -> BackendResult<ObjectMetadata> {
            self.inner.put_single(key, data, opts).await
        }

        async fn start_multipart(
            &self,
            key: &str,
            opts: &PutOptions,
        ) -> BackendResult<Arc<dyn MultipartUpload>> {
            self.inner.start_multipart(key, opts).await
        }

        async fn put_object_if(
            &self,
            key: &str,
            data: Bytes,
            content_type: Option<String>,
            precondition: WritePrecondition,
        ) -> BackendResult<ObjectMetadata> {
            self.conditional_writes.fetch_add(1, Ordering::SeqCst);
            let transient = self
                .transient_failures
                .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |left| {
                    left.checked_sub(1)
                })
                .is_ok();
            if transient {
                return Err(BackendError::Retryable(format!("{} throttled", key)));
            }
            if self.fail_preconditions.load(Ordering::SeqCst) {
                return Err(BackendError::PreconditionFailed(key.to_string()));
            }
            self.inner
                .put_object_if(key, data, content_type, precondition)
                .await
        }

        async fn get_object(&self, key: &str) -> BackendResult<ObjectData> {
            self.inner.get_object(key).await
        }

        async fn get_object_range(
            &self,
            key: &str,
            range: ByteRange,
        ) -> BackendResult<ObjectRangeData> {
            self.inner.get_object_range(key, range).await
        }

        async fn head_object(&self, key: &str) -> BackendResult<ObjectMetadata> {
            self.inner.head_object(key).await
        }

        async fn delete_object(&self, key: &str) -> BackendResult<()> {
            self.inner.delete_object(key).await?;
            let racing = self
                .write_after_delete
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .take();
            if let Some(data) = racing {
                self.inner
                    .put_single(key, data, &PutOptions::default())
                    .await?;
            }
            Ok(())
        }

        async fn list_objects(
            &self,
            prefix: Option<&str>,
            max_keys: Option<usize>,
            continuation_token: Option<&str>,
        ) -> BackendResult<ObjectPage> {
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
}

#[cfg(test)]
mod tests {
    use super::testing::FaultyBackend;
    use super::*;

    async fn ended_record(store: &JobStore) -> StoredJob {
        let mut ended = job(ZipJobState::Running, None);
        ended.finish(Err(ZipJobError::internal("boom")), Utc::now());
        store.create(&ended).await.unwrap().unwrap()
    }

    #[tokio::test]
    async fn deletes_an_unchanged_record() {
        let (_dir, backend) = FaultyBackend::new().await;
        let store = backend.store();
        let stored = ended_record(&store).await;

        assert!(store
            .delete_if_unchanged("job", &stored.etag)
            .await
            .unwrap());
        assert!(store.read("job").await.unwrap().is_none());
    }

    #[tokio::test]
    async fn keeps_a_record_rewritten_after_it_was_read() {
        let (_dir, backend) = FaultyBackend::new().await;
        let store = backend.store();
        let stored = ended_record(&store).await;
        let resubmitted = stored
            .job
            .next_attempt("other", Utc::now(), Duration::from_secs(60));
        store
            .replace(&resubmitted, &stored.etag)
            .await
            .unwrap()
            .unwrap();

        assert!(!store
            .delete_if_unchanged("job", &stored.etag)
            .await
            .unwrap());
        assert_eq!(store.read("job").await.unwrap().unwrap().job, resubmitted);
    }

    #[tokio::test]
    async fn keeps_a_record_written_while_it_was_deleted() {
        let (_dir, backend) = FaultyBackend::new().await;
        let store = backend.store();
        let stored = ended_record(&store).await;
        let recreated = ZipJob::first_attempt("job", "hash", "other", Utc::now(), Duration::ZERO);
        *backend.write_after_delete.lock().unwrap() =
            Some(Bytes::from(serde_json::to_vec(&recreated).unwrap()));

        assert!(!store
            .delete_if_unchanged("job", &stored.etag)
            .await
            .unwrap());
        assert_eq!(store.read("job").await.unwrap().unwrap().job, recreated);
    }

    fn job(state: ZipJobState, lease_expires_at: Option<DateTime<Utc>>) -> ZipJob {
        let now = Utc::now();
        ZipJob {
            state,
            lease_expires_at,
            ..ZipJob::first_attempt("job", "hash", "me", now, Duration::from_secs(60))
        }
    }

    #[test]
    fn accepts_only_safe_job_ids() {
        for id in ["a", "export-1", "A.b_c-9", &"x".repeat(MAX_JOB_ID_BYTES)] {
            validate_job_id(id).unwrap();
        }

        for id in [
            "",
            ".",
            "..",
            ".hidden",
            "a/b",
            "a\\b",
            "a b",
            "a%2Fb",
            "ä",
            "a\0",
            &"x".repeat(MAX_JOB_ID_BYTES + 1),
        ] {
            assert!(validate_job_id(id).is_err(), "{id:?}");
        }
    }

    #[test]
    fn maps_store_keys_back_to_ids() {
        assert_eq!(JobStore::key("abc"), ".metadata/zip-jobs/abc.json");
        assert_eq!(JobStore::id_of(".metadata/zip-jobs/abc.json"), Some("abc"));
        assert_eq!(JobStore::id_of(".metadata/buckets/abc.json"), None);
    }

    #[test]
    fn treats_only_active_jobs_past_lease_and_grace_as_expired() {
        let now = Utc::now();
        let grace = Duration::from_secs(10);
        let ago = |s| Some(now - chrono::Duration::seconds(s));

        assert!(!job(ZipJobState::Running, ago(5)).lease_expired(now, grace));
        assert!(job(ZipJobState::Running, ago(11)).lease_expired(now, grace));
        assert!(job(ZipJobState::Queued, ago(11)).lease_expired(now, grace));
        assert!(job(ZipJobState::Queued, None).lease_expired(now, grace));
        for state in [
            ZipJobState::Completed,
            ZipJobState::Failed,
            ZipJobState::Canceled,
        ] {
            assert!(!job(state, ago(100)).lease_expired(now, grace));
        }
    }

    #[test]
    fn starts_a_clean_next_attempt() {
        let now = Utc::now();
        let mut first = job(ZipJobState::Running, Some(now));
        first.progress.entries_done = 3;
        first.finish(Err(ZipJobError::internal("boom")), now);
        assert_eq!(first.state, ZipJobState::Failed);
        assert_eq!(first.lease_expires_at, None);

        let next = first.next_attempt("other", now, Duration::from_secs(60));
        assert_eq!(next.attempt, 2);
        assert_eq!(next.state, ZipJobState::Queued);
        assert_eq!(next.owner, "other");
        assert_eq!(next.created_at, first.created_at);
        assert_eq!(next.error, None);
        assert_eq!(next.progress, ZipProgressSnapshot::default());
        assert_eq!(next.finished_at, None);
        assert!(next.lease_expires_at.unwrap() > now);
    }

    #[test]
    fn serializes_the_documented_shape() {
        let now = DateTime::parse_from_rfc3339("2026-01-02T03:04:05Z")
            .unwrap()
            .with_timezone(&Utc);
        let mut job = ZipJob::first_attempt("j", "h", "i", now, Duration::from_secs(60));
        job.finish(
            Ok(ArchiveResult {
                size: 10,
                sha256: "s".to_string(),
                etag: "e".to_string(),
                renamed_entries: vec![],
            }),
            now,
        );

        let value = serde_json::to_value(&job).unwrap();
        assert_eq!(value["state"], "completed");
        assert_eq!(value["specHash"], "h");
        assert_eq!(value["result"]["renamedEntries"], serde_json::json!([]));
        assert_eq!(value["progress"]["entriesTotal"], 0);
        assert_eq!(value["leaseExpiresAt"], serde_json::Value::Null);
        assert_eq!(value["createdAt"], "2026-01-02T03:04:05Z");
        let parsed: ZipJob = serde_json::from_value(value).unwrap();
        assert_eq!(parsed, job);
    }
}
