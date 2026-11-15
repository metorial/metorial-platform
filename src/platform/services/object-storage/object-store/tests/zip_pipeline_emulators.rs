//! Builds a modest archive on each cloud backend's emulator and checks it byte for byte against
//! the same archive built on local storage.
//!
//! Skipped, with a SKIP line on stderr, unless the emulator variables are set;
//! `scripts/test-emulators.sh` starts the emulators and sets them.

mod pipeline_support;

use std::collections::HashMap;
use std::io::Read;
use std::sync::Arc;

use bytes::Bytes;
use object_store::metadata::MetadataStore;
use object_store::zip::{build_archive, ArchiveResult, CompressionHint, ZipJobSpec, ZipProgress};
use object_store::ObjectStoreService;
use object_store_backends::azure::AzureBackend;
use object_store_backends::gcs::{GcsBackend, GcsOptions};
use object_store_backends::s3::{S3Backend, S3Options};
use object_store_backends::{Backend, ByteStream, UploadSettings, Uploader};
use pipeline_support::*;
use sha2::{Digest, Sha256};
use tokio_util::sync::CancellationToken;

struct Fixture {
    path: String,
    data: Vec<u8>,
    hint: CompressionHint,
}

/// About 40 MiB in 40 entries: two entries large enough to stream in parts across reconnectable
/// ranges, a precompressed image, an empty file, a forced-stored file and many small text and
/// random files.
fn fixtures() -> Vec<Fixture> {
    let mut fixtures = vec![
        Fixture {
            path: "large/random.bin".to_string(),
            data: generated_bytes(Content::Random, 1, 12 * MIB + 7),
            hint: CompressionHint::Auto,
        },
        Fixture {
            path: "large/log.txt".to_string(),
            data: generated_bytes(Content::Text, 2, 16 * MIB + 3),
            hint: CompressionHint::Auto,
        },
        Fixture {
            path: "media/photo.png".to_string(),
            data: generated_bytes(Content::Random, 3, 700 * KIB),
            hint: CompressionHint::Auto,
        },
        Fixture {
            path: "empty.txt".to_string(),
            data: Vec::new(),
            hint: CompressionHint::Auto,
        },
        Fixture {
            path: "stored/notes.txt".to_string(),
            data: generated_bytes(Content::Text, 4, 300 * KIB),
            hint: CompressionHint::Store,
        },
    ];
    for index in 0..35u64 {
        let (content, extension) = if index % 3 == 0 {
            (Content::Random, "bin")
        } else {
            (Content::Text, "md")
        };
        fixtures.push(Fixture {
            path: format!("docs/{index:02}.{extension}"),
            data: generated_bytes(content, 100 + index, 100 * KIB + index * 13_001),
            hint: CompressionHint::Auto,
        });
    }
    fixtures
}

fn uploader() -> Arc<Uploader> {
    Arc::new(Uploader::new(UploadSettings {
        part_concurrency: 4,
        min_part_size: MIB,
        memory_budget_bytes: 64 * MIB,
        single_request_threshold: 2 * MIB,
        ..UploadSettings::default()
    }))
}

fn suffix() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{nanos:x}")
}

fn archive_spec(source_bucket: &str, archive_bucket: &str, fixtures: &[Fixture]) -> ZipJobSpec {
    let entries = fixtures
        .iter()
        .map(|fixture| {
            let mut entry = entry(&fixture.path, source_bucket, &fixture.path);
            entry.compression = fixture.hint;
            entry
        })
        .collect();
    spec(archive_bucket, "exports/archive.zip", entries)
}

async fn upload_fixtures(service: &ObjectStoreService, bucket: &str, fixtures: &[Fixture]) {
    for fixture in fixtures {
        let chunks: Vec<Result<Bytes, std::io::Error>> = fixture
            .data
            .chunks(256 * KIB as usize)
            .map(|chunk| Ok(Bytes::copy_from_slice(chunk)))
            .collect();
        let stream: ByteStream = Box::pin(futures::stream::iter(chunks));
        service
            .put_object(bucket, &fixture.path, stream, None, HashMap::new())
            .await
            .unwrap();
    }
}

