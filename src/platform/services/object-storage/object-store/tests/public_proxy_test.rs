use axum::body::Body;
use axum::http::{Request, StatusCode};
use object_store::metadata::MetadataStore;
use object_store::public::PublicUrlSigner;
use object_store::public_api::create_public_router;
use object_store::service::ObjectStoreService;
use object_store_backends::{local::LocalBackend, Backend, PublicUrlPurpose};
use std::sync::Arc;
use std::time::Duration;
use tempfile::TempDir;
use tower::ServiceExt;

const BASE_URL: &str = "https://metorial.example.com/object-storage";
const SECRET: &str = "0123456789abcdef0123456789abcdef";

async fn setup() -> (Arc<ObjectStoreService>, axum::Router, TempDir) {
    let temp_dir = TempDir::new().unwrap();
    let backend = Arc::new(LocalBackend::new(
        temp_dir.path().to_path_buf(),
        "test-physical-bucket".to_string(),
    ));
    backend.init().await.unwrap();

    let metadata = Arc::new(MetadataStore::new(backend.clone()).await.unwrap());
    let signer = Arc::new(PublicUrlSigner::new(BASE_URL, SECRET).unwrap());
    let service =
        Arc::new(ObjectStoreService::new(backend, metadata).with_public_signer(Some(signer)));
    service.create_bucket("files").await.unwrap();

    let router = create_public_router(service.clone(), Duration::from_secs(60));

    (service, router, temp_dir)
}

async fn public_url(service: &ObjectStoreService, key: &str, purpose: PublicUrlPurpose) -> String {
    let url = service
        .get_public_url("files", key, 300, purpose)
        .await
        .unwrap()
        .url;

    assert!(url.starts_with(BASE_URL), "{url}");
    url.strip_prefix(BASE_URL).unwrap().to_string()
}

async fn send(
    router: &axum::Router,
    method: &str,
    path: &str,
    body: &'static str,
) -> (StatusCode, String) {
    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header("content-type", "text/plain")
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();

    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();

    (status, String::from_utf8_lossy(&bytes).to_string())
}

#[tokio::test]
async fn uploads_and_downloads_through_signed_urls() {
    let (service, router, _temp_dir) = setup().await;

    let upload = public_url(&service, "dir/hello world.txt", PublicUrlPurpose::Upload).await;
    let (status, _) = send(&router, "PUT", &upload, "hello").await;
    assert_eq!(status, StatusCode::OK);

    let download = public_url(&service, "dir/hello world.txt", PublicUrlPurpose::Retrieve).await;
    let (status, body) = send(&router, "GET", &download, "").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, "hello");

    let (status, _) = send(&router, "HEAD", &download, "").await;
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn refuses_requests_without_a_matching_signature() {
    let (service, router, _temp_dir) = setup().await;

    let upload = public_url(&service, "a.txt", PublicUrlPurpose::Upload).await;
    let download = public_url(&service, "a.txt", PublicUrlPurpose::Retrieve).await;

    // A retrieve URL cannot upload, an upload URL cannot read.
    assert_eq!(
        send(&router, "PUT", &download, "x").await.0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        send(&router, "GET", &upload, "").await.0,
        StatusCode::FORBIDDEN
    );

    // The signature is bound to the key.
    let other_key = download.replace("/a.txt", "/b.txt");
    assert_eq!(
        send(&router, "GET", &other_key, "").await.0,
        StatusCode::FORBIDDEN
    );

    // Missing or tampered parameters.
    assert_eq!(
        send(&router, "GET", "/files/a.txt", "").await.0,
        StatusCode::FORBIDDEN
    );
    let extended = download.replace("expires=", "expires=9");
    assert_eq!(
        send(&router, "GET", &extended, "").await.0,
        StatusCode::FORBIDDEN
    );
}

#[tokio::test]
async fn does_not_expose_the_management_api() {
    let (_service, router, _temp_dir) = setup().await;

    assert_eq!(
        send(&router, "GET", "/buckets", "").await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        send(&router, "DELETE", "/files/a.txt", "").await.0,
        StatusCode::METHOD_NOT_ALLOWED
    );
}
