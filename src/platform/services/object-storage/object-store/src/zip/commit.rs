use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use bytes::Bytes;
use futures::future::BoxFuture;
use object_store_backends::{
    Backend, BackendError, BackendResult, ByteRange, MultipartUpload, ObjectData, ObjectMetadata,
    ObjectPage, ObjectRangeData, PartReceipt, PublicUrlPurpose, PutOptions, SignedUrl,
    UploadLimits, Uploader, WritePrecondition,
};
use tokio_util::sync::CancellationToken;

use super::error::ZipJobError;

/// Runs once, immediately before the archive is committed (the single-request put, or the
/// multipart completion). An error vetoes the commit: the upload is aborted, nothing is written
/// to the destination, and the archive fails with that error.
pub type CommitCheck = Box<dyn FnOnce() -> BoxFuture<'static, Result<(), ZipJobError>> + Send>;

const OPEN: u8 = 0;
const CHECKING: u8 = 1;
const COMMITTING: u8 = 2;
const CANCELED: u8 = 3;
const REFUSED: u8 = 4;

/// Decides, exactly once, whether the upload commits or is canceled, so a cancellation either
/// prevents the commit or arrives after it has started and is ignored. Once the check has run,
/// only the approval it gave lets later commit calls (retries) through.
pub(crate) struct CommitGate {
    state: AtomicU8,
    check: Mutex<Option<CommitCheck>>,
    veto: Mutex<Option<ZipJobError>>,
    cancel: CancellationToken,
    started: Mutex<Option<Arc<dyn MultipartUpload>>>,
}

impl CommitGate {
    pub fn new(check: Option<CommitCheck>, cancel: CancellationToken) -> Self {
        CommitGate {
            state: AtomicU8::new(OPEN),
            check: Mutex::new(check),
            veto: Mutex::new(None),
            cancel,
            started: Mutex::new(None),
        }
    }

    async fn approve(&self) -> BackendResult<()> {
        match self
            .state
            .compare_exchange(OPEN, CHECKING, Ordering::AcqRel, Ordering::Acquire)
        {
            Ok(_) => {}
            Err(COMMITTING) => return Ok(()),
            Err(CHECKING) => {
                return Err(BackendError::Conflict(
                    "archive commit refused: the commit is already being checked".to_string(),
                ))
            }
            Err(_) => return Err(self.refused()),
        }

        let check = lock(&self.check).take();
        if let Some(check) = check {
            if let Err(error) = check().await {
                let refused = self.refuse(error);
                let _ = self.state.compare_exchange(
                    CHECKING,
                    REFUSED,
                    Ordering::AcqRel,
                    Ordering::Acquire,
                );
                return Err(refused);
            }
        }

        if self.cancel.is_cancelled() {
            self.cancel();
        }

        match self
            .state
            .compare_exchange(CHECKING, COMMITTING, Ordering::AcqRel, Ordering::Acquire)
        {
            Ok(_) => Ok(()),
            Err(_) => Err(self.refuse(ZipJobError::canceled())),
        }
    }

    fn refuse(&self, error: ZipJobError) -> BackendError {
        let refused = refusal(&error);
        lock(&self.veto).get_or_insert(error);
        refused
    }

    fn refused(&self) -> BackendError {
        refusal(
            &lock(&self.veto)
                .clone()
                .unwrap_or_else(ZipJobError::canceled),
        )
    }

    /// Cancels unless the commit has started; returns whether the archive is now canceled.
    pub fn cancel(&self) -> bool {
        match self
            .state
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |state| match state {
                OPEN | CHECKING => Some(CANCELED),
                _ => None,
            }) {
            Ok(_) => true,
            Err(state) => state != COMMITTING,
        }
    }

    pub fn veto(&self) -> Option<ZipJobError> {
        lock(&self.veto).clone()
    }

    /// Aborts the multipart upload, if one was started, after its driver was dropped.
    pub async fn abort_started(&self) {
        let started = lock(&self.started).take();
        if let Some(upload) = started {
            upload.abort().await;
        }
    }
}

