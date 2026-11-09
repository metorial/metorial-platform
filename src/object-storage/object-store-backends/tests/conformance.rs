//! Runs the same behavioural suite against every backend.
//!
//! The local backend always runs. The cloud backends run against emulators and are skipped unless
//! their endpoint variable is set; `scripts/test-emulators.sh` starts them and sets the variables.

mod common;

use bytes::Bytes;
use common::{chunks_of, failing_after, pattern, sha256_hex, KIB, MIB};
use futures::{stream, StreamExt};
use object_store_backends::{
    azure::{AzureBackend, AzureOptions},
    gcs::{GcsBackend, GcsOptions},
    local::LocalBackend,
    s3::{S3Backend, S3Options},
    Backend, BackendError, ByteRange, ByteStream, PartSizer, PublicUrlPurpose, PutOptions,
    UploadSettings, Uploader, WritePrecondition,
};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;

struct Capabilities {
    signed_urls: bool,
    stores_content_type: bool,
    /// Whether two uploads racing to one key both succeed. Azure discards the loser's staged
    /// blocks, so only one may succeed there and the other must fail with a conflict.
    concurrent_writes_to_one_key: bool,
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

/// Small thresholds so part boundaries are reachable with a few dozen MiB; each backend still
/// raises the part size to its own minimum.
fn uploader() -> Arc<Uploader> {
    Arc::new(Uploader::new(UploadSettings {
        part_concurrency: 4,
        min_part_size: MIB,
        memory_budget_bytes: 64 * MIB,
        single_request_threshold: 2 * MIB,
        ..UploadSettings::default()
    }))
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
    eprintln!("step: part boundaries");
    uploads_across_part_boundaries(&*backend, &root).await;
    eprintln!("step: size hints");
    tolerates_any_size_hint(&*backend, &root).await;
    eprintln!("step: multipart metadata");
    keeps_metadata_on_multipart_uploads(&*backend, &root, &capabilities).await;
    eprintln!("step: repeated completion");
    completes_again_after_a_lost_response(&*backend, &root).await;
    eprintln!("step: failed uploads");
    leaves_nothing_behind_when_the_input_fails(&*backend, &root).await;
    eprintln!("step: overwrites");
    overwrites_across_upload_paths(&*backend, &root).await;
    eprintln!("step: concurrent uploads");
    uploads_concurrently(&backend, &root, &capabilities).await;
    eprintln!("step: large copy");
    copies_large_objects(&*backend, &root).await;
    eprintln!("step: lookalike keys");
    keeps_lookalike_keys_independent(&*backend, &root, &capabilities).await;

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

async fn put_and_verify(backend: &dyn Backend, key: &str, data: &[u8], opts: PutOptions) {
    let hint = opts.size_hint;
    let uploaded = backend
        .put_object_stream(key, chunks_of(data, 256 * KIB as usize + 17), opts)
        .await
        .unwrap_or_else(|e| panic!("{} bytes with hint {:?}: {}", data.len(), hint, e));

    assert_eq!(uploaded.metadata.size, data.len() as u64, "{}", key);
    assert_eq!(uploaded.sha256, sha256_hex(data), "{}", key);

    let head = backend.head_object(key).await.unwrap();
    assert_eq!(head.size, data.len() as u64, "{}", key);
    assert_eq!(head.etag, uploaded.metadata.etag, "{}", key);

    let object = backend.get_object(key).await.unwrap();
    assert_eq!(
        sha256_hex(&read_all(object.stream).await),
        sha256_hex(data),
        "{}",
        key
    );
}

async fn uploads_across_part_boundaries(backend: &dyn Backend, root: &str) {
    let settings = backend.uploader().settings().clone();
    let sizer = PartSizer::new(&backend.upload_limits(), &settings, None);
    let threshold = settings.single_request_threshold;
    let head = sizer.head_size();
    let part = sizer.part_size(1, head);

    let mut sizes = vec![
        threshold - 1,
        threshold,
        threshold + 1,
        head - 1,
        head,
        head + 1,
        head + part - 1,
        head + part,
        head + part + 1,
        head + 3 * part,
    ];
    sizes.sort_unstable();
    sizes.dedup();

    for (index, size) in sizes.into_iter().enumerate() {
        let data = pattern(size as usize, index as u64);
        let key = format!("{}/boundaries/{}", root, size);
        put_and_verify(backend, &key, &data, PutOptions::default()).await;
    }
}

async fn tolerates_any_size_hint(backend: &dyn Backend, root: &str) {
    let size = 40 * MIB + 3;
    let data = pattern(size as usize, 99);

    for hint in [Some(size), Some(MIB), Some(0), Some(u64::MAX)] {
        let key = format!("{}/hinted/{:?}", root, hint);
        let opts = PutOptions {
            size_hint: hint,
            ..Default::default()
        };
        put_and_verify(backend, &key, &data, opts).await;
    }
}

async fn keeps_metadata_on_multipart_uploads(
    backend: &dyn Backend,
    root: &str,
    capabilities: &Capabilities,
) {
    let key = format!("{}/multipart-metadata.zip", root);
    let data = pattern(12 * MIB as usize + 5, 7);
    let opts = PutOptions {
        content_type: Some("application/zip".to_string()),
        metadata: HashMap::from([
            ("origin".to_string(), "conformance".to_string()),
            ("job".to_string(), "42".to_string()),
        ]),
        size_hint: Some(data.len() as u64),
    };

    put_and_verify(backend, &key, &data, opts).await;

    let head = backend.head_object(&key).await.unwrap();
    assert_eq!(
        head.custom_metadata.get("origin").map(String::as_str),
        Some("conformance")
    );
    assert_eq!(
        head.custom_metadata.get("job").map(String::as_str),
        Some("42")
    );
    if capabilities.stores_content_type {
        assert_eq!(head.content_type.as_deref(), Some("application/zip"));
    }
}

/// What the uploader sees when it retries a completion whose response was lost: the object
/// again, or `NotFound` for an upload the backend no longer knows.
async fn completes_again_after_a_lost_response(backend: &dyn Backend, root: &str) {
    let key = format!("{}/completed-twice.bin", root);
    let data = pattern(MIB as usize + 7, 8);

    let upload = backend
        .start_multipart(&key, &PutOptions::default())
        .await
        .unwrap();
    let part = upload
        .upload_part(1, 0, Bytes::from(data.clone()))
        .await
        .unwrap();
    upload.complete(vec![part.clone()]).await.unwrap();

    match upload.complete(vec![part]).await {
        Ok(again) => assert_eq!(again.size, data.len() as u64),
        Err(BackendError::NotFound(_)) => {}
        Err(error) => panic!("completing again failed with {:?}", error),
    }

    assert_eq!(
        backend.head_object(&key).await.unwrap().size,
        data.len() as u64
    );
    assert!(read_all(backend.get_object(&key).await.unwrap().stream).await == data);
}

async fn leaves_nothing_behind_when_the_input_fails(backend: &dyn Backend, root: &str) {
    for (name, size) in [("small", 100 * KIB), ("large", 12 * MIB)] {
        let key = format!("{}/failed/{}", root, name);
        let data = pattern(size as usize, size);

        backend
            .put_object_stream(
                &key,
                failing_after(&data, 64 * KIB as usize),
                PutOptions::default(),
            )
            .await
            .expect_err("a failing stream must fail the upload");
        assert!(
            matches!(
                backend.head_object(&key).await,
                Err(BackendError::NotFound(_))
            ),
            "{} failed upload left an object",
            name
        );

        let kept = format!("{}/failed/{}-kept", root, name);
        backend
            .put_object(&kept, body(b"original".to_vec()), None, HashMap::new())
            .await
            .unwrap();
        backend
            .put_object_stream(
                &kept,
                failing_after(&data, 64 * KIB as usize),
                PutOptions::default(),
            )
            .await
            .expect_err("a failing stream must fail the upload");

        let object = backend.get_object(&kept).await.unwrap();
        assert_eq!(read_all(object.stream).await, b"original", "{}", name);
    }
}

async fn overwrites_across_upload_paths(backend: &dyn Backend, root: &str) {
    let key = format!("{}/overwritten.bin", root);
    let large = pattern(14 * MIB as usize, 3);
    let larger = pattern(18 * MIB as usize + 1, 4);

    put_and_verify(backend, &key, b"small", PutOptions::default()).await;
    put_and_verify(backend, &key, &large, PutOptions::default()).await;
    put_and_verify(backend, &key, &larger, PutOptions::default()).await;
    put_and_verify(backend, &key, b"small again", PutOptions::default()).await;
}

async fn uploads_concurrently(backend: &Arc<dyn Backend>, root: &str, capabilities: &Capabilities) {
    let tasks: Vec<_> = (0..6u64)
        .map(|index| {
            let backend = backend.clone();
            let key = format!("{}/concurrent/{}", root, index);
            tokio::spawn(async move {
                let data = pattern(8 * MIB as usize + index as usize * 4099, 100 + index);
                put_and_verify(&*backend, &key, &data, PutOptions::default()).await;
            })
        })
        .collect();
    futures::future::try_join_all(tasks).await.unwrap();

    let key = format!("{}/concurrent/same", root);
    let first = pattern(9 * MIB as usize, 200);
    let second = pattern(11 * MIB as usize, 201);
    let writes: Vec<_> = [first, second]
        .into_iter()
        .map(|data| {
            let backend = backend.clone();
            let key = key.clone();
            tokio::spawn(async move {
                let stream = chunks_of(&data, MIB as usize);
                let result = backend
                    .put_object_stream(&key, stream, PutOptions::default())
                    .await;
                (sha256_hex(&data), result)
            })
        })
        .collect();

    let mut written = Vec::new();
    for result in futures::future::try_join_all(writes).await.unwrap() {
        match result {
            (sha256, Ok(_)) => written.push(sha256),
            (_, Err(BackendError::Conflict(e))) if !capabilities.concurrent_writes_to_one_key => {
                eprintln!("concurrent write lost: {}", e)
            }
            (_, Err(e)) => panic!("concurrent write to one key failed: {}", e),
        }
    }
    assert!(
        !written.is_empty(),
        "at least one concurrent write must succeed"
    );

    let object = backend.get_object(&key).await.unwrap();
    let stored = sha256_hex(&read_all(object.stream).await);
    assert!(
        written.contains(&stored),
        "concurrent writes to one key must leave one successful write intact"
    );
}

async fn copies_large_objects(backend: &dyn Backend, root: &str) {
    let source = format!("{}/copy-large-source", root);
    let dest = format!("{}/copy-large-dest", root);
    let data = pattern(12 * MIB as usize + 9, 300);
    let opts = PutOptions {
        metadata: HashMap::from([("copied".to_string(), "yes".to_string())]),
        ..Default::default()
    };
    put_and_verify(backend, &source, &data, opts).await;

    let copied = backend.copy_object(&source, &dest).await.unwrap();
    assert_eq!(copied.size, data.len() as u64);

    let object = backend.get_object(&dest).await.unwrap();
    assert_eq!(
        object
            .metadata
            .custom_metadata
            .get("copied")
            .map(String::as_str),
        Some("yes")
    );
    assert_eq!(
        sha256_hex(&read_all(object.stream).await),
        sha256_hex(&data)
    );
}

async fn content_of(backend: &dyn Backend, key: &str) -> Vec<u8> {
    read_all(backend.get_object(key).await.unwrap().stream).await
}

/// Keys that a sidecar-per-object layout could confuse: an object and one named like its
/// sidecar, and two objects that differ only in their extension.
async fn keeps_lookalike_keys_independent(
    backend: &dyn Backend,
    root: &str,
    capabilities: &Capabilities,
) {
    let dir = format!("{}/lookalike", root);
    let keys = ["x", "x.meta.json", "x.txt", "x.bin", "x.meta.meta.json"]
        .map(|name| format!("{}/{}", dir, name));

    for (index, key) in keys.iter().enumerate() {
        let content_type = format!("type/{}", index);
        backend
            .put_object(
                key,
                body(format!("data of {}", key).into_bytes()),
                Some(content_type),
                HashMap::new(),
            )
            .await
            .unwrap();
    }

    for (index, key) in keys.iter().enumerate() {
        let head = backend.head_object(key).await.unwrap();
        assert_eq!(&head.key, key);
        assert_eq!(head.size, format!("data of {}", key).len() as u64);
        if capabilities.stores_content_type {
            assert_eq!(head.content_type, Some(format!("type/{}", index)));
        }
        assert_eq!(
            content_of(backend, key).await,
            format!("data of {}", key).into_bytes()
        );
    }

    let listed: Vec<String> = backend
        .list_objects(Some(&format!("{}/", dir)), None, None)
        .await
        .unwrap()
        .objects
        .into_iter()
        .map(|object| object.key)
        .collect();
    let mut expected = keys.to_vec();
    expected.sort();
    assert_eq!(listed, expected);

    let copy = format!("{}/copy-of-x", dir);
    backend.copy_object(&keys[1], &copy).await.unwrap();
    assert_eq!(
        content_of(backend, &copy).await,
        format!("data of {}", keys[1]).into_bytes()
    );
    backend.copy_object(&keys[0], &keys[1]).await.unwrap();
    assert_eq!(
        content_of(backend, &keys[1]).await,
        format!("data of {}", keys[0]).into_bytes()
    );
    if capabilities.stores_content_type {
        assert_eq!(
            backend
                .head_object(&keys[1])
                .await
                .unwrap()
                .content_type
                .as_deref(),
            Some("type/0")
        );
    }

    backend.delete_object(&keys[0]).await.unwrap();
    assert!(matches!(
        backend.head_object(&keys[0]).await,
        Err(BackendError::NotFound(_))
    ));
    for key in &keys[1..] {
        backend.head_object(key).await.unwrap();
    }

    backend.delete_object(&keys[1]).await.unwrap();
    assert!(matches!(
        backend.head_object(&keys[1]).await,
        Err(BackendError::NotFound(_))
    ));
    for key in &keys[2..] {
        assert_eq!(
            content_of(backend, key).await,
            format!("data of {}", key).into_bytes()
        );
    }

    for key in keys.iter().skip(2).chain([&copy]) {
        backend.delete_object(key).await.unwrap();
    }
    assert!(backend
        .list_objects(Some(&format!("{}/", dir)), None, None)
        .await
        .unwrap()
        .objects
        .is_empty());
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

/// Written to stderr directly rather than through `eprintln!`, which the test harness captures,
/// so a skipped test is visible even though it reports `ok`.
fn skip(test: &str, variable: &str) {
    use std::io::Write;
    let _ = writeln!(
        std::io::stderr(),
        "SKIP {test}: {variable} is not set (run scripts/test-emulators.sh)"
    );
}

fn env(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty())
}

#[tokio::test]
async fn local_backend_conforms() {
    let dir = tempfile::tempdir().unwrap();
    let backend = LocalBackend::new(dir.path().to_path_buf(), "conformance".to_string())
        .with_uploader(uploader());

    run_suite(
        Arc::new(backend),
        Capabilities {
            signed_urls: false,
            stores_content_type: true,
            concurrent_writes_to_one_key: true,
        },
    )
    .await;
}

#[tokio::test]
async fn s3_compatible_backend_conforms() {
    let Some(endpoint) = env("OBJECT_STORE_TEST_S3_ENDPOINT") else {
        skip(
            "s3_compatible_backend_conforms",
            "OBJECT_STORE_TEST_S3_ENDPOINT",
        );
        return;
    };
    let bucket = env("OBJECT_STORE_TEST_S3_BUCKET").unwrap_or_else(|| "conformance".to_string());

    let backend = S3Backend::new_with_options(
        bucket.clone(),
        S3Options {
            region: "us-east-1".to_string(),
            endpoint: Some(endpoint.clone()),
            ..Default::default()
        },
    )
    .await
    .unwrap()
    .with_uploader(uploader());
    let backend = Arc::new(backend);

    run_suite(
        backend.clone(),
        Capabilities {
            signed_urls: true,
            stores_content_type: true,
            concurrent_writes_to_one_key: true,
        },
    )
    .await;

    eprintln!("step: abandoned starts");
    aborts_uploads_started_for_callers_that_gave_up(&*backend, &endpoint, &bucket).await;
}

async fn pending_s3_uploads(endpoint: &str, bucket: &str, prefix: &str) -> Vec<String> {
    let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(aws_sdk_s3::config::Region::new("us-east-1"))
        .endpoint_url(endpoint)
        .load()
        .await;
    let client = aws_sdk_s3::Client::from_conf(
        aws_sdk_s3::config::Builder::from(&config)
            .force_path_style(true)
            .build(),
    );

    client
        .list_multipart_uploads()
        .bucket(bucket)
        .prefix(prefix)
        .send()
        .await
        .unwrap()
        .uploads()
        .iter()
        .filter_map(|upload| upload.upload_id().map(str::to_string))
        .collect()
}

async fn aborts_uploads_started_for_callers_that_gave_up(
    backend: &dyn Backend,
    endpoint: &str,
    bucket: &str,
) {
    let prefix = unique("abandoned-start");

    let mut abandoned = 0;
    for index in 0..20 {
        let key = format!("{}/{}", prefix, index);
        let opts = PutOptions::default();
        match tokio::time::timeout(
            std::time::Duration::from_micros(index * 500),
            backend.start_multipart(&key, &opts),
        )
        .await
        {
            Ok(started) => started.unwrap().abort().await,
            Err(_) => abandoned += 1,
        }
    }
    assert!(
        abandoned > 0,
        "every start finished before its caller gave up"
    );

    let mut pending = Vec::new();
    for _ in 0..50 {
        pending = pending_s3_uploads(endpoint, bucket, &prefix).await;
        if pending.is_empty() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    assert!(pending.is_empty(), "uploads left behind: {:?}", pending);
}

#[tokio::test]
async fn azure_backend_conforms_with_an_account_key() {
    let Some(connection_string) = env("OBJECT_STORE_TEST_AZURE_CONNECTION_STRING") else {
        skip(
            "azure_backend_conforms_with_an_account_key",
            "OBJECT_STORE_TEST_AZURE_CONNECTION_STRING",
        );
        return;
    };
    let container =
        env("OBJECT_STORE_TEST_AZURE_CONTAINER").unwrap_or_else(|| "conformance".to_string());

    let backend = AzureBackend::new_from_connection_string(connection_string, container)
        .unwrap()
        .with_uploader(uploader());

    run_suite(
        Arc::new(backend),
        Capabilities {
            signed_urls: true,
            stores_content_type: true,
            concurrent_writes_to_one_key: false,
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
        skip("gcs_backend_conforms", "OBJECT_STORE_TEST_GCS_ENDPOINT");
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
    .unwrap()
    .with_uploader(uploader());

    run_suite(
        Arc::new(backend), // fake-gcs-server ignores the content type in multipart metadata
        Capabilities {
            signed_urls: true,
            stores_content_type: false,
            concurrent_writes_to_one_key: true,
        },
    )
    .await;
}
