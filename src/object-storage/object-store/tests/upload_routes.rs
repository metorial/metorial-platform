use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use bytes::Bytes;
use object_store::metadata::MetadataStore;
use object_store::router::{create_router_with_options, RouterOptions};
use object_store::service::ObjectStoreService;
use object_store_backends::{
    local::LocalBackend, Backend, BackendError, BackendResult, ByteRange, ByteStream,
    MultipartUpload, ObjectData, ObjectMetadata, ObjectPage, ObjectRangeData, PublicUrlPurpose,
    PutOptions, SignedUrl, UploadLimits, UploadedObject, Uploader, WritePrecondition,
};
use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tempfile::TempDir;
use tower::ServiceExt;

/// The local backend, recording the size hint of every streamed upload. It can also hold an
/// upload before reading its body, or fail it as storage would.
struct RecordingBackend {
    inner: LocalBackend,
    size_hints: Mutex<Vec<Option<u64>>>,
    hold_uploads: Mutex<Duration>,
    fail_uploads: AtomicBool,
}

#[async_trait]
impl Backend for RecordingBackend {
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

    async fn put_object_stream(
        &self,
        key: &str,
        stream: ByteStream,
        opts: PutOptions,
    ) -> BackendResult<UploadedObject> {
        self.size_hints.lock().unwrap().push(opts.size_hint);
        let hold = *self.hold_uploads.lock().unwrap();
        tokio::time::sleep(hold).await;
        if self.fail_uploads.load(Ordering::SeqCst) {
            return Err(BackendError::Provider(
                "storage refused the write".to_string(),
            ));
        }
        self.inner.put_object_stream(key, stream, opts).await
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

struct Harness {
    app: Router,
    backend: Arc<RecordingBackend>,
    _dir: TempDir,
}

const SHORT: RouterOptions = RouterOptions {
    request_timeout: Duration::from_millis(200),
    upload_idle_timeout: Duration::from_millis(400),
    ..RouterOptions::DEFAULT
};

async fn harness(options: RouterOptions) -> Harness {
    let dir = TempDir::new().unwrap();
    let backend = Arc::new(RecordingBackend {
        inner: LocalBackend::new(dir.path().to_path_buf(), "physical".to_string()),
        size_hints: Mutex::default(),
        hold_uploads: Mutex::default(),
        fail_uploads: AtomicBool::new(false),
    });
    backend.init().await.unwrap();

    let metadata = Arc::new(MetadataStore::new(backend.clone()).await.unwrap());
    let service = Arc::new(ObjectStoreService::new(backend.clone(), metadata));
    service.create_bucket("bucket").await.unwrap();

    Harness {
        app: create_router_with_options(service, options),
        backend,
        _dir: dir,
    }
}

/// A body that sends `chunks` chunks of `size` bytes with `pause` before each.
fn trickle(chunks: usize, size: usize, pause: Duration) -> Body {
    let stream = futures::stream::unfold(0, move |sent| async move {
        if sent == chunks {
            return None;
        }
        tokio::time::sleep(pause).await;
        Some((
            Ok::<_, std::io::Error>(Bytes::from(vec![sent as u8; size])),
            sent + 1,
        ))
    });
    Body::from_stream(stream)
}

async fn send(app: &Router, request: Request<Body>) -> (StatusCode, Bytes) {
    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, body)
}

fn put(key: &str, body: Body) -> Request<Body> {
    Request::builder()
        .method("PUT")
        .uri(format!("/buckets/bucket/objects/{}", key))
        .body(body)
        .unwrap()
}

fn get(key: &str) -> Request<Body> {
    Request::builder()
        .uri(format!("/buckets/bucket/objects/{}", key))
        .body(Body::empty())
        .unwrap()
}

#[tokio::test]
async fn uploads_outlive_the_request_timeout() {
    let harness = harness(SHORT).await;

    let (status, body) = send(
        &harness.app,
        put("slow.bin", trickle(10, 1000, Duration::from_millis(60))),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{}", String::from_utf8_lossy(&body));
    let metadata: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(metadata["size"], 10_000);

    let (status, body) = send(&harness.app, get("slow.bin")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.len(), 10_000);
    assert_eq!(body[9_999], 9);
}

#[tokio::test]
async fn other_requests_still_time_out() {
    let harness = harness(SHORT).await;
    let payload = json!({ "name": "late" }).to_string().into_bytes();

    let body = Body::from_stream(futures::stream::once(async move {
        tokio::time::sleep(Duration::from_millis(600)).await;
        Ok::<_, std::io::Error>(Bytes::from(payload))
    }));
    let request = Request::builder()
        .method("POST")
        .uri("/buckets")
        .header("content-type", "application/json")
        .body(body)
        .unwrap();

    let (status, _) = send(&harness.app, request).await;
    assert_eq!(status, StatusCode::REQUEST_TIMEOUT);
}

#[tokio::test]
async fn cuts_off_stalled_upload_bodies_without_writing_anything() {
    let harness = harness(SHORT).await;

    let (status, _) = send(&harness.app, put("kept.txt", Body::from("original"))).await;
    assert_eq!(status, StatusCode::OK);

    for key in ["stalled.bin", "kept.txt"] {
        let body = Body::from_stream(futures::stream::unfold(0, |sent| async move {
            if sent > 0 {
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
            Some((
                Ok::<_, std::io::Error>(Bytes::from(vec![1u8; 4096])),
                sent + 1,
            ))
        }));

        let started = std::time::Instant::now();
        let (status, _) = send(&harness.app, put(key, body)).await;

        assert_eq!(status, StatusCode::REQUEST_TIMEOUT);
        assert!(started.elapsed() < Duration::from_secs(3));
    }

    let (status, _) = send(&harness.app, get("stalled.bin")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, body) = send(&harness.app, get("kept.txt")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(&body[..], b"original");
}

#[tokio::test]
async fn accepts_bodies_beyond_the_default_body_limit() {
    let harness = harness(RouterOptions::default()).await;
    let data = vec![7u8; 5 * 1024 * 1024 + 3];

    let (status, body) = send(&harness.app, put("big.bin", Body::from(data.clone()))).await;

    assert_eq!(status, StatusCode::OK, "{}", String::from_utf8_lossy(&body));
    let (_, body) = send(&harness.app, get("big.bin")).await;
    assert_eq!(body.len(), data.len());
}

#[tokio::test]
async fn passes_content_length_as_the_size_hint() {
    let harness = harness(RouterOptions::default()).await;

    let request = Request::builder()
        .method("PUT")
        .uri("/buckets/bucket/objects/hinted.bin")
        .header("content-length", "12345")
        .body(Body::from(vec![0u8; 12345]))
        .unwrap();
    let (status, _) = send(&harness.app, request).await;
    assert_eq!(status, StatusCode::OK);

    let (status, _) = send(
        &harness.app,
        put("unhinted.bin", trickle(2, 10, Duration::ZERO)),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let hints = harness.backend.size_hints.lock().unwrap().clone();
    assert_eq!(hints[hints.len() - 2..], [Some(12345), None]);
}

const RATE_LIMITED: RouterOptions = RouterOptions {
    upload_min_bytes_per_sec: 20_000,
    upload_min_rate_grace: Duration::from_millis(300),
    ..RouterOptions::DEFAULT
};

#[tokio::test]
async fn cuts_off_uploads_that_arrive_too_slowly() {
    let harness = harness(RATE_LIMITED).await;

    let started = std::time::Instant::now();
    let (status, body) = send(
        &harness.app,
        put("slow.bin", trickle(1000, 100, Duration::from_millis(50))),
    )
    .await;

    assert_eq!(status, StatusCode::REQUEST_TIMEOUT);
    assert!(String::from_utf8_lossy(&body).contains("slower than 20000 bytes per second"));
    assert!(started.elapsed() < Duration::from_secs(3));
    let (status, _) = send(&harness.app, get("slow.bin")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn lets_uploads_above_the_minimum_rate_through() {
    let harness = harness(RATE_LIMITED).await;

    let (status, body) = send(
        &harness.app,
        put("steady.bin", trickle(40, 4000, Duration::from_millis(25))),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{}", String::from_utf8_lossy(&body));
    let (_, body) = send(&harness.app, get("steady.bin")).await;
    assert_eq!(body.len(), 160_000);
}

#[tokio::test]
async fn does_not_blame_the_client_for_time_the_server_spent() {
    let harness = harness(RATE_LIMITED).await;
    *harness.backend.hold_uploads.lock().unwrap() = Duration::from_secs(1);

    let (status, body) = send(&harness.app, put("held.bin", Body::from(vec![3u8; 50_000]))).await;

    assert_eq!(status, StatusCode::OK, "{}", String::from_utf8_lossy(&body));
}

#[tokio::test]
async fn answers_a_broken_body_with_a_client_error() {
    let harness = harness(RouterOptions::default()).await;

    let body = Body::from_stream(futures::stream::iter([
        Ok(Bytes::from(vec![1u8; 4096])),
        Err(std::io::Error::new(
            std::io::ErrorKind::ConnectionReset,
            "client went away",
        )),
    ]));
    let (status, body) = send(&harness.app, put("broken.bin", body)).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(String::from_utf8_lossy(&body).contains("client went away"));
    let (status, _) = send(&harness.app, get("broken.bin")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn still_answers_storage_failures_with_a_server_error() {
    let harness = harness(RouterOptions::default()).await;
    harness.backend.fail_uploads.store(true, Ordering::SeqCst);

    let (status, _) = send(&harness.app, put("refused.bin", Body::from("data"))).await;

    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn reserves_little_memory_for_a_small_put() {
    let harness = harness(RouterOptions::default()).await;

    let (status, _) = send(&harness.app, put("small.txt", Body::from(vec![5u8; 1000]))).await;

    assert_eq!(status, StatusCode::OK);
    let peak = harness.backend.uploader().peak_reserved_bytes();
    assert!(peak <= 4 * 1024, "reserved {} bytes", peak);
}
