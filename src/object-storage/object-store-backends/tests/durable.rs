//! Durable multipart uploads behave the same on every backend: any handle can continue an upload,
//! a re-uploaded part replaces the earlier one, completion is reported as gone once done, and
//! open uploads can be listed and aborted.
//!
//! The local backend always runs. S3 and Azure run against the emulators from
//! `scripts/test-emulators.sh`. GCS needs a real bucket (`OBJECT_STORE_TEST_GCS_REAL_BUCKET` plus
//! application default credentials), since the emulator's XML multipart support is unverified.

use bytes::Bytes;
use futures::StreamExt;
use object_store_backends::{
    azure::AzureBackend,
    gcs::{GcsBackend, GcsOptions},
    local::LocalBackend,
    s3::{S3Backend, S3Options},
    Backend, BackendError, DurablePartRef, PutOptions, DURABLE_MIN_PART_SIZE,
};
use std::collections::HashMap;
use std::sync::Arc;

fn env(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty())
}

fn skip(test: &str, variable: &str) {
    eprintln!("SKIP {test}: {variable} is not set");
}

fn unique(prefix: &str) -> String {
    format!("{}/{}", prefix, uuid::Uuid::new_v4().simple())
}

fn part(byte: u8, size: u64) -> Bytes {
    Bytes::from(vec![byte; size as usize])
}

async fn read(backend: &dyn Backend, key: &str) -> Vec<u8> {
    let mut object = backend.get_object(key).await.unwrap();
    let mut data = Vec::new();
    while let Some(chunk) = object.stream.next().await {
        data.extend_from_slice(&chunk.unwrap());
    }
    data
}

async fn run_durable_suite(backend: Arc<dyn Backend>, prefix: &str) {
    let key = unique(prefix);
    let opts = PutOptions {
        content_type: Some("application/gzip".to_string()),
        metadata: HashMap::from([("rows".to_string(), "42".to_string())]),
        ..Default::default()
    };

    eprintln!("step: start and list");
    let upload_id = backend.start_durable_multipart(&key, &opts).await.unwrap();
    let listed = backend.list_durable_multiparts(prefix).await.unwrap();
    assert!(
        listed.iter().any(|upload| upload.upload_id == upload_id && upload.key == key),
        "{listed:?}"
    );

    eprintln!("step: replace a part with a shorter one");
    let first = backend
        .upload_durable_part(&key, &upload_id, 1, part(1, DURABLE_MIN_PART_SIZE + 100))
        .await
        .unwrap();
    let replaced = backend
        .upload_durable_part(&key, &upload_id, 1, part(3, DURABLE_MIN_PART_SIZE))
        .await
        .unwrap();
    assert_ne!(first.etag, replaced.etag);
    let last = backend
        .upload_durable_part(&key, &upload_id, 2, part(2, 1000))
        .await
        .unwrap();

    eprintln!("step: complete");
    let parts = [
        DurablePartRef {
            number: 1,
            etag: replaced.etag.clone(),
        },
        DurablePartRef {
            number: 2,
            etag: last.etag.clone(),
        },
    ];
    let metadata = backend
        .complete_durable_multipart(&key, &upload_id, &parts)
        .await
        .unwrap();
    assert_eq!(metadata.size, DURABLE_MIN_PART_SIZE + 1000);
    assert_eq!(metadata.custom_metadata.get("rows").map(String::as_str), Some("42"));

    let data = read(&*backend, &key).await;
    assert_eq!(data.len() as u64, DURABLE_MIN_PART_SIZE + 1000);
    assert!(data[..DURABLE_MIN_PART_SIZE as usize].iter().all(|b| *b == 3));
    assert!(data[DURABLE_MIN_PART_SIZE as usize..].iter().all(|b| *b == 2));

    eprintln!("step: complete again");
    // S3 answers a repeated completion with the finished object for a while; the others no
    // longer know the upload. Both tell the caller the upload is done.
    match backend.complete_durable_multipart(&key, &upload_id, &parts).await {
        Ok(again) => assert_eq!(again.size, metadata.size),
        Err(BackendError::NotFound(_)) => {}
        Err(other) => panic!("{other:?}"),
    }

    eprintln!("step: abort");
    let other = unique(prefix);
    let aborted = backend
        .start_durable_multipart(&other, &PutOptions::default())
        .await
        .unwrap();
    backend
        .upload_durable_part(&other, &aborted, 1, part(1, 10))
        .await
        .unwrap();
    backend.abort_durable_multipart(&other, &aborted).await.unwrap();
    backend.abort_durable_multipart(&other, &aborted).await.unwrap();
    assert!(!backend
        .list_durable_multiparts(prefix)
        .await
        .unwrap()
        .iter()
        .any(|upload| upload.upload_id == aborted));
    assert!(!backend.object_exists(&other).await.unwrap());

    backend.delete_object(&key).await.unwrap();
}

#[tokio::test]
async fn local_durable_uploads() {
    let dir = tempfile::tempdir().unwrap();
    let backend = LocalBackend::new(dir.path().to_path_buf(), "durable".to_string());
    backend.init().await.unwrap();

    run_durable_suite(Arc::new(backend), "durable-local").await;
}

#[tokio::test]
async fn s3_durable_uploads() {
    let Some(endpoint) = env("OBJECT_STORE_TEST_S3_ENDPOINT") else {
        skip("s3_durable_uploads", "OBJECT_STORE_TEST_S3_ENDPOINT");
        return;
    };
    let bucket = env("OBJECT_STORE_TEST_S3_BUCKET").unwrap_or_else(|| "conformance".to_string());
    let backend = S3Backend::new_with_options(
        bucket,
        S3Options {
            region: "us-east-1".to_string(),
            endpoint: Some(endpoint),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    run_durable_suite(Arc::new(backend), "durable-s3").await;
}

#[tokio::test]
async fn azure_durable_uploads() {
    let Some(connection_string) = env("OBJECT_STORE_TEST_AZURE_CONNECTION_STRING") else {
        skip("azure_durable_uploads", "OBJECT_STORE_TEST_AZURE_CONNECTION_STRING");
        return;
    };
    let container =
        env("OBJECT_STORE_TEST_AZURE_CONTAINER").unwrap_or_else(|| "conformance".to_string());
    let backend = AzureBackend::new_from_connection_string(connection_string, container).unwrap();

    run_durable_suite(Arc::new(backend), "durable-azure").await;
}

#[tokio::test]
async fn gcs_durable_uploads_against_a_real_bucket() {
    let Some(bucket) = env("OBJECT_STORE_TEST_GCS_REAL_BUCKET") else {
        skip(
            "gcs_durable_uploads_against_a_real_bucket",
            "OBJECT_STORE_TEST_GCS_REAL_BUCKET",
        );
        return;
    };
    let backend = GcsBackend::new_with_options(
        bucket,
        GcsOptions {
            credentials_file: env("OBJECT_STORE_TEST_GCS_CREDENTIALS"),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    run_durable_suite(Arc::new(backend), "durable-gcs").await;
}
