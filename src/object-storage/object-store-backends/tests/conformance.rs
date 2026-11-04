//! Runs the same behavioural suite against every backend.
//!
//! The local backend always runs. The cloud backends run against emulators and are skipped unless
//! their endpoint variable is set; `scripts/test-emulators.sh` starts them and sets the variables.

use bytes::Bytes;
use futures::{stream, StreamExt};
use object_store_backends::{
    azure::{AzureBackend, AzureOptions},
    gcs::{GcsBackend, GcsOptions},
    local::LocalBackend,
    s3::{S3Backend, S3Options},
    Backend, BackendError, ByteRange, ByteStream, PublicUrlPurpose, WritePrecondition,
};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;

struct Capabilities {
    signed_urls: bool,
    stores_content_type: bool,
}

fn body(data: Vec<u8>) -> ByteStream {
    Box::pin(stream::once(async move { Ok(Bytes::from(data)) }))
}

fn chunked(chunks: Vec<Vec<u8>>) -> ByteStream {
    Box::pin(stream::iter(chunks.into_iter().map(|c| Ok(Bytes::from(c)))))
}

async fn read_all(mut stream: ByteStream) -> Vec<u8> {
    let mut data = Vec::new();
    while let Some(chunk) = stream.next().await {
        data.extend_from_slice(&chunk.expect("stream chunk"));
    }
    data
}

fn unique(prefix: &str) -> String {
    format!("{}/{}", prefix, uuid_like())
}

fn uuid_like() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{:x}-{:x}", nanos, rand_suffix())
}

fn rand_suffix() -> u64 {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    COUNTER.fetch_add(1, Ordering::Relaxed)
}

async fn run_suite(backend: Arc<dyn Backend>, capabilities: Capabilities) {
    backend.init().await.expect("init");
    let root = unique("conformance");

    eprintln!("step: round trips");
    round_trips_objects(&*backend, &root, &capabilities).await;
    eprintln!("step: etags");
    keeps_etags_consistent(&*backend, &root).await;
    eprintln!("step: ranges");
    streams_ranges(&*backend, &root).await;
    eprintln!("step: missing");
    handles_missing_objects(&*backend, &root).await;
    eprintln!("step: delete");
    deletes_idempotently(&*backend, &root).await;
    eprintln!("step: copy");
    copies_objects(&*backend, &root).await;
    eprintln!("step: list");
    lists_with_pagination(&*backend, &root).await;
    eprintln!("step: preconditions");
    enforces_write_preconditions(&backend, &root).await;
    eprintln!("step: large");
    handles_large_uploads(&*backend, &root).await;

    if capabilities.signed_urls {
        eprintln!("step: signed urls");
        signed_urls_work(&*backend, &root).await;
    }
}

async fn round_trips_objects(backend: &dyn Backend, root: &str, capabilities: &Capabilities) {
    let key = format!("{}/round-trip.txt", root);
    let data = b"hello conformance".to_vec();

    let written = backend
        .put_object(
            &key,
            body(data.clone()),
            Some("text/plain".to_string()),
            HashMap::new(),
        )
        .await
        .unwrap();
    assert_eq!(written.size, data.len() as u64);

    let object = backend.get_object(&key).await.unwrap();
    assert_eq!(object.metadata.size, data.len() as u64);
    if capabilities.stores_content_type {
        assert_eq!(object.metadata.content_type.as_deref(), Some("text/plain"));
    }
    assert_eq!(read_all(object.stream).await, data);

    let empty = format!("{}/empty", root);
    backend
        .put_object(&empty, body(Vec::new()), None, HashMap::new())
        .await
        .unwrap();
    let object = backend.get_object(&empty).await.unwrap();
    assert_eq!(object.metadata.size, 0);
    assert!(read_all(object.stream).await.is_empty());
}

async fn keeps_etags_consistent(backend: &dyn Backend, root: &str) {
    let key = format!("{}/etag.txt", root);

    let written = backend
        .put_object(&key, body(b"one".to_vec()), None, HashMap::new())
        .await
        .unwrap();

    assert!(!written.etag.is_empty());
    assert!(
        !written.etag.contains('"'),
        "etag must be unquoted: {}",
        written.etag
    );

    let head = backend.head_object(&key).await.unwrap();
    assert_eq!(head.etag, written.etag, "put and head must agree");

    let got = backend.get_object(&key).await.unwrap();
    assert_eq!(got.metadata.etag, written.etag, "put and get must agree");

    let listed = backend.list_all_objects(Some(&key)).await.unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].etag, written.etag, "put and list must agree");

    let rewritten = backend
        .put_object(&key, body(b"two".to_vec()), None, HashMap::new())
        .await
        .unwrap();
    assert_ne!(
        rewritten.etag, written.etag,
        "new content must change the etag"
    );
}