async fn read_object(service: &ObjectStoreService, bucket: &str, key: &str) -> Vec<u8> {
    use futures::StreamExt;
    let mut object = service.get_object(bucket, key).await.unwrap();
    let mut data = Vec::new();
    while let Some(chunk) = object.stream.next().await {
        data.extend_from_slice(&chunk.unwrap());
    }
    data
}

async fn build(service: &ObjectStoreService, spec: &ZipJobSpec) -> ArchiveResult {
    build_archive(
        service,
        spec,
        &zip_settings(),
        CancellationToken::new(),
        Arc::new(ZipProgress::new()),
        None,
    )
    .await
    .unwrap()
}

fn assert_contents(archive: &[u8], fixtures: &[Fixture]) {
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(archive)).unwrap();
    assert_eq!(zip.len(), fixtures.len());
    for fixture in fixtures {
        let mut file = zip.by_name(&fixture.path).unwrap();
        let mut data = Vec::with_capacity(fixture.data.len());
        file.read_to_end(&mut data).unwrap();
        assert!(data == fixture.data, "{} differs", fixture.path);
    }
}

async fn local_reference(fixtures: &[Fixture]) -> ArchiveResult {
    let harness = Harness::new().await;
    upload_fixtures(&harness.service, SOURCE_BUCKET, fixtures).await;
    build(
        &harness.service,
        &archive_spec(SOURCE_BUCKET, ARCHIVE_BUCKET, fixtures),
    )
    .await
}

async fn archive_on(label: &str, backend: Arc<dyn Backend>) {
    backend.init().await.unwrap();
    let metadata = Arc::new(MetadataStore::new(backend.clone()).await.unwrap());
    let service = ObjectStoreService::new(backend, metadata);

    let run = suffix();
    let source_bucket = format!("zip-src-{run}");
    let archive_bucket = format!("zip-out-{run}");
    service.create_bucket(&source_bucket).await.unwrap();
    service.create_bucket(&archive_bucket).await.unwrap();

    let fixtures = fixtures();
    upload_fixtures(&service, &source_bucket, &fixtures).await;
    let spec = archive_spec(&source_bucket, &archive_bucket, &fixtures);

    let started = std::time::Instant::now();
    let result = build(&service, &spec).await;
    let seconds = started.elapsed().as_secs_f64();

    let archive = read_object(&service, &archive_bucket, &spec.destination.key).await;
    assert_eq!(archive.len() as u64, result.size);
    assert_eq!(hex::encode(Sha256::digest(&archive)), result.sha256);
    assert_contents(&archive, &fixtures);

    let again = build(&service, &spec).await;
    assert_eq!(again.sha256, result.sha256);

    let reference = local_reference(&fixtures).await;
    assert_eq!(
        result.sha256, reference.sha256,
        "{label} differs from local storage"
    );

    let input: usize = fixtures.iter().map(|fixture| fixture.data.len()).sum();
    println!(
        "{label}: {} entries, {:.1} MiB in, {:.1} MiB archive in {:.2} s, sha256 {}",
        fixtures.len(),
        input as f64 / MIB as f64,
        result.size as f64 / MIB as f64,
        seconds,
        result.sha256
    );
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

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn builds_archives_on_s3() {
    let Some(endpoint) = env("OBJECT_STORE_TEST_S3_ENDPOINT") else {
        skip("builds_archives_on_s3", "OBJECT_STORE_TEST_S3_ENDPOINT");
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
    .unwrap()
    .with_uploader(uploader());

    archive_on("s3", Arc::new(backend)).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn builds_archives_on_azure() {
    let Some(connection_string) = env("OBJECT_STORE_TEST_AZURE_CONNECTION_STRING") else {
        skip(
            "builds_archives_on_azure",
            "OBJECT_STORE_TEST_AZURE_CONNECTION_STRING",
        );
        return;
    };
    let container =
        env("OBJECT_STORE_TEST_AZURE_CONTAINER").unwrap_or_else(|| "conformance".to_string());
    let backend = AzureBackend::new_from_connection_string(connection_string, container)
        .unwrap()
        .with_uploader(uploader());

    archive_on("azure", Arc::new(backend)).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn builds_archives_on_gcs() {
    let Some(endpoint) = env("OBJECT_STORE_TEST_GCS_ENDPOINT") else {
        skip("builds_archives_on_gcs", "OBJECT_STORE_TEST_GCS_ENDPOINT");
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

    archive_on("gcs", Arc::new(backend)).await;
}
