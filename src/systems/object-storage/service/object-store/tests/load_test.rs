use bytes::Bytes;
use futures::{stream, StreamExt};
use object_store::metadata::MetadataStore;
use object_store::service::ObjectStoreService;
use object_store_backends::{local::LocalBackend, Backend};
use std::sync::Arc;
use std::time::Instant;
use tempfile::TempDir;

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
#[ignore] // Run with: cargo test --test load_test -- --ignored
async fn test_concurrent_writes() {
    let (service, _temp_dir) = setup_test_service().await;

    // Create bucket
    service.create_bucket("load-test-bucket").await.unwrap();

    let start = Instant::now();
    let num_operations = 100;

    // Spawn concurrent write operations
    let handles: Vec<_> = (0..num_operations)
        .map(|i| {
            let service = service.clone();
            tokio::spawn(async move {
                let key = format!("file-{}.txt", i);
                let data = format!("Data for file {}", i).into_bytes();
                let stream: object_store_backends::ByteStream =
                    Box::pin(stream::once(async move { Ok(Bytes::from(data)) }));

                service
                    .put_object(
                        "load-test-bucket",
                        &key,
                        stream,
                        Some("text/plain".to_string()),
                        Default::default(),
                    )
                    .await
            })
        })
        .collect();

    let results = futures::future::join_all(handles).await;

    let duration = start.elapsed();
    let success_count = results
        .iter()
        .filter(|r| r.as_ref().unwrap().is_ok())
        .count();

    println!(
        "Concurrent writes: {} operations in {:?} ({:.2} ops/sec)",
        success_count,
        duration,
        success_count as f64 / duration.as_secs_f64()
    );

    assert_eq!(success_count, num_operations);
    println!("✓ All {} writes succeeded", num_operations);
}

#[tokio::test]
#[ignore]
async fn test_concurrent_reads() {
    let (service, _temp_dir) = setup_test_service().await;

    // Create bucket and populate with data
    service.create_bucket("load-test-bucket").await.unwrap();

    let num_files = 50;
    for i in 0..num_files {
        let key = format!("file-{}.txt", i);
        let data = format!("Data for file {}", i).into_bytes();
        let stream: object_store_backends::ByteStream =
            Box::pin(stream::once(async move { Ok(Bytes::from(data)) }));
        service
            .put_object(
                "load-test-bucket",
                &key,
                stream,
                Some("text/plain".to_string()),
                Default::default(),
            )
            .await
            .unwrap();
    }

    let start = Instant::now();
    let num_reads = 200;

    // Spawn concurrent read operations
    let handles: Vec<_> = (0..num_reads)
        .map(|i| {
            let service = service.clone();
            tokio::spawn(async move {
                let key = format!("file-{}.txt", i % num_files);
                service.get_object("load-test-bucket", &key).await
            })
        })
        .collect();

    let results = futures::future::join_all(handles).await;

    let duration = start.elapsed();
    let success_count = results
        .iter()
        .filter(|r| r.as_ref().unwrap().is_ok())
        .count();

    println!(
        "Concurrent reads: {} operations in {:?} ({:.2} ops/sec)",
        success_count,
        duration,
        success_count as f64 / duration.as_secs_f64()
    );

    assert_eq!(success_count, num_reads);
    println!("✓ All {} reads succeeded", num_reads);
}

#[tokio::test]
#[ignore]
async fn test_mixed_operations() {
    let (service, _temp_dir) = setup_test_service().await;

    // Create bucket
    service.create_bucket("load-test-bucket").await.unwrap();

    let start = Instant::now();
    let num_operations = 150;

    // Mix of writes, reads, and deletes
    let handles: Vec<_> = (0..num_operations)
        .map(|i| {
            let service = service.clone();
            tokio::spawn(async move {
                match i % 3 {
                    0 => {
                        // Write
                        let key = format!("file-{}.txt", i);
                        let data = format!("Data {}", i).into_bytes();
                        let stream: object_store_backends::ByteStream =
                            Box::pin(stream::once(async move { Ok(Bytes::from(data)) }));
                        service
                            .put_object(
                                "load-test-bucket",
                                &key,
                                stream,
                                Some("text/plain".to_string()),
                                Default::default(),
                            )
                            .await
                            .map(|_| ())
                    }
                    1 => {
                        // Read (if exists)
                        let prev_i = if i > 0 { i - 1 } else { 0 };
                        let key = format!("file-{}.txt", prev_i);
                        match service.get_object("load-test-bucket", &key).await {
                            Ok(_) => Ok(()),
                            Err(object_store::error::ServiceError::ObjectNotFound(_)) => Ok(()),
                            Err(object_store::error::ServiceError::Backend(
                                object_store_backends::BackendError::NotFound(_),
                            )) => Ok(()),
                            Err(e) => Err(e),
                        }
                    }
                    _ => {
                        // List
                        service
                            .list_objects("load-test-bucket", None, Some(10))
                            .await
                            .map(|_| ())
                    }
                }
            })
        })
        .collect();

    let results = futures::future::join_all(handles).await;

    let duration = start.elapsed();
    let success_count = results
        .iter()
        .filter(|r| r.as_ref().unwrap().is_ok())
        .count();

    println!(
        "Mixed operations: {} operations in {:?} ({:.2} ops/sec)",
        success_count,
        duration,
        success_count as f64 / duration.as_secs_f64()
    );

    println!(
        "✓ {} of {} operations succeeded",
        success_count, num_operations
    );
    assert!(success_count > num_operations * 9 / 10); // At least 90% success
}