async fn streams_ranges(backend: &dyn Backend, root: &str) {
    let key = format!("{}/range.bin", root);
    let data: Vec<u8> = (0..=255u8).cycle().take(5000).collect();

    backend
        .put_object(&key, body(data.clone()), None, HashMap::new())
        .await
        .unwrap();

    let range = backend
        .get_object_range(
            &key,
            ByteRange::Bounded {
                start: 100,
                end: 299,
            },
        )
        .await
        .unwrap();
    assert_eq!((range.start, range.end), (100, 299));
    assert_eq!(read_all(range.stream).await, data[100..300].to_vec());

    let suffix = backend
        .get_object_range(&key, ByteRange::Suffix { length: 10 })
        .await
        .unwrap();
    assert_eq!(read_all(suffix.stream).await, data[4990..].to_vec());

    let past_end = backend
        .get_object_range(&key, ByteRange::From { start: 9000 })
        .await;
    assert!(matches!(
        past_end,
        Err(BackendError::RangeNotSatisfiable { .. })
    ));
}

async fn handles_missing_objects(backend: &dyn Backend, root: &str) {
    let key = format!("{}/missing", root);

    assert!(matches!(
        backend.get_object(&key).await,
        Err(BackendError::NotFound(_))
    ));
    assert!(matches!(
        backend.head_object(&key).await,
        Err(BackendError::NotFound(_))
    ));
    assert!(!backend.object_exists(&key).await.unwrap());
}

async fn deletes_idempotently(backend: &dyn Backend, root: &str) {
    let key = format!("{}/delete-me", root);

    backend
        .put_object(&key, body(b"x".to_vec()), None, HashMap::new())
        .await
        .unwrap();

    backend.delete_object(&key).await.unwrap();
    assert!(!backend.object_exists(&key).await.unwrap());

    backend
        .delete_object(&key)
        .await
        .expect("deleting a missing object succeeds");

    let keys: Vec<String> = (0..5).map(|i| format!("{}/bulk-{}", root, i)).collect();
    for key in &keys {
        backend
            .put_object(key, body(b"x".to_vec()), None, HashMap::new())
            .await
            .unwrap();
    }
    let mut with_missing = keys.clone();
    with_missing.push(format!("{}/bulk-missing", root));

    let results = backend.delete_objects(&with_missing).await.unwrap();
    assert_eq!(results.len(), with_missing.len());
    assert!(results.iter().all(|r| r.is_ok()));
    for key in &keys {
        assert!(!backend.object_exists(key).await.unwrap());
    }
}

async fn copies_objects(backend: &dyn Backend, root: &str) {
    let source = format!("{}/copy-source", root);
    let dest = format!("{}/copy-dest", root);
    let data = b"copy me".to_vec();

    let mut metadata = HashMap::new();
    metadata.insert("owner".to_string(), "tests".to_string());

    backend
        .put_object(
            &source,
            body(data.clone()),
            Some("text/plain".to_string()),
            metadata,
        )
        .await
        .unwrap();

    let copied = backend.copy_object(&source, &dest).await.unwrap();
    assert_eq!(copied.size, data.len() as u64);

    let object = backend.get_object(&dest).await.unwrap();
    assert_eq!(read_all(object.stream).await, data);
    assert_eq!(
        object
            .metadata
            .custom_metadata
            .get("owner")
            .map(String::as_str),
        Some("tests")
    );

    assert!(matches!(
        backend.copy_object(&format!("{}/nope", root), &dest).await,
        Err(BackendError::NotFound(_))
    ));
}

async fn lists_with_pagination(backend: &dyn Backend, root: &str) {
    let prefix = format!("{}/list", root);

    for i in 0..7 {
        backend
            .put_object(
                &format!("{}/item-{}", prefix, i),
                body(vec![i as u8]),
                None,
                HashMap::new(),
            )
            .await
            .unwrap();
    }

    let mut seen = Vec::new();
    let mut token: Option<String> = None;
    let mut pages = 0;

    loop {
        let page = backend
            .list_objects(Some(&prefix), Some(3), token.as_deref())
            .await
            .unwrap();
        assert!(page.objects.len() <= 3);
        seen.extend(page.objects.into_iter().map(|o| o.key));
        pages += 1;

        token = page.next_continuation_token;
        if token.is_none() {
            break;
        }
        assert!(pages < 10, "pagination did not terminate");
    }

    seen.sort();
    seen.dedup();
    assert_eq!(seen.len(), 7);
    assert!(pages >= 3);
}

