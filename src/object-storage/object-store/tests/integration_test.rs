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
async fn test_percent_encoded_object_keys_are_decoded() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    service.create_bucket("test-bucket").await.unwrap();

    let keys = [
        ("dir/notes%231.md", "dir/notes#1.md"),
        ("dir/100%25.md", "dir/100%.md"),
        ("dir/what%3F.md", "dir/what?.md"),
        ("dir/r%C3%A9sum%C3%A9%20%F0%9F%9A%80.md", "dir/résumé 🚀.md"),
    ];

    for (encoded, key) in keys {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PUT")
                    .uri(format!("/buckets/test-bucket/objects/{}", encoded))
                    .body(Body::from(key.as_bytes().to_vec()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/buckets/test-bucket/objects/{}", encoded))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        assert_eq!(&body[..], key.as_bytes());
    }

    let response = app
        .oneshot(
            Request::builder()
                .uri("/buckets/test-bucket/objects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let mut listed: Vec<String> = json["objects"]
        .as_array()
        .unwrap()
        .iter()
        .map(|object| object["key"].as_str().unwrap().to_string())
        .collect();
    listed.sort();
    let mut expected: Vec<String> = keys.iter().map(|(_, key)| key.to_string()).collect();
    expected.sort();
    assert_eq!(listed, expected);
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

async fn put_test_object(service: &Arc<ObjectStoreService>, bucket: &str, key: &str) {
    let data = key.as_bytes().to_vec();
    let stream: object_store_backends::ByteStream =
        Box::pin(stream::once(async move { Ok(Bytes::from(data)) }));
    service
        .put_object(bucket, key, stream, None, Default::default())
        .await
        .unwrap();
}

#[tokio::test]
async fn test_list_objects_pagination_covers_every_object() {
    let (service, _temp_dir) = setup_test_service().await;
    service.create_bucket("test-bucket").await.unwrap();

    for i in 0..25 {
        put_test_object(&service, "test-bucket", &format!("dir/file{:03}.txt", i)).await;
    }

    let mut seen = Vec::new();
    let mut token: Option<String> = None;
    let mut pages = 0;

    loop {
        let page = service
            .list_objects("test-bucket", None, Some(7), token.as_deref())
            .await
            .unwrap();

        pages += 1;
        seen.extend(page.objects.into_iter().map(|o| o.key));

        match page.next_continuation_token {
            Some(next) => token = Some(next),
            None => break,
        }

        assert!(pages < 20, "pagination did not terminate");
    }

    assert!(pages > 1, "expected the listing to span several pages");
    assert_eq!(seen.len(), 25);

    seen.sort();
    seen.dedup();
    assert_eq!(seen.len(), 25, "pages overlapped or skipped objects");
}

#[tokio::test]
async fn test_list_objects_pagination_respects_prefix() {
    let (service, _temp_dir) = setup_test_service().await;
    service.create_bucket("test-bucket").await.unwrap();

    for i in 0..12 {
        put_test_object(&service, "test-bucket", &format!("keep/file{:03}.txt", i)).await;
        put_test_object(&service, "test-bucket", &format!("other/file{:03}.txt", i)).await;
    }

    let mut seen = Vec::new();
    let mut token: Option<String> = None;

    loop {
        let page = service
            .list_objects("test-bucket", Some("keep/"), Some(5), token.as_deref())
            .await
            .unwrap();

        seen.extend(page.objects.into_iter().map(|o| o.key));

        match page.next_continuation_token {
            Some(next) => token = Some(next),
            None => break,
        }
    }

    assert_eq!(seen.len(), 12);
    assert!(seen.iter().all(|key| key.starts_with("keep/")));
}

#[tokio::test]
async fn test_list_objects_prefix_with_leading_slash() {
    let (service, _temp_dir) = setup_test_service().await;
    service.create_bucket("test-bucket").await.unwrap();

    put_test_object(&service, "test-bucket", "dir/file.txt").await;

    // A leading slash must not turn into a double slash in the backend key space.
    let page = service
        .list_objects("test-bucket", Some("/dir/"), None, None)
        .await
        .unwrap();

    assert_eq!(page.objects.len(), 1);
    assert_eq!(page.objects[0].key, "dir/file.txt");
}

#[tokio::test]
async fn test_delete_objects_bulk() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    service.create_bucket("test-bucket").await.unwrap();
    put_test_object(&service, "test-bucket", "dir/a.txt").await;
    put_test_object(&service, "test-bucket", "dir/b.txt").await;
    put_test_object(&service, "test-bucket", "dir/keep.txt").await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/buckets/test-bucket/objects/delete")
                .header("content-type", "application/json")
                // "dir/missing.txt" was never written: deleting it is a no-op,
                // not a failure.
                .body(Body::from(
                    json!({ "keys": ["dir/a.txt", "dir/b.txt", "dir/missing.txt"] }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["deleted"], 3);
    assert_eq!(json["failed"], 0);
    assert_eq!(json["results"].as_array().unwrap().len(), 3);

    let remaining = service
        .list_objects("test-bucket", None, None, None)
        .await
        .unwrap();
    assert_eq!(remaining.objects.len(), 1);
    assert_eq!(remaining.objects[0].key, "dir/keep.txt");
}

#[tokio::test]
async fn test_delete_objects_rejects_bucket_marker() {
    let (service, _temp_dir) = setup_test_service().await;
    service.create_bucket("test-bucket").await.unwrap();
    put_test_object(&service, "test-bucket", "dir/a.txt").await;

    let results = service
        .delete_objects(
            "test-bucket",
            &[
                ".bucket".to_string(),
                "nested/.bucket".to_string(),
                "dir/a.txt".to_string(),
            ],
        )
        .await
        .unwrap();

    assert!(!results[0].deleted);
    assert!(!results[1].deleted);
    assert!(results[2].deleted);

    assert!(results[0].error.is_some());
    assert!(results[1].error.is_some());

    // The bucket must still be usable: marker objects were never touched.
    put_test_object(&service, "test-bucket", "dir/b.txt").await;
    let remaining = service
        .list_objects("test-bucket", None, None, None)
        .await
        .unwrap();
    assert_eq!(remaining.objects.len(), 1);
    assert_eq!(remaining.objects[0].key, "dir/b.txt");
}

#[tokio::test]
async fn test_delete_objects_rejects_traversal() {
    let (service, _temp_dir) = setup_test_service().await;
    service.create_bucket("test-bucket").await.unwrap();

    let results = service
        .delete_objects("test-bucket", &["../other-bucket/file.txt".to_string()])
        .await
        .unwrap();

    assert!(!results[0].deleted);
    assert!(results[0].error.is_some());
}

async fn read_object_body(service: &Arc<ObjectStoreService>, bucket: &str, key: &str) -> Vec<u8> {
    let object = service.get_object(bucket, key).await.unwrap();
    let mut collected = Vec::new();
    let mut stream = object.stream;

    while let Some(chunk) = futures::StreamExt::next(&mut stream).await {
        collected.extend_from_slice(&chunk.unwrap());
    }

    collected
}

#[tokio::test]
async fn test_copy_object_across_logical_buckets() {
    let (service, _temp_dir) = setup_test_service().await;
    service.create_bucket("files").await.unwrap();
    service.create_bucket("code-bucket").await.unwrap();

    put_test_object(&service, "files", "abc123").await;

    let metadata = service
        .copy_object("files", "abc123", "code-bucket", "skills/demo/asset.bin")
        .await
        .unwrap();

    // The returned key is bucket-relative, matching what every other call returns.
    assert_eq!(metadata.key, "skills/demo/asset.bin");

    let copied = read_object_body(&service, "code-bucket", "skills/demo/asset.bin").await;
    assert_eq!(copied, b"abc123".to_vec());

    // The source survives the copy.
    let source = read_object_body(&service, "files", "abc123").await;
    assert_eq!(source, b"abc123".to_vec());
}

#[tokio::test]
async fn test_copy_object_rejects_bucket_marker_destination() {
    let (service, _temp_dir) = setup_test_service().await;
    service.create_bucket("files").await.unwrap();
    service.create_bucket("code-bucket").await.unwrap();
    put_test_object(&service, "files", "abc123").await;

    assert!(service
        .copy_object("files", "abc123", "code-bucket", ".bucket")
        .await
        .is_err());
    assert!(service
        .copy_object("files", "abc123", "code-bucket", "nested/.bucket")
        .await
        .is_err());

    // The destination bucket is still usable, so no marker was overwritten.
    put_test_object(&service, "code-bucket", "dir/a.txt").await;
    let listed = service
        .list_objects("code-bucket", None, None, None)
        .await
        .unwrap();
    assert_eq!(listed.objects.len(), 1);
}

#[tokio::test]
async fn test_copy_object_rejects_traversal() {
    let (service, _temp_dir) = setup_test_service().await;
    service.create_bucket("files").await.unwrap();
    service.create_bucket("code-bucket").await.unwrap();

    assert!(service
        .copy_object("files", "../other/file.txt", "code-bucket", "a.txt")
        .await
        .is_err());
    assert!(service
        .copy_object("files", "abc123", "code-bucket", "../other/file.txt")
        .await
        .is_err());
}

#[tokio::test]
async fn test_copy_object_missing_source() {
    let (service, _temp_dir) = setup_test_service().await;
    service.create_bucket("files").await.unwrap();
    service.create_bucket("code-bucket").await.unwrap();

    assert!(service
        .copy_object("files", "does-not-exist", "code-bucket", "a.txt")
        .await
        .is_err());
}

#[tokio::test]
async fn test_copy_object_requires_existing_buckets() {
    let (service, _temp_dir) = setup_test_service().await;
    service.create_bucket("files").await.unwrap();
    put_test_object(&service, "files", "abc123").await;

    assert!(service
        .copy_object("files", "abc123", "missing-bucket", "a.txt")
        .await
        .is_err());
    assert!(service
        .copy_object("missing-bucket", "abc123", "files", "a.txt")
        .await
        .is_err());
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

async fn put_bytes(service: &Arc<ObjectStoreService>, bucket: &str, key: &str, data: Vec<u8>) {
    let stream: object_store_backends::ByteStream =
        Box::pin(stream::once(async move { Ok(Bytes::from(data)) }));
    service
        .put_object(
            bucket,
            key,
            stream,
            Some("text/plain".to_string()),
            Default::default(),
        )
        .await
        .unwrap();
}

async fn get_with_range(
    app: &axum::Router,
    range: Option<&str>,
    extra: Option<(&str, &str)>,
) -> (StatusCode, axum::http::HeaderMap, Vec<u8>) {
    let mut builder = Request::builder().uri("/buckets/range-bucket/objects/digits.txt");

    if let Some(range) = range {
        builder = builder.header("range", range);
    }
    if let Some((name, value)) = extra {
        builder = builder.header(name, value);
    }

    let response = app
        .clone()
        .oneshot(builder.body(Body::empty()).unwrap())
        .await
        .unwrap();

    let status = response.status();
    let headers = response.headers().clone();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap()
        .to_vec();

    (status, headers, body)
}

#[tokio::test]
async fn test_get_object_range() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    service.create_bucket("range-bucket").await.unwrap();
    put_bytes(
        &service,
        "range-bucket",
        "digits.txt",
        b"0123456789".to_vec(),
    )
    .await;

    let (status, headers, body) = get_with_range(&app, Some("bytes=2-5"), None).await;
    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(body, b"2345");
    assert_eq!(headers.get("content-range").unwrap(), "bytes 2-5/10");
    assert_eq!(headers.get("content-length").unwrap(), "4");
    assert_eq!(headers.get("accept-ranges").unwrap(), "bytes");
    assert_eq!(headers.get("content-type").unwrap(), "text/plain");

    // End past the object is clamped
    let (status, headers, body) = get_with_range(&app, Some("bytes=7-999"), None).await;
    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(body, b"789");
    assert_eq!(headers.get("content-range").unwrap(), "bytes 7-9/10");

    // Open-ended and suffix ranges
    let (status, _, body) = get_with_range(&app, Some("bytes=6-"), None).await;
    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(body, b"6789");

    let (status, headers, body) = get_with_range(&app, Some("bytes=-3"), None).await;
    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(body, b"789");
    assert_eq!(headers.get("content-range").unwrap(), "bytes 7-9/10");

    // A suffix longer than the object returns the whole object
    let (status, headers, body) = get_with_range(&app, Some("bytes=-500"), None).await;
    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(body, b"0123456789");
    assert_eq!(headers.get("content-range").unwrap(), "bytes 0-9/10");
}

#[tokio::test]
async fn test_get_object_range_not_satisfiable() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    service.create_bucket("range-bucket").await.unwrap();
    put_bytes(
        &service,
        "range-bucket",
        "digits.txt",
        b"0123456789".to_vec(),
    )
    .await;

    for range in ["bytes=10-", "bytes=10-20", "bytes=-0"] {
        let (status, headers, body) = get_with_range(&app, Some(range), None).await;
        assert_eq!(status, StatusCode::RANGE_NOT_SATISFIABLE, "{range}");
        assert_eq!(
            headers.get("content-range").unwrap(),
            "bytes */10",
            "{range}"
        );
        assert!(body.is_empty());
    }
}

#[tokio::test]
async fn test_get_object_ignores_unsupported_range_headers() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    service.create_bucket("range-bucket").await.unwrap();
    put_bytes(
        &service,
        "range-bucket",
        "digits.txt",
        b"0123456789".to_vec(),
    )
    .await;

    for range in ["bytes=0-1,4-5", "items=0-1", "bytes=5-2", "bytes=abc"] {
        let (status, headers, body) = get_with_range(&app, Some(range), None).await;
        assert_eq!(status, StatusCode::OK, "{range}");
        assert_eq!(body, b"0123456789", "{range}");
        assert!(headers.get("content-range").is_none());
    }

    let (status, _, body) =
        get_with_range(&app, Some("bytes=0-1"), Some(("if-range", "\"anything\""))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, b"0123456789");
}

#[tokio::test]
async fn test_get_object_range_of_missing_object_and_empty_object() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    service.create_bucket("range-bucket").await.unwrap();

    let (status, _, _) = get_with_range(&app, Some("bytes=0-1"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    put_bytes(&service, "range-bucket", "digits.txt", Vec::new()).await;

    let (status, headers, _) = get_with_range(&app, Some("bytes=0-0"), None).await;
    assert_eq!(status, StatusCode::RANGE_NOT_SATISFIABLE);
    assert_eq!(headers.get("content-range").unwrap(), "bytes */0");
}

#[tokio::test]
async fn test_get_object_range_reads_only_the_requested_part_of_a_large_object() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    service.create_bucket("range-bucket").await.unwrap();

    let size: usize = 24 * 1024 * 1024;
    let data: Vec<u8> = (0..size).map(|i| (i % 251) as u8).collect();
    put_bytes(&service, "range-bucket", "digits.txt", data.clone()).await;

    let start = size - 5000;
    let range = format!("bytes={}-{}", start, start + 99);
    let (status, headers, body) = get_with_range(&app, Some(&range), None).await;

    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(body.len(), 100);
    assert_eq!(body, data[start..start + 100]);
    assert_eq!(
        headers.get("content-range").unwrap().to_str().unwrap(),
        format!("bytes {}-{}/{}", start, start + 99, size)
    );
}

#[tokio::test]
async fn test_head_and_full_get_advertise_range_support() {
    let (service, _temp_dir) = setup_test_service().await;
    let app = object_store::router::create_router(service.clone());

    service.create_bucket("range-bucket").await.unwrap();
    put_bytes(
        &service,
        "range-bucket",
        "digits.txt",
        b"0123456789".to_vec(),
    )
    .await;

    let (status, headers, body) = get_with_range(&app, None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, b"0123456789");
    assert_eq!(headers.get("accept-ranges").unwrap(), "bytes");

    let response = app
        .oneshot(
            Request::builder()
                .method("HEAD")
                .uri("/buckets/range-bucket/objects/digits.txt")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.headers().get("accept-ranges").unwrap(), "bytes");
}
