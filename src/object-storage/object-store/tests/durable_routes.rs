use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use bytes::Bytes;
use object_store::metadata::MetadataStore;
use object_store::router::create_router;
use object_store::service::ObjectStoreService;
use object_store_backends::{local::LocalBackend, Backend, DURABLE_MIN_PART_SIZE};
use serde_json::{json, Value};
use std::sync::Arc;
use tempfile::TempDir;
use tower::ServiceExt;

struct Harness {
    app: Router,
    _dir: TempDir,
}

async fn harness() -> Harness {
    let dir = TempDir::new().unwrap();
    let backend: Arc<dyn Backend> =
        Arc::new(LocalBackend::new(dir.path().to_path_buf(), "physical".to_string()));
    backend.init().await.unwrap();

    let metadata = Arc::new(MetadataStore::new(backend.clone()).await.unwrap());
    let service = Arc::new(ObjectStoreService::new(backend, metadata));
    service.create_bucket("bucket").await.unwrap();

    Harness {
        app: create_router(service),
        _dir: dir,
    }
}

async fn send(app: &Router, request: Request<Body>) -> (StatusCode, Bytes) {
    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, body)
}

fn json_of(body: &Bytes) -> Value {
    serde_json::from_slice(body).unwrap_or(Value::Null)
}

async fn start(app: &Router, key: &str) -> String {
    let (status, body) = send(
        app,
        Request::builder()
            .method("POST")
            .uri(format!("/buckets/bucket/uploads/{}", key))
            .header("content-type", "application/gzip")
            .header("x-object-meta-rows", "7")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{:?}", body);
    json_of(&body)["upload_id"].as_str().unwrap().to_string()
}

async fn upload(app: &Router, key: &str, upload_id: &str, part: u32, data: Vec<u8>) -> (StatusCode, Value) {
    let (status, body) = send(
        app,
        Request::builder()
            .method("PUT")
            .uri(format!(
                "/buckets/bucket/upload-parts/{}?upload_id={}&part={}",
                key, upload_id, part
            ))
            .body(Body::from(data))
            .unwrap(),
    )
    .await;
    (status, json_of(&body))
}

async fn complete(app: &Router, key: &str, upload_id: &str, parts: Value) -> (StatusCode, Value) {
    let (status, body) = send(
        app,
        Request::builder()
            .method("POST")
            .uri(format!("/buckets/bucket/upload-complete/{}", key))
            .header("content-type", "application/json")
            .body(Body::from(
                json!({ "upload_id": upload_id, "parts": parts }).to_string(),
            ))
            .unwrap(),
    )
    .await;
    (status, json_of(&body))
}

async fn list(app: &Router, prefix: &str) -> Value {
    let (status, body) = send(
        app,
        Request::builder()
            .uri(format!("/buckets/bucket/uploads?prefix={}", prefix))
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    json_of(&body)
}

#[tokio::test]
async fn uploads_parts_in_separate_requests_and_completes() {
    let harness = harness().await;
    let app = &harness.app;
    let upload_id = start(app, "exports/a.csv.gz").await;

    let listed = list(app, "exports/").await;
    assert_eq!(listed["uploads"][0]["key"], "exports/a.csv.gz");
    assert_eq!(listed["uploads"][0]["upload_id"], upload_id.as_str());

    let (status, first) = upload(app, "exports/a.csv.gz", &upload_id, 1, vec![1; DURABLE_MIN_PART_SIZE as usize]).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(first["part"], 1);
    assert_eq!(first["size"], DURABLE_MIN_PART_SIZE);
    let (_, second) = upload(app, "exports/a.csv.gz", &upload_id, 2, vec![2; 3]).await;

    let (status, object) = complete(
        app,
        "exports/a.csv.gz",
        &upload_id,
        json!([
            { "part": 1, "etag": first["etag"] },
            { "part": 2, "etag": second["etag"] }
        ]),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{object}");
    assert_eq!(object["key"], "exports/a.csv.gz");
    assert_eq!(object["size"], DURABLE_MIN_PART_SIZE + 3);
    assert_eq!(object["content_type"], "application/gzip");
    assert_eq!(object["metadata"]["rows"], "7");

    let (status, body) = send(
        app,
        Request::builder()
            .uri("/buckets/bucket/objects/exports/a.csv.gz")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.len() as u64, DURABLE_MIN_PART_SIZE + 3);
    assert_eq!(&body[body.len() - 3..], &[2, 2, 2]);

    let (status, _) = complete(
        app,
        "exports/a.csv.gz",
        &upload_id,
        json!([{ "part": 1, "etag": first["etag"] }, { "part": 2, "etag": second["etag"] }]),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(list(app, "exports/").await["uploads"], json!([]));
}

#[tokio::test]
async fn rejects_invalid_part_lists_and_numbers() {
    let harness = harness().await;
    let app = &harness.app;
    let upload_id = start(app, "a").await;

    let (status, _) = upload(app, "a", &upload_id, 0, vec![1]).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = upload(app, "a", &upload_id, 10_001, vec![1]).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (_, small) = upload(app, "a", &upload_id, 1, vec![1; 10]).await;
    let (_, last) = upload(app, "a", &upload_id, 2, vec![2; 10]).await;

    let (status, _) = complete(app, "a", &upload_id, json!([{ "part": 2, "etag": last["etag"] }])).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = complete(
        app,
        "a",
        &upload_id,
        json!([{ "part": 1, "etag": small["etag"] }, { "part": 2, "etag": last["etag"] }]),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = complete(app, "a", &upload_id, json!([{ "part": 1, "etag": "wrong" }])).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn aborts_uploads_and_ignores_unknown_ones() {
    let harness = harness().await;
    let app = &harness.app;
    let upload_id = start(app, "exports/b").await;

    for _ in 0..2 {
        let (status, _) = send(
            app,
            Request::builder()
                .method("DELETE")
                .uri(format!("/buckets/bucket/uploads/exports/b?upload_id={}", upload_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await;
        assert_eq!(status, StatusCode::NO_CONTENT);
    }

    let (status, _) = upload(app, "exports/b", &upload_id, 1, vec![1]).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(list(app, "").await["uploads"], json!([]));
}

#[tokio::test]
async fn an_upload_is_bound_to_its_bucket_and_key() {
    let harness = harness().await;
    let app = &harness.app;
    let upload_id = start(app, "a").await;

    let (status, _) = upload(app, "b", &upload_id, 1, vec![1]).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (status, _) = send(
        app,
        Request::builder()
            .method("POST")
            .uri("/buckets/missing/uploads/a")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (status, _) = send(
        app,
        Request::builder()
            .method("POST")
            .uri("/buckets/bucket/uploads/.bucket")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}