async fn enforces_write_preconditions(backend: &Arc<dyn Backend>, root: &str) {
    let key = format!("{}/cas", root);

    let first = backend
        .put_object_if(
            &key,
            Bytes::from_static(b"v1"),
            Some("application/json".to_string()),
            WritePrecondition::IfAbsent,
        )
        .await
        .unwrap();

    let again = backend
        .put_object_if(
            &key,
            Bytes::from_static(b"other"),
            None,
            WritePrecondition::IfAbsent,
        )
        .await;
    assert!(
        matches!(again, Err(BackendError::PreconditionFailed(_))),
        "IfAbsent must fail when the object exists: {:?}",
        again.map(|m| m.etag)
    );

    let stale = backend
        .put_object_if(
            &key,
            Bytes::from_static(b"stale"),
            None,
            WritePrecondition::IfMatch("not-the-etag".to_string()),
        )
        .await;
    assert!(matches!(stale, Err(BackendError::PreconditionFailed(_))));

    let second = backend
        .put_object_if(
            &key,
            Bytes::from_static(b"v2"),
            None,
            WritePrecondition::IfMatch(first.etag.clone()),
        )
        .await
        .unwrap();
    assert_ne!(second.etag, first.etag);

    let reused = backend
        .put_object_if(
            &key,
            Bytes::from_static(b"v3"),
            None,
            WritePrecondition::IfMatch(first.etag.clone()),
        )
        .await;
    assert!(
        matches!(reused, Err(BackendError::PreconditionFailed(_))),
        "the etag of an overwritten version must be rejected"
    );

    let current = backend.get_object(&key).await.unwrap();
    assert_eq!(current.metadata.etag, second.etag);
    assert_eq!(read_all(current.stream).await, b"v2".to_vec());

    // Exactly one of many concurrent creators wins.
    let race_key = format!("{}/race", root);
    let mut tasks = Vec::new();
    for i in 0..8 {
        let backend = backend.clone();
        let key = race_key.clone();
        tasks.push(tokio::spawn(async move {
            backend
                .put_object_if(
                    &key,
                    Bytes::from(format!("writer-{}", i)),
                    None,
                    WritePrecondition::IfAbsent,
                )
                .await
        }));
    }

    let mut winners = 0;
    for task in tasks {
        match task.await.unwrap() {
            Ok(_) => winners += 1,
            Err(BackendError::PreconditionFailed(_)) => {}
            Err(e) => panic!("unexpected error in race: {}", e),
        }
    }
    assert_eq!(winners, 1, "exactly one writer may create the object");

    // Compare-and-swap from the same etag: exactly one winner again.
    let cas_key = format!("{}/cas-race", root);
    let base = backend
        .put_object_if(
            &cas_key,
            Bytes::from_static(b"base"),
            None,
            WritePrecondition::IfAbsent,
        )
        .await
        .unwrap();

    let mut tasks = Vec::new();
    for i in 0..8 {
        let backend = backend.clone();
        let key = cas_key.clone();
        let etag = base.etag.clone();
        tasks.push(tokio::spawn(async move {
            backend
                .put_object_if(
                    &key,
                    Bytes::from(format!("swap-{}", i)),
                    None,
                    WritePrecondition::IfMatch(etag),
                )
                .await
        }));
    }

    let mut winners = 0;
    for task in tasks {
        match task.await.unwrap() {
            Ok(_) => winners += 1,
            Err(BackendError::PreconditionFailed(_)) => {}
            Err(e) => panic!("unexpected error in swap race: {}", e),
        }
    }
    assert_eq!(winners, 1, "exactly one swap may succeed");
}

async fn handles_large_uploads(backend: &dyn Backend, root: &str) {
    let key = format!("{}/large.bin", root);

    let chunk: Vec<u8> = (0..=255u8).cycle().take(1024 * 1024).collect();
    let chunks: Vec<Vec<u8>> = (0..20).map(|_| chunk.clone()).collect();
    let expected: Vec<u8> = chunks.iter().flatten().copied().collect();

    let written = backend
        .put_object(&key, chunked(chunks), None, HashMap::new())
        .await
        .unwrap();
    assert_eq!(written.size, expected.len() as u64);

    let head = backend.head_object(&key).await.unwrap();
    assert_eq!(head.size, expected.len() as u64);
    assert_eq!(head.etag, written.etag, "multipart put and head must agree");

    let object = backend.get_object(&key).await.unwrap();
    let downloaded = read_all(object.stream).await;
    assert_eq!(Sha256::digest(&downloaded), Sha256::digest(&expected));

    let range = backend
        .get_object_range(
            &key,
            ByteRange::Bounded {
                start: 15 * 1024 * 1024,
                end: 17 * 1024 * 1024 - 1,
            },
        )
        .await
        .unwrap();
    assert_eq!(
        read_all(range.stream).await,
        expected[15 * 1024 * 1024..17 * 1024 * 1024].to_vec()
    );
}

