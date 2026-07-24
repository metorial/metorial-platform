use axum::body::Body;
use axum::http::{Request, StatusCode};
use bytes::Bytes;
use futures::stream;
use object_store::metadata::MetadataStore;
use object_store::service::ObjectStoreService;
use object_store_backends::{local::LocalBackend, Backend};
use serde_json::json;
use std::sync::Arc;
use tempfile::TempDir;
use tower::ServiceExt as TowerServiceExt;

async fn setup_test_service() -> (Arc<ObjectStoreService>, TempDir) {
    let temp_dir = TempDir::new().unwrap();
    let backend = Arc::new(LocalBackend::new(
        temp_dir.path().to_path_buf(),
        "test-physical-bucket".to_string(),
    ));

    backend.init().await.unwrap();

    let metadata = Arc::new(MetadataStore::new(backend.clone()).await.unwrap());

    let service = Arc::new(ObjectStoreService::new(backend, metadata));

    (service, temp_dir)
}

#[tokio::test]
async fn test_health_check() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_create_and_list_buckets() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service);

    // Create bucket
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/buckets")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "name": "test-bucket"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // List buckets
    let response = app
        .oneshot(
            Request::builder()
                .uri("/buckets")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["buckets"].as_array().unwrap().len(), 1);
    assert_eq!(json["buckets"][0]["name"], "test-bucket");
}

#[tokio::test]
async fn test_put_and_get_object() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    // Create bucket
    service.create_bucket("test-bucket").await.unwrap();

    // Put object
    let data = b"Hello, World!";
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/buckets/test-bucket/objects/test.txt")
                .header("content-type", "text/plain")
                .body(Body::from(data.to_vec()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // Get object
    let response = app
        .oneshot(
            Request::builder()
                .uri("/buckets/test-bucket/objects/test.txt")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    assert_eq!(&body[..], data);
}

#[tokio::test]
async fn test_delete_object() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    // Create bucket and put object
    service.create_bucket("test-bucket").await.unwrap();
    let data = b"Hello".to_vec();
    let stream: object_store_backends::ByteStream =
        Box::pin(stream::once(async move { Ok(Bytes::from(data)) }));
    service
        .put_object(
            "test-bucket",
            "test.txt",
            stream,
            Some("text/plain".to_string()),
            Default::default(),
        )
        .await
        .unwrap();

    // Delete object
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/buckets/test-bucket/objects/test.txt")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    // Verify object is deleted
    let response = app
        .oneshot(
            Request::builder()
                .uri("/buckets/test-bucket/objects/test.txt")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_list_objects() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    // Create bucket and put multiple objects
    service.create_bucket("test-bucket").await.unwrap();

    let data1 = b"Data1".to_vec();
    let stream1: object_store_backends::ByteStream =
        Box::pin(stream::once(async move { Ok(Bytes::from(data1)) }));
    service
        .put_object(
            "test-bucket",
            "file1.txt",
            stream1,
            None,
            Default::default(),
        )
        .await
        .unwrap();

    let data2 = b"Data2".to_vec();
    let stream2: object_store_backends::ByteStream =
        Box::pin(stream::once(async move { Ok(Bytes::from(data2)) }));
    service
        .put_object(
            "test-bucket",
            "file2.txt",
            stream2,
            None,
            Default::default(),
        )
        .await
        .unwrap();

    let data3 = b"Data3".to_vec();
    let stream3: object_store_backends::ByteStream =
        Box::pin(stream::once(async move { Ok(Bytes::from(data3)) }));
    service
        .put_object(
            "test-bucket",
            "subdir/file3.txt",
            stream3,
            None,
            Default::default(),
        )
        .await
        .unwrap();

    // List all objects
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/buckets/test-bucket/objects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["objects"].as_array().unwrap().len(), 3);

    // List with prefix
    let response = app
        .oneshot(
            Request::builder()
                .uri("/buckets/test-bucket/objects?prefix=subdir/")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["objects"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn test_head_object() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    // Create bucket and put object
    service.create_bucket("test-bucket").await.unwrap();
    let data = b"Hello, World!".to_vec();
    let stream: object_store_backends::ByteStream =
        Box::pin(stream::once(async move { Ok(Bytes::from(data)) }));
    service
        .put_object(
            "test-bucket",
            "test.txt",
            stream,
            Some("text/plain".to_string()),
            Default::default(),
        )
        .await
        .unwrap();

    // HEAD request
    let response = app
        .oneshot(
            Request::builder()
                .method("HEAD")
                .uri("/buckets/test-bucket/objects/test.txt")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers().get("content-length").unwrap(), "13");
    assert_eq!(
        response.headers().get("content-type").unwrap(),
        "text/plain"
    );
}

#[tokio::test]
async fn test_invalid_bucket_name() {
    let (service, _temp_dir) = setup_test_service().await;

    // Test invalid bucket names
    let result = service.create_bucket("Invalid-Name").await;
    assert!(result.is_err());

    let result = service.create_bucket("ab").await;
    assert!(result.is_err());

    let result = service.create_bucket("-invalid").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_bucket_already_exists() {
    let (service, _temp_dir) = setup_test_service().await;

    service.create_bucket("test-bucket").await.unwrap();
    let result = service.create_bucket("test-bucket").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_object_not_found() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    service.create_bucket("test-bucket").await.unwrap();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/buckets/test-bucket/objects/nonexistent.txt")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_path_traversal_protection() {
    let (service, _temp_dir) = setup_test_service().await;

    service.create_bucket("test-bucket").await.unwrap();

    let data = b"malicious".to_vec();
    let stream: object_store_backends::ByteStream =
        Box::pin(stream::once(async move { Ok(Bytes::from(data)) }));

    let result = service
        .put_object(
            "test-bucket",
            "../etc/passwd",
            stream,
            None,
            Default::default(),
        )
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_concurrent_bucket_creation() {
    let (service, _temp_dir) = setup_test_service().await;

    // Test concurrent creation of DIFFERENT buckets - should all succeed now!
    let handles: Vec<_> = (0..10)
        .map(|i| {
            let service = service.clone();
            tokio::spawn(async move {
                let name = format!("concurrent-{}", i);
                service.create_bucket(&name).await
            })
        })
        .collect();

    let results: Vec<_> = futures::future::join_all(handles)
        .await
        .into_iter()
        .map(|r| r.unwrap())
        .collect();

    // All should succeed since they're different buckets and we use folder-based storage
    let success_count = results.iter().filter(|r| r.is_ok()).count();
    assert_eq!(success_count, 10, "All 10 bucket creations should succeed");

    // Verify all buckets exist
    let buckets = service.list_buckets().await.unwrap();
    assert_eq!(buckets.len(), 10, "Should have 10 buckets");

    // Try creating duplicate - should fail
    let result = service.create_bucket("concurrent-0").await;
    assert!(result.is_err(), "Duplicate bucket creation should fail");
}
