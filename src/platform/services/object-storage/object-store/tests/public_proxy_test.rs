use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use object_store::metadata::MetadataStore;
use object_store::public::PublicUrlSigner;
use object_store::public_api::create_public_router;
use object_store::router::create_router;
use object_store::service::ObjectStoreService;
use object_store_backends::{local::LocalBackend, Backend, PublicUrlPurpose, PutOptions};
use serde_json::{json, Value};
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
    let service = Arc::new(
        ObjectStoreService::new(backend, metadata)
            .with_public_signer(Some(signer))
            .with_public_multipart(true),
    );
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

#[tokio::test]
async fn completes_an_upload_using_encrypted_manifests_and_receipts() {
    let (service, public, _temp) = setup().await;
    let internal = create_router(service.clone());
    let key = "archive.bin";
    let part_size = 75 * 1024 * 1024;
    let upload_id = service
        .start_durable_upload("files", key, PutOptions::default())
        .await
        .unwrap();
    let post = |path: &str, payload: Value| {
        let app = internal.clone();
        let req = Request::post(format!("/buckets/files/{path}/{key}"))
            .header("content-type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap();
        async move { app.oneshot(req).await.unwrap() }
    };

    let response = post(
        "part-manifests",
        json!({
            "upload_id": upload_id,
            "expires_in": 300,
            "parts": [{ "number": 1, "size": part_size }, { "number": 2, "size": 4 }]
        }),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    let manifests: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), 4096).await.unwrap()).unwrap();

    let send = |path: &str, token: &str, body: Vec<u8>| {
        let app = public.clone();
        let request = Request::put(path)
            .header("x-metorial-upload-manifest", token)
            .body(Body::from(body))
            .unwrap();
        async move { app.oneshot(request).await.unwrap() }
    };

    assert_eq!(manifests[0]["url"], format!("{BASE_URL}/upload-part"));
    let first_manifest = manifests[0]["manifest"].as_str().unwrap();
    let second_manifest = manifests[1]["manifest"].as_str().unwrap();
    let mut tampered = first_manifest.as_bytes().to_vec();
    tampered[20] = if tampered[20] == b'A' { b'B' } else { b'A' };
    assert_eq!(
        send(
            "/upload-part",
            std::str::from_utf8(&tampered).unwrap(),
            vec![]
        )
        .await
        .status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        send("/files/wrong.bin", first_manifest, vec![])
            .await
            .status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        send("/upload-part", second_manifest, vec![0; 5])
            .await
            .status(),
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        send("/upload-part", second_manifest, vec![0; 3])
            .await
            .status(),
        StatusCode::BAD_REQUEST
    );

    let mut receipts = Vec::new();
    for (manifest, body) in [
        (first_manifest, vec![42; part_size]),
        (second_manifest, vec![2, 3, 4, 5]),
    ] {
        let response = send("/upload-part", manifest, body).await;
        assert_eq!(response.status(), StatusCode::OK);
        let receipt: Value =
            serde_json::from_slice(&to_bytes(response.into_body(), 4096).await.unwrap()).unwrap();
        assert!(receipt.get("etag").is_none());
        receipts.push(receipt["receipt"].as_str().unwrap().to_string());
    }

    let complete = |receipts: Vec<String>| {
        post(
            "public-upload-complete",
            json!({
                "upload_id": upload_id,
                "total_size": part_size + 4,
                "part_size": part_size,
                "receipts": receipts
            }),
        )
    };
    for wrong in [
        vec![receipts[0].clone()],
        vec![receipts[0].clone(), receipts[0].clone()],
        vec![first_manifest.to_string(), receipts[1].clone()],
    ] {
        assert_eq!(complete(wrong).await.status(), StatusCode::BAD_REQUEST);
    }
    assert_eq!(complete(receipts.clone()).await.status(), StatusCode::OK);
    assert_eq!(complete(receipts).await.status(), StatusCode::OK);

    let url = public_url(&service, key, PublicUrlPurpose::Retrieve).await;
    let response = public
        .oneshot(Request::get(url).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let bytes = to_bytes(response.into_body(), part_size + 4).await.unwrap();
    assert!(bytes[..part_size].iter().all(|byte| *byte == 42));
    assert_eq!(&bytes[part_size..], [2, 3, 4, 5]);
}