async fn signed_urls_work(backend: &dyn Backend, root: &str) {
    let http = reqwest::Client::new();
    let key = format!("{}/signed.bin", root);
    let data = b"uploaded through a signed url".to_vec();

    let upload = backend
        .get_public_url(&key, 300, PublicUrlPurpose::Upload)
        .await
        .unwrap();

    let mut request = http.put(&upload.url).body(data.clone());
    for (name, value) in &upload.headers {
        request = request.header(name, value);
    }
    let response = request.send().await.unwrap();
    assert!(
        response.status().is_success(),
        "signed upload rejected with {}: {}",
        response.status(),
        response.text().await.unwrap_or_default()
    );

    let head = backend.head_object(&key).await.unwrap();
    assert_eq!(head.size, data.len() as u64);

    let download = backend
        .get_public_url(&key, 300, PublicUrlPurpose::Retrieve)
        .await
        .unwrap();
    assert!(download.headers.is_empty());

    let response = http.get(&download.url).send().await.unwrap();
    assert!(
        response.status().is_success(),
        "signed download rejected with {}",
        response.status()
    );
    assert_eq!(response.bytes().await.unwrap().to_vec(), data);
}

fn env(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty())
}

#[tokio::test]
async fn local_backend_conforms() {
    let dir = tempfile::tempdir().unwrap();
    let backend = LocalBackend::new(dir.path().to_path_buf(), "conformance".to_string());

    run_suite(
        Arc::new(backend),
        Capabilities {
            signed_urls: false,
            stores_content_type: true,
        },
    )
    .await;
}

#[tokio::test]
async fn s3_compatible_backend_conforms() {
    let Some(endpoint) = env("OBJECT_STORE_TEST_S3_ENDPOINT") else {
        eprintln!("skipping: OBJECT_STORE_TEST_S3_ENDPOINT is not set");
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

    run_suite(
        Arc::new(backend),
        Capabilities {
            signed_urls: true,
            stores_content_type: true,
        },
    )
    .await;
}

#[tokio::test]
async fn azure_backend_conforms_with_an_account_key() {
    let Some(connection_string) = env("OBJECT_STORE_TEST_AZURE_CONNECTION_STRING") else {
        eprintln!("skipping: OBJECT_STORE_TEST_AZURE_CONNECTION_STRING is not set");
        return;
    };
    let container =
        env("OBJECT_STORE_TEST_AZURE_CONTAINER").unwrap_or_else(|| "conformance".to_string());

    let backend = AzureBackend::new_from_connection_string(connection_string, container).unwrap();

    run_suite(
        Arc::new(backend),
        Capabilities {
            signed_urls: true,
            stores_content_type: true,
        },
    )
    .await;
}

#[tokio::test]
async fn azure_connection_string_options_round_trip() {
    let options = AzureOptions::from_connection_string(
        "AccountName=acct;AccountKey=a2V5;BlobEndpoint=http://127.0.0.1:10000/acct",
    )
    .unwrap();

    assert_eq!(options.account, "acct");
    assert_eq!(
        options.endpoint.as_deref(),
        Some("http://127.0.0.1:10000/acct")
    );
}

#[tokio::test]
async fn gcs_backend_conforms() {
    let Some(endpoint) = env("OBJECT_STORE_TEST_GCS_ENDPOINT") else {
        eprintln!("skipping: OBJECT_STORE_TEST_GCS_ENDPOINT is not set");
        return;
    };
    let bucket = env("OBJECT_STORE_TEST_GCS_BUCKET").unwrap_or_else(|| "conformance".to_string());

    let backend = GcsBackend::new_with_options(
        bucket,
        GcsOptions {
            endpoint: Some(endpoint),
            credentials_file: env("OBJECT_STORE_TEST_GCS_CREDENTIALS"),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    run_suite(
        Arc::new(backend), // fake-gcs-server ignores the content type in multipart metadata
        Capabilities {
            signed_urls: true,
            stores_content_type: false,
        },
    )
    .await;
}