fn refusal(error: &ZipJobError) -> BackendError {
    BackendError::Conflict(format!("archive commit refused: {}", error))
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// The destination backend as the uploader sees it: every call goes to `inner`, but committing
/// first has to pass the gate.
pub(crate) struct GatedBackend {
    pub inner: Arc<dyn Backend>,
    pub gate: Arc<CommitGate>,
}

struct GatedUpload {
    inner: Arc<dyn MultipartUpload>,
    gate: Arc<CommitGate>,
}

#[async_trait]
impl MultipartUpload for GatedUpload {
    async fn upload_part(
        &self,
        number: u32,
        offset: u64,
        data: Bytes,
    ) -> BackendResult<PartReceipt> {
        self.inner.upload_part(number, offset, data).await
    }

    async fn complete(&self, parts: Vec<PartReceipt>) -> BackendResult<ObjectMetadata> {
        self.gate.approve().await?;
        self.inner.complete(parts).await
    }

    async fn abort(&self) {
        self.inner.abort().await
    }
}

#[async_trait]
impl Backend for GatedBackend {
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
        self.gate.approve().await?;
        self.inner.put_single(key, data, opts).await
    }

    async fn start_multipart(
        &self,
        key: &str,
        opts: &PutOptions,
    ) -> BackendResult<Arc<dyn MultipartUpload>> {
        let inner = self.inner.start_multipart(key, opts).await?;
        *lock(&self.gate.started) = Some(inner.clone());

        Ok(Arc::new(GatedUpload {
            inner,
            gate: self.gate.clone(),
        }))
    }

    async fn put_object_if(
        &self,
        key: &str,
        data: Bytes,
        content_type: Option<String>,
        precondition: WritePrecondition,
    ) -> BackendResult<ObjectMetadata> {
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
        self.inner.delete_object(key).await
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::zip::ZipErrorCode;
    use futures::FutureExt;
    use std::sync::atomic::AtomicUsize;
    use tokio::sync::oneshot;

    fn counting_check(
        calls: &Arc<AtomicUsize>,
        verdict: Result<(), ZipJobError>,
    ) -> Option<CommitCheck> {
        let calls = calls.clone();
        Some(Box::new(move || {
            calls.fetch_add(1, Ordering::SeqCst);
            async move { verdict }.boxed()
        }))
    }

    /// A check that reports when it starts and passes once released.
    fn held_check() -> (CommitCheck, oneshot::Receiver<()>, oneshot::Sender<()>) {
        let (started, on_start) = oneshot::channel();
        let (release, released) = oneshot::channel::<()>();
        let check: CommitCheck = Box::new(move || {
            async move {
                let _ = started.send(());
                let _ = released.await;
                Ok(())
            }
            .boxed()
        });
        (check, on_start, release)
    }

    #[tokio::test]
    async fn stays_refused_after_a_veto() {
        let calls = Arc::new(AtomicUsize::new(0));
        let lost = ZipJobError::new(ZipErrorCode::LeaseExpired, "lease taken over");
        let gate = CommitGate::new(
            counting_check(&calls, Err(lost.clone())),
            CancellationToken::new(),
        );

        for _ in 0..3 {
            let refused = gate.approve().await;
            assert!(
                matches!(&refused, Err(BackendError::Conflict(message)) if message.contains("lease taken over")),
                "{refused:?}"
            );
        }
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert_eq!(gate.veto(), Some(lost));
    }

    #[tokio::test]
    async fn lets_retried_commits_through_after_an_approval() {
        let calls = Arc::new(AtomicUsize::new(0));
        let gate = CommitGate::new(counting_check(&calls, Ok(())), CancellationToken::new());

        gate.approve().await.unwrap();
        gate.approve().await.unwrap();

        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert!(!gate.cancel());
        assert_eq!(gate.veto(), None);
    }

    #[tokio::test]
    async fn refuses_a_second_commit_while_the_check_runs() {
        let (check, on_start, release) = held_check();
        let gate = Arc::new(CommitGate::new(Some(check), CancellationToken::new()));
        let first = tokio::spawn({
            let gate = gate.clone();
            async move { gate.approve().await }
        });
        on_start.await.unwrap();

        assert!(matches!(
            gate.approve().await,
            Err(BackendError::Conflict(_))
        ));

        release.send(()).unwrap();
        first.await.unwrap().unwrap();
        gate.approve().await.unwrap();
        assert_eq!(gate.veto(), None);
    }

    #[tokio::test]
    async fn a_cancel_during_the_check_prevents_the_commit() {
        let (check, on_start, release) = held_check();
        let gate = Arc::new(CommitGate::new(Some(check), CancellationToken::new()));
        let first = tokio::spawn({
            let gate = gate.clone();
            async move { gate.approve().await }
        });
        on_start.await.unwrap();

        assert!(gate.cancel());
        release.send(()).unwrap();

        assert!(first.await.unwrap().is_err());
        assert!(gate.approve().await.is_err());
        assert!(gate.cancel());
        assert_eq!(gate.veto(), Some(ZipJobError::canceled()));
    }
}
