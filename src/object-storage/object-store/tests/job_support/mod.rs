#![allow(dead_code)]

//! Service instances for zip job tests: each runs the real HTTP server on its own runtime and
//! thread, over one shared storage, and can be frozen, killed or shut down gracefully.

use std::collections::HashSet;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::task::Poll;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use bytes::Bytes;
use futures::StreamExt;
use object_store::metadata::MetadataStore;
use object_store::router::RouterOptions;
use object_store::server::serve;
use object_store::zip::{ZipJobManager, ZipJobSpec, ZipSettings};
use object_store::ObjectStoreService;
use object_store_backends::{
    Backend, BackendError, BackendResult, ByteRange, ByteStream, MultipartUpload, ObjectData,
    ObjectMetadata, ObjectPage, ObjectRangeData, PartReceipt, PublicUrlPurpose, PutOptions,
    SignedUrl, UploadLimits, Uploader, WritePrecondition,
};
use serde_json::Value;
use tokio::sync::{oneshot, watch};
use tokio_util::sync::CancellationToken;

use crate::pipeline_support::{zip_settings, TestBackend, KIB};

/// A lease no test outlives by accident, even on a loaded machine.
pub fn job_settings() -> ZipSettings {
    ZipSettings {
        small_entry_bytes: 64 * KIB,
        heartbeat_interval: Duration::from_secs(1),
        lease: Duration::from_secs(10),
        lease_skew_grace: Duration::from_millis(300),
        shutdown_grace: Duration::from_secs(5),
        max_wait: Duration::from_secs(10),
        wait_poll_interval: Duration::from_millis(200),
        ..zip_settings()
    }
}

/// For instances whose lease a test lets run out.
pub fn short_lease_settings() -> ZipSettings {
    ZipSettings {
        heartbeat_interval: Duration::from_millis(150),
        lease: Duration::from_millis(1500),
        ..job_settings()
    }
}

pub const JOB_RECORDS: &str = ".metadata/zip-jobs/";