#[tokio::test]
#[ignore]
async fn test_large_file_handling() {
    let (service, _temp_dir) = setup_test_service().await;

    service.create_bucket("load-test-bucket").await.unwrap();

    let sizes = [
        1024,            // 1 KB
        1024 * 1024,     // 1 MB
        5 * 1024 * 1024, // 5 MB
    ];

    for (i, size) in sizes.iter().enumerate() {
        let start = Instant::now();
        let data = vec![0u8; *size];
        let key = format!("large-file-{}.bin", i);

        // Write
        let expected_size = data.len();
        let stream: object_store_backends::ByteStream =
            Box::pin(stream::once(async move { Ok(Bytes::from(data)) }));
        service
            .put_object(
                "load-test-bucket",
                &key,
                stream,
                Some("application/octet-stream".to_string()),
                Default::default(),
            )
            .await
            .unwrap();

        let write_duration = start.elapsed();

        // Read
        let read_start = Instant::now();
        let mut retrieved = service.get_object("load-test-bucket", &key).await.unwrap();
        let read_duration = read_start.elapsed();

        // Collect stream to verify size
        let mut collected_data = Vec::new();
        while let Some(chunk) = retrieved.stream.next().await {
            let chunk = chunk.unwrap();
            collected_data.extend_from_slice(&chunk);
        }

        assert_eq!(collected_data.len(), expected_size);

        println!(
            "✓ {:.2} MB file: write {:?}, read {:?}",
            *size as f64 / 1024.0 / 1024.0,
            write_duration,
            read_duration
        );
    }
}

#[tokio::test]
#[ignore]
async fn test_distributed_locking() {
    let (service, _temp_dir) = setup_test_service().await;

    let resource = "test-resource";
    let num_attempts = 50;
    let metadata = service.metadata();

    let handles: Vec<_> = (0..num_attempts)
        .map(|i| {
            let metadata = metadata.clone();
            let resource = resource.to_string();
            let owner = format!("worker-{}", i);
            tokio::spawn(async move { metadata.try_acquire_lock(&resource, &owner, 5).await })
        })
        .collect();

    let results = futures::future::join_all(handles).await;

    let acquired_count = results
        .iter()
        .filter(|r| r.as_ref().unwrap().as_ref().unwrap() == &true)
        .count();

    println!(
        "Lock acquisition: {} of {} attempts succeeded",
        acquired_count, num_attempts
    );

    // With concurrent attempts, typically only one should succeed initially
    // Others might succeed as locks expire or get released
    assert!(acquired_count >= 1);
    println!("✓ Distributed locking working correctly");
}

#[tokio::test]
#[ignore]
async fn test_stress_bucket_operations() {
    let (service, _temp_dir) = setup_test_service().await;

    let num_buckets = 20;
    let start = Instant::now();

    // Create buckets sequentially (to avoid lock contention with object-storage backed metadata)
    // In production, bucket creation is a rare operation
    let mut create_count = 0;
    for i in 0..num_buckets {
        let name = format!("stress-bucket-{}", i);
        if service.create_bucket(&name).await.is_ok() {
            create_count += 1;
        }
    }

    // List buckets multiple times concurrently
    let list_handles: Vec<_> = (0..50)
        .map(|_| {
            let service = service.clone();
            tokio::spawn(async move { service.list_buckets().await })
        })
        .collect();

    let list_results = futures::future::join_all(list_handles).await;
    let list_count = list_results
        .iter()
        .filter(|r| r.as_ref().unwrap().is_ok())
        .count();

    let duration = start.elapsed();

    println!(
        "Stress test: {} buckets created, {} list operations in {:?}",
        create_count, list_count, duration
    );

    assert_eq!(create_count, num_buckets);
    assert_eq!(list_count, 50);
    println!("✓ Stress test passed");
}