pub const ROUTER: RouterOptions = RouterOptions {
    request_timeout: Duration::from_secs(30),
    upload_idle_timeout: Duration::from_secs(30),
    ..RouterOptions::DEFAULT
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Gate {
    Open,
    Frozen,
    Dead,
}

/// One instance's view of the shared storage. Frozen, every call and every open stream waits
/// until thawed, like a network partition; killed, they wait forever.
pub struct InstanceBackend {
    inner: Arc<TestBackend>,
    gate: watch::Sender<Gate>,
    panic_keys: Mutex<HashSet<String>>,
    fail_next_complete: AtomicBool,
    record_reads: AtomicU64,
}

impl InstanceBackend {
    fn new(inner: Arc<TestBackend>) -> Self {
        InstanceBackend {
            inner,
            gate: watch::Sender::new(Gate::Open),
            panic_keys: Mutex::default(),
            fail_next_complete: AtomicBool::new(false),
            record_reads: AtomicU64::new(0),
        }
    }

    pub fn freeze(&self) {
        self.gate.send_replace(Gate::Frozen);
    }

    pub fn thaw(&self) {
        self.gate.send_if_modified(|gate| {
            let thawed = *gate == Gate::Frozen;
            if thawed {
                *gate = Gate::Open;
            }
            thawed
        });
    }

    fn kill(&self) {
        self.gate.send_replace(Gate::Dead);
    }

    /// Reads of `key` (a full backend key) panic in whoever polls them.
    pub fn panic_on_read(&self, key: &str) {
        self.panic_keys.lock().unwrap().insert(key.to_string());
    }

    pub fn fail_next_complete(&self) {
        self.fail_next_complete.store(true, Ordering::SeqCst);
    }

    /// HEAD and GET requests this instance sent for zip job records.
    pub fn record_reads(&self) -> u64 {
        self.record_reads.load(Ordering::SeqCst)
    }

    fn count_read(&self, key: &str) {
        if key.starts_with(JOB_RECORDS) {
            self.record_reads.fetch_add(1, Ordering::SeqCst);
        }
    }

    async fn pass(&self) {
        let mut gate = self.gate.subscribe();
        let _ = gate.wait_for(|gate| *gate == Gate::Open).await;
    }

    fn gated(&self, key: &str, stream: ByteStream) -> ByteStream {
        if self.panic_keys.lock().unwrap().contains(key) {
            return Box::pin(futures::stream::poll_fn(
                |_| -> Poll<Option<std::io::Result<Bytes>>> { panic!("injected source panic") },
            ));
        }

        let gate = self.gate.subscribe();
        Box::pin(futures::stream::unfold(
            (gate, stream),
            |(mut gate, mut stream)| async move {
                let _ = gate.wait_for(|gate| *gate == Gate::Open).await;
                let item = stream.next().await?;
                Some((item, (gate, stream)))
            },
        ))
    }
}

struct GatedUpload {
    inner: Arc<dyn MultipartUpload>,
    backend: Arc<InstanceBackend>,
}

#[async_trait]
impl MultipartUpload for GatedUpload {
    async fn upload_part(
        &self,
        number: u32,
        offset: u64,
        data: Bytes,
    ) -> BackendResult<PartReceipt> {
        self.backend.pass().await;
        self.inner.upload_part(number, offset, data).await
    }

    async fn complete(&self, parts: Vec<PartReceipt>) -> BackendResult<ObjectMetadata> {
        self.backend.pass().await;
        if self
            .backend
            .fail_next_complete
            .swap(false, Ordering::SeqCst)
        {
            return Err(BackendError::Provider(
                "injected complete failure".to_string(),
            ));
        }
        self.inner.complete(parts).await
    }

    async fn abort(&self) {
        self.backend.pass().await;
        self.inner.abort().await
    }
}

/// `Backend` for an `Arc<InstanceBackend>`, so multipart uploads can hold on to the gate.
pub struct SharedInstanceBackend(pub Arc<InstanceBackend>);

#[async_trait]
impl Backend for SharedInstanceBackend {
    async fn init(&self) -> BackendResult<()> {
        Ok(())
    }

    fn uploader(&self) -> &Uploader {
        self.0.inner.uploader()
    }

    fn upload_limits(&self) -> UploadLimits {
        self.0.inner.upload_limits()
    }

    async fn put_single(
        &self,
        key: &str,
        data: Bytes,
        opts: &PutOptions,
    ) -> BackendResult<ObjectMetadata> {
        self.0.pass().await;
        self.0.inner.put_single(key, data, opts).await
    }

    async fn start_multipart(
        &self,
        key: &str,
        opts: &PutOptions,
    ) -> BackendResult<Arc<dyn MultipartUpload>> {
        self.0.pass().await;
        let inner = self.0.inner.start_multipart(key, opts).await?;
        Ok(Arc::new(GatedUpload {
            inner,
            backend: self.0.clone(),
        }))
    }

    async fn put_object_if(
        &self,
        key: &str,
        data: Bytes,
        content_type: Option<String>,
        precondition: WritePrecondition,
    ) -> BackendResult<ObjectMetadata> {
        self.0.pass().await;
        self.0
            .inner
            .put_object_if(key, data, content_type, precondition)
            .await
    }

    async fn get_object(&self, key: &str) -> BackendResult<ObjectData> {
        self.0.count_read(key);
        self.0.pass().await;
        let object = self.0.inner.get_object(key).await?;
        Ok(ObjectData {
            metadata: object.metadata,
            stream: self.0.gated(key, object.stream),
        })
    }

    async fn get_object_range(
        &self,
        key: &str,
        range: ByteRange,
    ) -> BackendResult<ObjectRangeData> {
        self.0.pass().await;
        let part = self.0.inner.get_object_range(key, range).await?;
        Ok(ObjectRangeData {
            stream: self.0.gated(key, part.stream),
            ..part
        })
    }

    async fn head_object(&self, key: &str) -> BackendResult<ObjectMetadata> {
        self.0.count_read(key);
        self.0.pass().await;
        self.0.inner.head_object(key).await
    }

    async fn delete_object(&self, key: &str) -> BackendResult<()> {
        self.0.pass().await;
        self.0.inner.delete_object(key).await
    }

    async fn list_objects(
        &self,
        prefix: Option<&str>,
        max_keys: Option<usize>,
        continuation_token: Option<&str>,
    ) -> BackendResult<ObjectPage> {
        self.0.pass().await;
        self.0
            .inner
            .list_objects(prefix, max_keys, continuation_token)
            .await
    }

    async fn get_public_url(
        &self,
        key: &str,
        expiration_secs: u64,
        purpose: PublicUrlPurpose,
    ) -> BackendResult<SignedUrl> {
        self.0
            .inner
            .get_public_url(key, expiration_secs, purpose)
            .await
    }
}

/// A service instance serving HTTP on `url`, on a single-threaded runtime of its own.
pub struct Instance {
    pub name: String,
    pub url: String,
    pub backend: Arc<InstanceBackend>,
    pub jobs: Arc<ZipJobManager>,
    shutdown: CancellationToken,
    kill: Option<oneshot::Sender<()>>,
    served: Option<oneshot::Receiver<std::io::Result<()>>>,
    thread: Option<std::thread::JoinHandle<()>>,
}

impl Instance {
    pub async fn start(storage: &Arc<TestBackend>, name: &str, settings: ZipSettings) -> Instance {
        let backend = Arc::new(InstanceBackend::new(storage.clone()));
        let shutdown = CancellationToken::new();
        let (ready_tx, ready_rx) = oneshot::channel();
        let (kill_tx, kill_rx) = oneshot::channel::<()>();
        let (served_tx, served_rx) = oneshot::channel();

        let thread = std::thread::spawn({
            let backend = backend.clone();
            let shutdown = shutdown.clone();
            let name = name.to_string();
            move || {
                let runtime = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .unwrap();

                runtime.block_on(async move {
                    let backend: Arc<dyn Backend> = Arc::new(SharedInstanceBackend(backend));
                    let metadata = Arc::new(MetadataStore::new(backend.clone()).await.unwrap());
                    let service = Arc::new(ObjectStoreService::new(backend, metadata));
                    let jobs = ZipJobManager::with_instance_id(service.clone(), settings, name);
                    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
                    let address = listener.local_addr().unwrap();
                    let _ = ready_tx.send((address, jobs.clone()));

                    tokio::select! {
                        served = serve(listener, service, jobs, ROUTER, shutdown) => {
                            let _ = served_tx.send(served);
                        }
                        _ = kill_rx => {}
                    }
                });

                runtime.shutdown_background();
            }
        });

        let (address, jobs) = ready_rx.await.unwrap();
        Instance {
            name: name.to_string(),
            url: format!("http://{}", address),
            backend,
            jobs,
            shutdown,
            kill: Some(kill_tx),
            served: Some(served_rx),
            thread: Some(thread),
        }
    }

    /// Like a crash: storage access stops dead, then every task is dropped without running
    /// any shutdown logic.
    pub fn kill(&mut self) {
        self.backend.kill();
        if let Some(kill) = self.kill.take() {
            let _ = kill.send(());
        }
        if let Some(thread) = self.thread.take() {
            thread.join().unwrap();
        }
    }

    /// Triggers a graceful shutdown and waits for the server to return.
    pub async fn shutdown(&mut self) -> Duration {
        let started = Instant::now();
        self.shutdown.cancel();
        if let Some(served) = self.served.take() {
            served.await.unwrap().unwrap();
        }
        if let Some(thread) = self.thread.take() {
            thread.join().unwrap();
        }
        self.kill.take();
        started.elapsed()
    }

    pub fn freeze(&self) {
        self.backend.freeze();
    }

    pub fn thaw(&self) {
        self.backend.thaw();
    }

    pub async fn put_job(&self, id: &str, spec: &ZipJobSpec, wait: Option<f64>) -> Reply {
        let body = serde_json::to_vec(spec).unwrap();
        request(
            reqwest::Method::PUT,
            &self.job_url(id, wait),
            Some(body),
            None,
        )
        .await
    }

    pub async fn put_job_raw(&self, id: &str, body: Vec<u8>, wait: Option<f64>) -> Reply {
        request(
            reqwest::Method::PUT,
            &self.job_url(id, wait),
            Some(body),
            None,
        )
        .await
    }

    pub async fn get_job(&self, id: &str, wait: Option<f64>) -> Reply {
        request(reqwest::Method::GET, &self.job_url(id, wait), None, None).await
    }

    pub async fn delete_job(&self, id: &str) -> Reply {
        request(reqwest::Method::DELETE, &self.job_url(id, None), None, None).await
    }

    pub fn job_url(&self, id: &str, wait: Option<f64>) -> String {
        match wait {
            Some(wait) => format!("{}/zip-jobs/{}?wait={}", self.url, id, wait),
            None => format!("{}/zip-jobs/{}", self.url, id),
        }
    }

    pub async fn get_object(&self, bucket: &str, key: &str) -> (u16, Bytes) {
        let response = reqwest::Client::new()
            .get(format!("{}/buckets/{}/objects/{}", self.url, bucket, key))
            .send()
            .await
            .unwrap();
        let status = response.status().as_u16();
        (status, response.bytes().await.unwrap())
    }

    /// Polls `GET` until the job ends.
    pub async fn wait_until_ended(&self, id: &str, limit: Duration) -> Value {
        let started = Instant::now();
        loop {
            let reply = self.get_job(id, Some(2.0)).await;
            if reply.status == 200 {
                return reply.body;
            }
            assert_eq!(reply.status, 202, "{}", reply.body);
            assert!(
                started.elapsed() < limit,
                "job {id} still {} after {:?}",
                reply.body["state"],
                limit
            );
        }
    }

    /// Polls until at least `count` requests on this instance are waiting for a job to end.
    pub async fn wait_for_waiters(&self, count: usize, limit: Duration) {
        let started = Instant::now();
        while self.jobs.waiting_requests() < count {
            assert!(
                started.elapsed() < limit,
                "{} has {} of {count} waiters after {:?}",
                self.name,
                self.jobs.waiting_requests(),
                limit
            );
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }

    /// Polls until this instance has no attempt left in flight.
    pub async fn wait_until_idle(&self, limit: Duration) {
        let started = Instant::now();
        while self.jobs.active_jobs() > 0 {
            assert!(
                started.elapsed() < limit,
                "{} still has {} jobs after {:?}",
                self.name,
                self.jobs.active_jobs(),
                limit
            );
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    }
}

impl Drop for Instance {
    fn drop(&mut self) {
        if self.thread.is_some() {
            self.kill();
        }
    }
}

#[derive(Debug)]
pub struct Reply {
    pub status: u16,
    pub body: Value,
    pub retry_after: Option<String>,
    pub elapsed: Duration,
}

pub async fn request(
    method: reqwest::Method,
    url: &str,
    body: Option<Vec<u8>>,
    timeout: Option<Duration>,
) -> Reply {
    let started = Instant::now();
    let client = reqwest::Client::new();
    let mut builder = client.request(method, url);
    if let Some(body) = body {
        builder = builder
            .header("content-type", "application/json")
            .body(body);
    }
    if let Some(timeout) = timeout {
        builder = builder.timeout(timeout);
    }

    let response = builder.send().await.unwrap();
    let status = response.status().as_u16();
    let retry_after = response
        .headers()
        .get("retry-after")
        .map(|value| value.to_str().unwrap().to_string());
    let bytes = response.bytes().await.unwrap();
    let body = serde_json::from_slice(&bytes)
        .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()));

    Reply {
        status,
        body,
        retry_after,
        elapsed: started.elapsed(),
    }
}

/// Sends a request byte for byte, so paths like `/zip-jobs/..` arrive unnormalized. Returns
/// the status code.
pub fn raw_request(url: &str, method: &str, path: &str, body: &[u8]) -> u16 {
    let address = url.trim_start_matches("http://");
    let mut stream = std::net::TcpStream::connect(address).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .unwrap();

    // One write, so the server has the whole request at hand even when it answers without
    // reading the body: body bytes arriving after it closed the connection would reset it and
    // could take the response with them.
    let mut request = format!(
        "{method} {path} HTTP/1.1\r\nHost: {address}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    )
    .into_bytes();
    request.extend_from_slice(body);
    stream.write_all(&request).unwrap();

    let mut response = Vec::new();
    let mut buffer = [0u8; 4096];
    while let Ok(read @ 1..) = stream.read(&mut buffer) {
        response.extend_from_slice(&buffer[..read]);
    }
    let response = String::from_utf8_lossy(&response);
    let status_line = response.lines().next().unwrap_or_default();
    status_line
        .split(' ')
        .nth(1)
        .and_then(|code| code.parse().ok())
        .unwrap_or_else(|| panic!("unexpected response: {response}"))
}

pub fn timestamp(value: &Value) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::parse_from_rfc3339(value.as_str().unwrap_or_else(|| panic!("{value}")))
        .unwrap()
        .with_timezone(&chrono::Utc)
}
