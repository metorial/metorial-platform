//! End-to-end tests of the zip pipeline over the local backend and generated sources.
//!
//! The multi-GiB tests are ignored by default; run them in release mode:
//! `cargo test --release -p object-store --test zip_pipeline -- --ignored --nocapture`

mod pipeline_support;
mod zip_support;

use std::collections::HashSet;
use std::io::{Cursor, Read};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures::FutureExt;
use object_store::zip::{
    build_archive, deflate_block, plan_entry_names, ArchiveResult, CommitCheck, CompressionHint,
    ZipErrorCode, ZipJobError, ZipJobSpec, ZipProgress, ZipSettings, DEFLATE_BLOCK_BYTES,
};
use object_store_backends::{UploadLimits, UploadSettings};
use pipeline_support::*;
use tokio_util::sync::CancellationToken;
use zip_support::tools::{check_all_tools, Expected};

const FOUR_GIB_PLUS_ONE: u64 = (4 << 30) + 1;
const FLAG_DATA_DESCRIPTOR: u16 = 1 << 3;
const METHOD_STORED: u16 = 0;
const METHOD_DEFLATE: u16 = 8;

async fn build(
    harness: &Harness,
    spec: &ZipJobSpec,
    settings: &ZipSettings,
) -> Result<ArchiveResult, ZipJobError> {
    build_archive(
        &harness.service,
        spec,
        settings,
        CancellationToken::new(),
        Arc::new(ZipProgress::new()),
        None,
    )
    .await
}

fn u16_at(bytes: &[u8], at: usize) -> u16 {
    u16::from_le_bytes(bytes[at..at + 2].try_into().unwrap())
}

fn u32_at(bytes: &[u8], at: usize) -> u32 {
    u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap())
}

fn u64_at(bytes: &[u8], at: usize) -> u64 {
    u64::from_le_bytes(bytes[at..at + 8].try_into().unwrap())
}

/// The central directory of an archive without a comment.
fn central_directory(bytes: &[u8]) -> zip_support::Trailer {
    let end = bytes.len() - 22;
    assert_eq!(u32_at(bytes, end), 0x0605_4b50);
    let mut offset = u32_at(bytes, end + 16) as u64;

    if offset == 0xFFFF_FFFF || u16_at(bytes, end + 10) == 0xFFFF {
        let locator = end - 20;
        assert_eq!(u32_at(bytes, locator), 0x0706_4b50);
        let zip64_end = u64_at(bytes, locator + 8) as usize;
        assert_eq!(u32_at(bytes, zip64_end), 0x0606_4b50);
        offset = u64_at(bytes, zip64_end + 48);
    }

    zip_support::parse_trailer(&bytes[offset as usize..], offset)
}

/// Archive order and names for `requested` paths, as the pipeline must produce them.
fn planned_names(requested: &[&str]) -> Vec<(String, String)> {
    let mut sorted: Vec<&str> = requested.to_vec();
    sorted.sort();
    let planned = plan_entry_names(sorted.iter().copied()).unwrap();
    sorted
        .into_iter()
        .zip(planned)
        .map(|(path, name)| (path.to_string(), name.archive_path))
        .collect()
}

/// Checks every entry's name and bytes with the zip crate.
fn assert_contents(archive: &[u8], expected: &[(String, Vec<u8>)]) {
    let mut zip = zip::ZipArchive::new(Cursor::new(archive)).unwrap();
    assert_eq!(zip.len(), expected.len());

    for (index, (name, data)) in expected.iter().enumerate() {
        let mut file = zip.by_index(index).unwrap();
        assert_eq!(file.name().unwrap(), name.as_str());
        let mut read = Vec::new();
        file.read_to_end(&mut read).unwrap();
        assert!(read == *data, "{name}: content differs");
    }
}

fn sha256(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(data))
}

fn with_compression(
    mut entry: object_store::zip::ZipEntrySpec,
    hint: CompressionHint,
) -> object_store::zip::ZipEntrySpec {
    entry.compression = hint;
    entry
}

struct Fixture {
    path: &'static str,
    data: Vec<u8>,
    hint: CompressionHint,
    with_crc: bool,
}

fn text(len: usize, seed: u64) -> Vec<u8> {
    generated_bytes(Content::Text, seed, len as u64)
}

fn random(len: usize, seed: u64) -> Vec<u8> {
    generated_bytes(Content::Random, seed, len as u64)
}

fn mixed_fixtures() -> Vec<Fixture> {
    let fixture = |path, data, hint, with_crc| Fixture {
        path,
        data,
        hint,
        with_crc,
    };
    use CompressionHint::{Auto, Deflate, Store};

    let mut fixtures = vec![
        fixture("docs/README.md", text(5_000, 1), Auto, false),
        fixture("docs/readme.md", text(700, 2), Auto, false),
        fixture("docs/what?.md", text(300, 3), Auto, false),
        fixture("CON", b"device name\n".to_vec(), Auto, false),
        fixture(
            "日本語/ファイル.txt",
            "こんにちは\n".repeat(50).into_bytes(),
            Auto,
            false,
        ),
        fixture("nested/a/b/c/d/e.txt", text(2_000, 4), Auto, false),
        fixture("empty.txt", Vec::new(), Auto, false),
        fixture("image.png", text(40_000, 5), Auto, false),
        fixture("bundle.zip", random(30_000, 6), Auto, false),
        fixture("random.bin", random(20_000, 7), Auto, false),
        fixture("a\\b.txt", b"backslash\n".to_vec(), Auto, false),
        fixture("trailing.", b"dot\n".to_vec(), Auto, false),
        fixture("tiny.txt", b"x".to_vec(), Auto, false),
        fixture("forced/stored.txt", text(10_000, 8), Store, false),
        fixture("forced/deflated.bin", random(10_000, 9), Deflate, false),
        fixture("small-with-crc.txt", text(3_000, 10), Auto, true),
        fixture("big/text.log", text(3 * MIB as usize + 11, 11), Auto, false),
        fixture(
            "big/random.bin",
            random(2 * MIB as usize + 17, 12),
            Auto,
            false,
        ),
        fixture(
            "big/forced.bin",
            random(MIB as usize + MIB as usize / 2, 13),
            Deflate,
            false,
        ),
        fixture(
            "big/with-crc.bin",
            random(2 * MIB as usize, 14),
            Store,
            true,
        ),
        fixture(
            "big/deflate-with-crc.log",
            text(MIB as usize + 5, 15),
            Deflate,
            true,
        ),
        fixture("big/zeros.dat", vec![0; 5 * MIB as usize], Auto, false),
        fixture("big/movie.mp4", text(2 * MIB as usize, 16), Auto, false),
    ];

    for index in 0..20 {
        fixtures.push(fixture(
            Box::leak(format!("many/file-{index:02}.md").into_boxed_str()),
            text(100 + index * 37, 100 + index as u64),
            Auto,
            false,
        ));
    }
    fixtures
}

fn large_entry_settings() -> ZipSettings {
    ZipSettings {
        small_entry_bytes: 64 * KIB,
        ..zip_settings()
    }
}

async fn store_fixtures(harness: &Harness, fixtures: &[Fixture]) -> ZipJobSpec {
    let mut entries = Vec::new();
    for (index, fixture) in fixtures.iter().enumerate() {
        let key = format!("store/{index:04}");
        harness.put(SOURCE_BUCKET, &key, fixture.data.clone()).await;

        let mut entry = with_compression(entry(fixture.path, SOURCE_BUCKET, &key), fixture.hint);
        if fixture.with_crc {
            entry.crc32 = Some(crc32fast::hash(&fixture.data));
            entry.size = Some(fixture.data.len() as u64);
        }
        entries.push(entry);
    }
    spec(ARCHIVE_BUCKET, "exports/mixed.zip", entries)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn round_trips_mixed_entries_through_every_tool() {
    let harness = Harness::new().await;
    let fixtures = mixed_fixtures();
    let spec = store_fixtures(&harness, &fixtures).await;

    let result = build(&harness, &spec, &large_entry_settings())
        .await
        .unwrap();
    let archive = harness.read(ARCHIVE_BUCKET, "exports/mixed.zip").await;
    assert_eq!(result.size, archive.len() as u64);
    assert_eq!(result.sha256, sha256(&archive));

    let requested: Vec<&str> = fixtures.iter().map(|fixture| fixture.path).collect();
    let names = planned_names(&requested);
    let by_path = |path: &str| &fixtures.iter().find(|f| f.path == path).unwrap().data;

    let expected: Vec<(String, Vec<u8>)> = names
        .iter()
        .map(|(path, name)| (name.clone(), by_path(path).clone()))
        .collect();
    assert_contents(&archive, &expected);

    let renamed: Vec<(String, String)> = result
        .renamed_entries
        .iter()
        .map(|entry| (entry.path.clone(), entry.archive_path.clone()))
        .collect();
    let expected_renamed: Vec<(String, String)> = names
        .iter()
        .filter(|(path, name)| path != name)
        .cloned()
        .collect();
    assert_eq!(renamed, expected_renamed);
    for (path, name) in [
        ("docs/readme.md", "docs/readme~2.md"),
        ("docs/what?.md", "docs/what_.md"),
        ("CON", "CON_"),
        ("a\\b.txt", "a_b.txt"),
        ("trailing.", "trailing_"),
    ] {
        assert!(
            renamed.contains(&(path.to_string(), name.to_string())),
            "{path} -> {name} missing from {renamed:?}"
        );
    }

    let directory = zip_support::temp_dir();
    let path = directory.path().join("mixed.zip");
    std::fs::write(&path, &archive).unwrap();
    let tool_expectations: Vec<Expected> = expected
        .iter()
        .map(|(name, data)| Expected {
            path: name.clone(),
            size: data.len() as u64,
            crc32: crc32fast::hash(data),
        })
        .collect();
    check_all_tools(&path, &tool_expectations);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn chooses_compression_per_entry() {
    let harness = Harness::new().await;
    let fixtures = mixed_fixtures();
    let spec = store_fixtures(&harness, &fixtures).await;
    build(&harness, &spec, &large_entry_settings())
        .await
        .unwrap();

    let archive = harness.read(ARCHIVE_BUCKET, "exports/mixed.zip").await;
    let records = central_directory(&archive).records;
    let record = |name: &str| {
        records
            .iter()
            .find(|record| record.path == name)
            .unwrap_or_else(|| panic!("{name} missing"))
    };

    for (name, method, descriptor) in [
        ("docs/README.md", METHOD_DEFLATE, false),
        ("random.bin", METHOD_STORED, false),
        ("image.png", METHOD_STORED, false),
        ("bundle.zip", METHOD_STORED, false),
        ("empty.txt", METHOD_STORED, false),
        ("tiny.txt", METHOD_STORED, false),
        ("forced/stored.txt", METHOD_STORED, false),
        ("forced/deflated.bin", METHOD_DEFLATE, false),
        ("small-with-crc.txt", METHOD_DEFLATE, false),
        ("big/text.log", METHOD_DEFLATE, true),
        ("big/random.bin", METHOD_STORED, true),
        ("big/forced.bin", METHOD_DEFLATE, true),
        ("big/with-crc.bin", METHOD_STORED, false),
        ("big/deflate-with-crc.log", METHOD_DEFLATE, true),
        ("big/zeros.dat", METHOD_DEFLATE, true),
        ("big/movie.mp4", METHOD_STORED, true),
    ] {
        let record = record(name);
        assert_eq!(record.method, method, "{name} method");
        assert_eq!(
            record.flags & FLAG_DATA_DESCRIPTOR != 0,
            descriptor,
            "{name} data descriptor"
        );
    }

    let requested: Vec<&str> = fixtures.iter().map(|fixture| fixture.path).collect();
    let names = planned_names(&requested);
    for fixture in fixtures
        .iter()
        .filter(|f| f.hint == CompressionHint::Auto && f.data.len() as u64 <= 64 * KIB)
    {
        let name = &names
            .iter()
            .find(|(path, _)| path == fixture.path)
            .unwrap()
            .1;
        let record = record(name);
        assert!(
            record.compressed_size <= record.uncompressed_size,
            "{name}: {} > {}",
            record.compressed_size,
            record.uncompressed_size
        );
    }

    assert!(record("big/zeros.dat").compressed_size < 100 * KIB);
    assert!(record("forced/deflated.bin").compressed_size > 10_000);
}

/// Generated sources with mixed sizes and content, totalling about 20 MiB.
fn generated_sources(harness: &Harness, chunk: usize) -> Vec<object_store::zip::ZipEntrySpec> {
    let mut entries = Vec::new();
    for index in 0..40u64 {
        let (content, size) = match index % 5 {
            0 => (Content::Text, 3 * MIB / 2 + index * 1_000),
            1 => (Content::Random, 600 * KIB + index),
            2 => (Content::Text, 40 * KIB + index * 3),
            3 => (Content::Zeros, 2 * MIB + 1),
            _ => (Content::Random, MIB + 1),
        };
        let key = format!("det/{index:03}");
        harness.add_generated(&key, Synthetic::new(content, index, size).chunk(chunk));
        let mut entry = entry(
            &format!("d{}/entry-{index:03}.bin", index % 3),
            GENERATED_BUCKET,
            &key,
        );
        if index % 7 == 0 {
            entry.compression = CompressionHint::Store;
        }
        entries.push(entry);
    }
    entries
}

/// The data of a large Deflate entry: its `DEFLATE_BLOCK_BYTES` blocks compressed one by one,
/// then the rest (empty for a multiple of the block size) as the last block.
fn deflated_in_blocks(data: &[u8]) -> Vec<u8> {
    let full = data.len() / DEFLATE_BLOCK_BYTES;
    let mut out = Vec::new();
    for block in data.chunks(DEFLATE_BLOCK_BYTES).take(full) {
        out.extend(deflate_block(6, block, false).unwrap());
    }
    out.extend(deflate_block(6, &data[full * DEFLATE_BLOCK_BYTES..], true).unwrap());
    out
}

fn entry_data<'a>(archive: &'a [u8], record: &zip_support::CentralRecord) -> &'a [u8] {
    let header = record.local_header_offset as usize;
    let start =
        header + 30 + u16_at(archive, header + 26) as usize + u16_at(archive, header + 28) as usize;
    &archive[start..start + record.compressed_size as usize]
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn deflates_large_entries_in_independent_blocks_that_every_tool_reads() {
    let block = DEFLATE_BLOCK_BYTES as u64;
    let sources = [
        ("blocks/a-one-block.txt", Content::Prose, block),
        ("blocks/b-one-block-plus-one.txt", Content::Prose, block + 1),
        (
            "blocks/c-one-block-minus-one.txt",
            Content::Prose,
            block - 1,
        ),
        ("blocks/d-three-blocks.txt", Content::Text, 3 * block),
        ("blocks/e-random.bin", Content::Random, 2 * block + 5),
        ("blocks/f-zeros.bin", Content::Zeros, 2 * block),
        ("blocks/g-just-large.txt", Content::Prose, 64 * KIB + 1),
    ];
    let settings = |compression_parallelism| ZipSettings {
        compression_parallelism,
        ..large_entry_settings()
    };

    let mut archives = Vec::new();
    for (chunk, parallelism) in [(100_003, Some(1)), (MIB as usize, Some(4)), (4_096, None)] {
        let harness = Harness::new().await;
        let mut entries = Vec::new();
        for (index, (path, content, size)) in sources.iter().enumerate() {
            let key = format!("blocks/{index}");
            harness.add_generated(
                &key,
                Synthetic::new(*content, index as u64, *size).chunk(chunk),
            );
            entries.push(with_compression(
                entry(path, GENERATED_BUCKET, &key),
                CompressionHint::Deflate,
            ));
        }
        let spec = spec(ARCHIVE_BUCKET, "exports/blocks.zip", entries);
        let result = build(&harness, &spec, &settings(parallelism))
            .await
            .unwrap();
        let archive = harness.read(ARCHIVE_BUCKET, "exports/blocks.zip").await;
        assert_eq!(result.sha256, sha256(&archive));
        archives.push(archive);
    }
    assert!(archives.iter().all(|archive| *archive == archives[0]));
    let archive = &archives[0];

    let records = central_directory(archive).records;
    let mut expected = Vec::new();
    for ((path, content, size), record) in sources.iter().zip(&records) {
        let data = generated_bytes(*content, expected.len() as u64, *size);
        assert_eq!(record.path, *path);
        assert_eq!(record.method, METHOD_DEFLATE, "{path}");
        assert_ne!(record.flags & FLAG_DATA_DESCRIPTOR, 0, "{path}");
        assert!(
            entry_data(archive, record) == deflated_in_blocks(&data),
            "{path}: not the concatenation of its blocks"
        );
        expected.push(Expected {
            path: path.to_string(),
            size: *size,
            crc32: crc32fast::hash(&data),
        });
    }

    let one_block = entry_data(archive, &records[0]);
    assert_eq!(
        &one_block[one_block.len() - 6..],
        &[0x00, 0x00, 0xff, 0xff, 0x03, 0x00],
        "a sync flush, then an empty last block"
    );

    let directory = zip_support::temp_dir();
    let path = directory.path().join("blocks.zip");
    std::fs::write(&path, archive).unwrap();
    check_all_tools(&path, &expected);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn output_is_identical_across_order_concurrency_chunking_and_part_sizes() {
    struct Variant {
        fetch_concurrency: usize,
        compression_parallelism: Option<usize>,
        source_chunk: usize,
        min_part_size: u64,
        limits: UploadLimits,
        to_local: bool,
        order: fn(&mut Vec<object_store::zip::ZipEntrySpec>),
    }

    let variants = [
        Variant {
            fetch_concurrency: 1,
            compression_parallelism: Some(1),
            source_chunk: 64 * KIB as usize,
            min_part_size: 5 * MIB,
            limits: S3_LIKE,
            to_local: false,
            order: |_| {},
        },
        Variant {
            fetch_concurrency: 4,
            compression_parallelism: Some(3),
            source_chunk: 4_099,
            min_part_size: 6 * MIB + 3,
            limits: S3_LIKE,
            to_local: false,
            order: |entries| entries.reverse(),
        },
        Variant {
            fetch_concurrency: 32,
            compression_parallelism: None,
            source_chunk: MIB as usize + 3,
            min_part_size: 7 * MIB,
            limits: local_limits(),
            to_local: true,
            order: |entries| {
                let len = entries.len();
                for index in 0..len {
                    entries.swap(index, (index * 17 + 5) % len);
                }
            },
        },
    ];

    let mut hashes = HashSet::new();
    for variant in variants {
        let harness = Harness::with(
            UploadSettings {
                min_part_size: variant.min_part_size,
                ..upload_settings()
            },
            variant.limits,
        )
        .await;
        let mut entries = generated_sources(&harness, variant.source_chunk);
        (variant.order)(&mut entries);

        let (bucket, key) = if variant.to_local {
            (ARCHIVE_BUCKET, "exports/det.zip")
        } else {
            (SINK_BUCKET, "det.zip")
        };
        let spec = spec(bucket, key, entries);
        let settings = ZipSettings {
            fetch_concurrency: variant.fetch_concurrency,
            compression_parallelism: variant.compression_parallelism,
            ..zip_settings()
        };

        let result = build(&harness, &spec, &settings).await.unwrap();
        let calls = harness.calls();
        assert!(calls.upload_part >= 2, "{calls:?}");
        println!(
            "fetch {} compress {:?} chunk {} min part {}: {} bytes in {} parts, sha256 {}",
            variant.fetch_concurrency,
            variant.compression_parallelism,
            variant.source_chunk,
            variant.min_part_size,
            result.size,
            calls.upload_part,
            result.sha256
        );

        if variant.to_local {
            let archive = harness.read(bucket, key).await;
            assert_eq!(sha256(&archive), result.sha256);
            let records = central_directory(&archive).records;
            assert_eq!(records.len(), 40);
        } else {
            assert_eq!(
                harness
                    .backend
                    .sink_object(&format!("{bucket}/{key}"))
                    .unwrap()
                    .size,
                result.size
            );
        }
        hashes.insert((result.size, result.sha256));
    }

    assert_eq!(hashes.len(), 1, "{hashes:?}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn the_same_spec_twice_writes_identical_bytes() {
    let harness = Harness::new().await;
    let fixtures = mixed_fixtures();
    let spec = store_fixtures(&harness, &fixtures).await;

    let first = build(&harness, &spec, &large_entry_settings())
        .await
        .unwrap();
    let first_bytes = harness.read(ARCHIVE_BUCKET, "exports/mixed.zip").await;
    let second = build(&harness, &spec, &large_entry_settings())
        .await
        .unwrap();
    let second_bytes = harness.read(ARCHIVE_BUCKET, "exports/mixed.zip").await;

    assert_eq!(first.sha256, second.sha256);
    assert!(first_bytes == second_bytes);
    assert_eq!(spec.spec_hash(), spec.clone().spec_hash());
}

fn resumable_spec(harness: &Harness, failures: &[(u64, &[u64])]) -> ZipJobSpec {
    let sources = [
        ("large.log", Content::Text, 3 * MIB + 7),
        ("large.bin", Content::Random, 2 * MIB + 9),
        ("small.txt", Content::Text, 200 * KIB),
    ];
    let mut entries = Vec::new();
    for (index, (name, content, size)) in sources.into_iter().enumerate() {
        let key = format!("resume/{name}");
        let offsets = failures
            .iter()
            .find(|(source, _)| *source == index as u64)
            .map(|(_, offsets)| *offsets)
            .unwrap_or(&[]);
        harness.add_generated(
            &key,
            Synthetic::new(content, index as u64, size)
                .chunk(50_000)
                .failing_at(offsets),
        );
        entries.push(entry(name, GENERATED_BUCKET, &key));
    }
    spec(ARCHIVE_BUCKET, "exports/resume.zip", entries)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn resumes_sources_that_fail_mid_stream() {
    let clean = Harness::new().await;
    let reference = build(&clean, &resumable_spec(&clean, &[]), &zip_settings())
        .await
        .unwrap();

    let flaky = Harness::new().await;
    let spec = resumable_spec(
        &flaky,
        &[
            (0, &[1, 100_000, 2 * MIB + 3, 3 * MIB]),
            (1, &[MIB, MIB + 1]),
            (2, &[150_000]),
        ],
    );
    let result = build(&flaky, &spec, &zip_settings()).await.unwrap();
    let calls = flaky.calls();
    assert_eq!(calls.get, 3);
    assert_eq!(calls.get_range, 7, "{calls:?}");

    assert_eq!(result.sha256, reference.sha256);
    assert_eq!(result.size, reference.size);
    assert_eq!(
        sha256(&flaky.read(ARCHIVE_BUCKET, "exports/resume.zip").await),
        reference.sha256
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn gives_up_after_too_many_reconnects() {
    for size in [3 * MIB, 100 * KIB] {
        let harness = Harness::new().await;
        let mut source = Synthetic::new(Content::Text, 1, size);
        source.fail_every_connection_after = Some(10_000);
        harness.add_generated("flaky", source);

        let error = build(
            &harness,
            &spec(
                ARCHIVE_BUCKET,
                "exports/flaky.zip",
                vec![entry("flaky.txt", GENERATED_BUCKET, "flaky")],
            ),
            &zip_settings(),
        )
        .await
        .unwrap_err();

        assert_eq!(error.code, ZipErrorCode::BackendError, "{error}");
        assert!(error.retryable);
        assert_eq!(harness.calls().get_range, 5);
        assert!(!harness.exists(ARCHIVE_BUCKET, "exports/flaky.zip").await);
    }
}

type SourceChange = fn(&mut Synthetic);

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn detects_sources_that_change() {
    for size in [12 * MIB, 300 * KIB] {
        let wrapper = |configure: SourceChange| configure;
        let cases: Vec<(&str, SourceChange)> = vec![
            (
                "etag changed between HEAD and GET",
                wrapper(|s| s.get_etag = Some("other".into())),
            ),
            (
                "etag changed on reconnect",
                wrapper(|s| {
                    s.failures = [s.size / 2].into();
                    s.etag_from_connection = Some((1, "other".into()));
                }),
            ),
            (
                "longer than HEAD",
                wrapper(|s| s.served_len = Some(s.size + 10)),
            ),
            (
                "shorter than HEAD",
                wrapper(|s| s.served_len = Some(s.size - 10)),
            ),
            (
                "GET reports another size",
                wrapper(|s| s.get_size = Some(s.size + 1)),
            ),
        ];

        for (name, configure) in cases {
            println!("{name} ({size} bytes)");
            let calls = fails_with_first(configure, size, ZipErrorCode::SourceChanged).await;
            if size > 8 * MIB {
                assert_eq!(calls.complete, 0, "{name}: {calls:?}");
            }
            assert_eq!(calls.put_single, 0, "{name}: {calls:?}");
        }
    }
}

async fn fails_with_first(
    configure: fn(&mut Synthetic),
    size: u64,
    expected: ZipErrorCode,
) -> CallCounts {
    let harness = Harness::new().await;
    harness.add_generated("first", Synthetic::new(Content::Text, 9, 1_000));
    let mut source = Synthetic::new(Content::Random, 3, size);
    configure(&mut source);
    harness.add_generated("source", source);
    harness
        .put(ARCHIVE_BUCKET, "exports/out.zip", b"previous".to_vec())
        .await;
    harness.backend.calls.reset();

    let error = build(
        &harness,
        &spec(
            ARCHIVE_BUCKET,
            "exports/out.zip",
            vec![
                entry("a-first.txt", GENERATED_BUCKET, "first"),
                entry("source.bin", GENERATED_BUCKET, "source"),
            ],
        ),
        &zip_settings(),
    )
    .await
    .unwrap_err();

    assert_eq!(error.code, expected, "{error}");
    assert!(!error.retryable);
    assert_eq!(
        harness.read(ARCHIVE_BUCKET, "exports/out.zip").await,
        b"previous",
        "the existing archive must be left alone"
    );
    assert_no_temp_uploads(&harness);
    harness.calls()
}

fn assert_no_temp_uploads(harness: &Harness) {
    let uploads = harness.root().join(".uploads");
    let leftover: Vec<_> = std::fs::read_dir(&uploads)
        .map(|entries| entries.map(|entry| entry.unwrap().path()).collect())
        .unwrap_or_default();
    assert!(leftover.is_empty(), "temporary uploads left: {leftover:?}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn rejects_a_size_that_disagrees_with_the_spec_before_reading() {
    let harness = Harness::new().await;
    harness.add_generated("source", Synthetic::new(Content::Text, 1, 1_000));

    let mut sized = entry("a.txt", GENERATED_BUCKET, "source");
    sized.size = Some(999);
    let error = build(
        &harness,
        &spec(ARCHIVE_BUCKET, "exports/x.zip", vec![sized]),
        &zip_settings(),
    )
    .await
    .unwrap_err();

    assert_eq!(error.code, ZipErrorCode::SourceChanged);
    let calls = harness.calls();
    assert_eq!((calls.head, calls.get, calls.put_single), (1, 0, 0));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn rejects_data_that_does_not_match_the_callers_crc() {
    let cases = [
        ("small", Content::Text, 200 * KIB, CompressionHint::Auto),
        (
            "large stored",
            Content::Random,
            12 * MIB,
            CompressionHint::Store,
        ),
        (
            "large deflated",
            Content::Random,
            12 * MIB,
            CompressionHint::Deflate,
        ),
        (
            "large sampled",
            Content::Text,
            3 * MIB,
            CompressionHint::Auto,
        ),
    ];

    for (name, content, size, hint) in cases {
        let harness = Harness::new().await;
        let source = Synthetic::new(content, 5, size);
        let (_, crc32) = source.digest();
        harness.add_generated("source", source);
        harness
            .put(ARCHIVE_BUCKET, "exports/crc.zip", b"previous".to_vec())
            .await;
        harness.backend.calls.reset();

        let mut wrong = with_compression(entry("data.txt", GENERATED_BUCKET, "source"), hint);
        wrong.crc32 = Some(crc32 ^ 1);
        wrong.size = Some(size);
        let error = build(
            &harness,
            &spec(ARCHIVE_BUCKET, "exports/crc.zip", vec![wrong.clone()]),
            &zip_settings(),
        )
        .await
        .unwrap_err();

        assert_eq!(error.code, ZipErrorCode::CrcMismatch, "{name}: {error}");
        assert!(!error.retryable);
        let calls = harness.calls();
        assert_eq!(calls.complete + calls.put_single, 0, "{name}: {calls:?}");
        if size > 8 * MIB {
            assert_eq!(calls.start_multipart, 1, "{name}");
            assert_eq!(calls.abort, 1, "{name}");
        }
        assert_eq!(
            harness.read(ARCHIVE_BUCKET, "exports/crc.zip").await,
            b"previous"
        );
        assert_no_temp_uploads(&harness);

        let mut right = wrong;
        right.crc32 = Some(crc32);
        build(
            &harness,
            &spec(ARCHIVE_BUCKET, "exports/crc.zip", vec![right]),
            &zip_settings(),
        )
        .await
        .unwrap_or_else(|error| panic!("{name}: {error}"));
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn reports_missing_sources_and_buckets() {
    let harness = Harness::new().await;
    harness
        .put(SOURCE_BUCKET, "present", b"here".to_vec())
        .await;
    harness.backend.calls.reset();

    let missing_key = spec(
        ARCHIVE_BUCKET,
        "exports/x.zip",
        vec![
            entry("a.txt", SOURCE_BUCKET, "present"),
            entry("b.txt", SOURCE_BUCKET, "absent"),
        ],
    );
    let error = build(&harness, &missing_key, &zip_settings())
        .await
        .unwrap_err();
    assert_eq!(error.code, ZipErrorCode::SourceNotFound, "{error}");
    assert!(error.message.contains("absent"), "{error}");

    let missing_bucket = spec(
        ARCHIVE_BUCKET,
        "exports/x.zip",
        vec![entry("a.txt", "no-such-bucket", "present")],
    );
    let error = build(&harness, &missing_bucket, &zip_settings())
        .await
        .unwrap_err();
    assert_eq!(error.code, ZipErrorCode::SourceNotFound, "{error}");

    let missing_destination = spec(
        "no-such-bucket",
        "x.zip",
        vec![entry("a.txt", SOURCE_BUCKET, "present")],
    );
    let error = build(&harness, &missing_destination, &zip_settings())
        .await
        .unwrap_err();
    assert_eq!(error.code, ZipErrorCode::InvalidSpec, "{error}");

    let calls = harness.calls();
    assert_eq!(calls.put_single + calls.start_multipart, 0, "{calls:?}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn rejects_invalid_specs_before_touching_storage() {
    let harness = Harness::new().await;
    let one = || vec![entry("a.txt", SOURCE_BUCKET, "k")];
    let settings = ZipSettings {
        max_entries: 3,
        ..zip_settings()
    };

    let mut cases: Vec<(&str, ZipJobSpec, ZipErrorCode)> = vec![
        (
            "no entries",
            spec(ARCHIVE_BUCKET, "x.zip", vec![]),
            ZipErrorCode::InvalidSpec,
        ),
        (
            "too many entries",
            spec(
                ARCHIVE_BUCKET,
                "x.zip",
                (0..4)
                    .map(|i| entry(&format!("{i}"), SOURCE_BUCKET, "k"))
                    .collect(),
            ),
            ZipErrorCode::InvalidSpec,
        ),
        (
            "metadata destination",
            spec(ARCHIVE_BUCKET, ".metadata/buckets/x.json", one()),
            ZipErrorCode::InvalidSpec,
        ),
        (
            "bucket marker destination",
            spec(ARCHIVE_BUCKET, ".bucket", one()),
            ZipErrorCode::InvalidSpec,
        ),
        (
            "traversal destination",
            spec(ARCHIVE_BUCKET, "../x.zip", one()),
            ZipErrorCode::InvalidSpec,
        ),
        (
            "destination is a source",
            spec(SOURCE_BUCKET, "k", one()),
            ZipErrorCode::InvalidSpec,
        ),
        (
            "absolute path",
            spec(
                ARCHIVE_BUCKET,
                "x.zip",
                vec![entry("/etc/passwd", SOURCE_BUCKET, "k")],
            ),
            ZipErrorCode::InvalidPath,
        ),
        (
            "dot segment",
            spec(
                ARCHIVE_BUCKET,
                "x.zip",
                vec![entry("a/../b", SOURCE_BUCKET, "k")],
            ),
            ZipErrorCode::InvalidPath,
        ),
        (
            "exact duplicate",
            spec(
                ARCHIVE_BUCKET,
                "x.zip",
                vec![
                    entry("same", SOURCE_BUCKET, "k"),
                    entry("same", SOURCE_BUCKET, "j"),
                ],
            ),
            ZipErrorCode::DuplicatePath,
        ),
    ];

    let mut level = spec(ARCHIVE_BUCKET, "x.zip", one());
    level.deflate_level = Some(10);
    cases.push(("deflate level", level, ZipErrorCode::InvalidSpec));

    let mut limit = spec(ARCHIVE_BUCKET, "x.zip", one());
    limit.max_archive_bytes = Some(settings.max_archive_bytes + 1);
    cases.push((
        "archive limit above the service's",
        limit,
        ZipErrorCode::InvalidSpec,
    ));

    for (name, spec, code) in cases {
        let error = build(&harness, &spec, &settings).await.unwrap_err();
        assert_eq!(error.code, code, "{name}: {error}");
        assert!(!error.retryable, "{name}");
        assert_eq!(spec.validate(&settings).unwrap_err().code, code, "{name}");
    }

    assert_eq!(harness.calls(), CallCounts::default());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn rejects_archives_over_the_limit_before_uploading() {
    let harness = Harness::new().await;
    harness.add_generated("text", Synthetic::new(Content::Text, 1, 2 * MIB));
    harness.add_generated("photo", Synthetic::new(Content::Random, 2, 10 * MIB));

    let mut text = spec(
        ARCHIVE_BUCKET,
        "exports/big.zip",
        vec![entry("text.txt", GENERATED_BUCKET, "text")],
    );
    text.max_archive_bytes = Some(2 * MIB + 1_000);
    let error = build(&harness, &text, &zip_settings()).await.unwrap_err();
    assert_eq!(error.code, ZipErrorCode::TooLarge, "{error}");

    let tight_service = ZipSettings {
        max_archive_bytes: MIB,
        ..zip_settings()
    };
    let mut unlimited = text.clone();
    unlimited.max_archive_bytes = None;
    let error = build(&harness, &unlimited, &tight_service)
        .await
        .unwrap_err();
    assert_eq!(error.code, ZipErrorCode::TooLarge, "{error}");

    let calls = harness.calls();
    assert_eq!(calls.head, 2);
    assert_eq!(
        (calls.get, calls.put_single, calls.start_multipart),
        (0, 0, 0),
        "{calls:?}"
    );
    assert!(!harness.exists(ARCHIVE_BUCKET, "exports/big.zip").await);

    let mut stored = spec(
        ARCHIVE_BUCKET,
        "exports/photo.zip",
        vec![entry("photo.jpg", GENERATED_BUCKET, "photo")],
    );
    stored.max_archive_bytes = Some(10 * MIB + 1_000);
    let result = build(&harness, &stored, &zip_settings()).await.unwrap();
    assert!(result.size <= 10 * MIB + 1_000);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn cancellation_aborts_the_upload_and_keeps_the_existing_archive() {
    let harness = Harness::new().await;
    let mut slow = Synthetic::new(Content::Random, 1, 64 * MIB);
    slow.chunk_delay = Duration::from_millis(2);
    harness.add_generated("slow", slow);
    harness
        .put(ARCHIVE_BUCKET, "exports/cancel.zip", b"previous".to_vec())
        .await;
    harness.backend.calls.reset();

    let spec = spec(
        ARCHIVE_BUCKET,
        "exports/cancel.zip",
        vec![entry("slow.bin", GENERATED_BUCKET, "slow")],
    );
    let cancel = CancellationToken::new();
    let progress = Arc::new(ZipProgress::new());
    let task = {
        let service = harness.service.clone();
        let (cancel, progress) = (cancel.clone(), progress.clone());
        tokio::spawn(async move {
            build_archive(&service, &spec, &zip_settings(), cancel, progress, None).await
        })
    };

    let started = Instant::now();
    while progress.snapshot().bytes_written < 20 * MIB {
        assert!(started.elapsed() < Duration::from_secs(60), "no progress");
        tokio::time::sleep(Duration::from_millis(5)).await;
    }
    assert!(harness.calls().upload_part >= 1);
    cancel.cancel();

    let error = task.await.unwrap().unwrap_err();
    assert_eq!(error.code, ZipErrorCode::Canceled);
    assert!(!error.retryable);

    let calls = harness.calls();
    assert_eq!(calls.start_multipart, 1);
    assert_eq!(calls.complete, 0);
    assert!(calls.abort >= 1);
    assert_eq!(
        harness.read(ARCHIVE_BUCKET, "exports/cancel.zip").await,
        b"previous"
    );
    assert_no_temp_uploads(&harness);
    assert!(progress.snapshot().entries_done < 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_canceled_token_stops_before_any_request() {
    let harness = Harness::new().await;
    let cancel = CancellationToken::new();
    cancel.cancel();

    let error = build_archive(
        &harness.service,
        &spec(
            ARCHIVE_BUCKET,
            "x.zip",
            vec![entry("a", SOURCE_BUCKET, "k")],
        ),
        &zip_settings(),
        cancel,
        Arc::new(ZipProgress::new()),
        None,
    )
    .await
    .unwrap_err();

    assert_eq!(error.code, ZipErrorCode::Canceled);
    assert_eq!(harness.calls(), CallCounts::default());
}

fn counting_check(
    calls: Arc<AtomicUsize>,
    verdict: Result<(), ZipJobError>,
) -> Option<CommitCheck> {
    Some(Box::new(move || {
        calls.fetch_add(1, Ordering::SeqCst);
        async move { verdict }.boxed()
    }))
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn the_commit_check_runs_once_and_can_veto() {
    for size in [100 * KIB, 12 * MIB] {
        let harness = Harness::new().await;
        harness.add_generated("data", Synthetic::new(Content::Random, 1, size));
        harness
            .put(ARCHIVE_BUCKET, "exports/commit.zip", b"previous".to_vec())
            .await;
        harness.backend.calls.reset();
        let spec = spec(
            ARCHIVE_BUCKET,
            "exports/commit.zip",
            vec![entry("data.bin", GENERATED_BUCKET, "data")],
        );

        let checks = Arc::new(AtomicUsize::new(0));
        let lease_lost = ZipJobError::new(ZipErrorCode::LeaseExpired, "lease taken over");
        let error = build_archive(
            &harness.service,
            &spec,
            &zip_settings(),
            CancellationToken::new(),
            Arc::new(ZipProgress::new()),
            counting_check(checks.clone(), Err(lease_lost.clone())),
        )
        .await
        .unwrap_err();

        assert_eq!(error, lease_lost);
        assert_eq!(checks.load(Ordering::SeqCst), 1);
        let calls = harness.calls();
        assert_eq!(calls.complete + calls.put_single, 0, "{calls:?}");
        if size > 8 * MIB {
            assert_eq!(calls.abort, 1);
        }
        assert_eq!(
            harness.read(ARCHIVE_BUCKET, "exports/commit.zip").await,
            b"previous"
        );
        assert_no_temp_uploads(&harness);

        let checks = Arc::new(AtomicUsize::new(0));
        let result = build_archive(
            &harness.service,
            &spec,
            &zip_settings(),
            CancellationToken::new(),
            Arc::new(ZipProgress::new()),
            counting_check(checks.clone(), Ok(())),
        )
        .await
        .unwrap();
        assert_eq!(checks.load(Ordering::SeqCst), 1);
        assert_eq!(
            sha256(&harness.read(ARCHIVE_BUCKET, "exports/commit.zip").await),
            result.sha256
        );
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_small_archive_costs_one_head_and_get_per_source_and_one_put() {
    let harness = Harness::new().await;
    for (key, data) in [("one", "first file\n"), ("two", "second\n"), ("three", "")] {
        harness
            .put(SOURCE_BUCKET, key, data.as_bytes().to_vec())
            .await;
    }
    harness.backend.calls.reset();

    let progress = Arc::new(ZipProgress::new());
    let spec = spec(
        ARCHIVE_BUCKET,
        "exports/small.zip",
        vec![
            entry("one.txt", SOURCE_BUCKET, "one"),
            entry("two.txt", SOURCE_BUCKET, "two"),
            entry("three.txt", SOURCE_BUCKET, "three"),
        ],
    );
    let result = build_archive(
        &harness.service,
        &spec,
        &zip_settings(),
        CancellationToken::new(),
        progress.clone(),
        None,
    )
    .await
    .unwrap();

    assert_eq!(
        harness.calls(),
        CallCounts {
            head: 3,
            get: 2,
            put_single: 1,
            ..CallCounts::default()
        },
        "the empty source needs no GET"
    );

    let progress = progress.snapshot();
    assert_eq!(progress.entries_total, 3);
    assert_eq!(progress.entries_done, 3);
    assert_eq!(progress.bytes_read, 18);
    assert_eq!(progress.bytes_written, result.size);
    assert!(progress.bytes_estimate >= result.size);
    assert!(result.renamed_entries.is_empty());

    let archive = harness.read(ARCHIVE_BUCKET, "exports/small.zip").await;
    assert_contents(
        &archive,
        &[
            ("one.txt".to_string(), b"first file\n".to_vec()),
            ("three.txt".to_string(), Vec::new()),
            ("two.txt".to_string(), b"second\n".to_vec()),
        ],
    );
    let object = harness
        .service
        .head_object(ARCHIVE_BUCKET, "exports/small.zip")
        .await
        .unwrap();
    assert_eq!(object.content_type.as_deref(), Some("application/zip"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
async fn seventy_thousand_entries_pass_external_tools() {
    let harness = Harness::new().await;
    let count = 70_000u64;
    let mut entries = Vec::new();
    let mut expected = Vec::new();
    for index in 0..count {
        let key = format!("many/{index:05}");
        let source = Synthetic::new(Content::Text, index, 20 + index % 200);
        let (size, crc32) = source.digest();
        harness.add_generated(&key, source);
        let path = format!("d{}/{index:05}.txt", index % 13);
        entries.push(entry(&path, GENERATED_BUCKET, &key));
        expected.push(Expected { path, size, crc32 });
    }
    expected.sort_by(|a, b| a.path.cmp(&b.path));

    let started = Instant::now();
    let result = build(
        &harness,
        &spec(ARCHIVE_BUCKET, "exports/many.zip", entries),
        &zip_settings(),
    )
    .await
    .unwrap();
    println!(
        "70,000 entries: {} bytes in {:.2} s",
        result.size,
        started.elapsed().as_secs_f64()
    );

    let calls = harness.calls();
    assert_eq!((calls.head, calls.get), (count, count));
    let archive = harness.read(ARCHIVE_BUCKET, "exports/many.zip").await;
    assert_eq!(central_directory(&archive).records.len(), count as usize);

    let directory = zip_support::temp_dir();
    let path = directory.path().join("many.zip");
    std::fs::write(&path, &archive).unwrap();
    check_all_tools(&path, &expected);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
#[ignore = "writes and extracts a 9 GiB archive; run with --release --ignored"]
async fn entries_over_four_gib_pass_external_tools() {
    let harness = Harness::with(upload_settings(), local_limits()).await;
    let sources = [
        (
            "a-first.txt",
            Content::Text,
            1_000u64,
            CompressionHint::Auto,
            false,
        ),
        (
            "huge/random.bin",
            Content::Random,
            FOUR_GIB_PLUS_ONE,
            CompressionHint::Auto,
            false,
        ),
        (
            "huge/known.bin",
            Content::Random,
            FOUR_GIB_PLUS_ONE,
            CompressionHint::Store,
            true,
        ),
        (
            "huge/text.log",
            Content::Text,
            FOUR_GIB_PLUS_ONE,
            CompressionHint::Deflate,
            false,
        ),
        (
            "z-after.txt",
            Content::Text,
            5_000,
            CompressionHint::Auto,
            false,
        ),
    ];

    let mut entries = Vec::new();
    let mut expected = Vec::new();
    for (index, (path, content, size, hint, with_crc)) in sources.into_iter().enumerate() {
        let source = Synthetic::new(content, index as u64, size).chunk(256 * KIB as usize);
        let (_, crc32) = source.digest();
        let key = format!("huge/{index}");
        harness.add_generated(&key, source);
        let mut entry = with_compression(entry(path, GENERATED_BUCKET, &key), hint);
        if with_crc {
            entry.crc32 = Some(crc32);
            entry.size = Some(size);
        }
        entries.push(entry);
        expected.push(Expected {
            path: path.to_string(),
            size,
            crc32,
        });
    }
    expected.sort_by(|a, b| a.path.cmp(&b.path));

    let started = Instant::now();
    let result = build(
        &harness,
        &spec(ARCHIVE_BUCKET, "exports/huge.zip", entries),
        &zip_settings(),
    )
    .await
    .unwrap();
    let seconds = started.elapsed().as_secs_f64();
    println!(
        "[huge] {} bytes ({:.2} GiB) from {:.2} GiB of sources in {:.1} s ({:.0} MiB/s of source)",
        result.size,
        result.size as f64 / GIB as f64,
        (3 * FOUR_GIB_PLUS_ONE) as f64 / GIB as f64,
        seconds,
        (3 * FOUR_GIB_PLUS_ONE) as f64 / MIB as f64 / seconds
    );
    assert!(result.size > 8 * GIB);

    let path = harness
        .root()
        .join("data")
        .join(ARCHIVE_BUCKET)
        .join("exports/huge.zip");
    assert_eq!(std::fs::metadata(&path).unwrap().len(), result.size);

    let records = {
        let file = std::fs::File::open(&path).unwrap();
        let len = file.metadata().unwrap().len();
        let tail_len = (1 << 20).min(len);
        let mut tail = vec![0; tail_len as usize];
        use std::io::{Seek, SeekFrom};
        let mut file = file;
        file.seek(SeekFrom::Start(len - tail_len)).unwrap();
        file.read_exact(&mut tail).unwrap();
        central_directory_at(&tail, len - tail_len).records
    };
    let known = records.iter().find(|r| r.path == "huge/known.bin").unwrap();
    assert_eq!(known.flags & FLAG_DATA_DESCRIPTOR, 0);
    assert_eq!(known.method, METHOD_STORED);
    let random = records
        .iter()
        .find(|r| r.path == "huge/random.bin")
        .unwrap();
    assert_eq!(random.method, METHOD_STORED);
    assert_ne!(random.flags & FLAG_DATA_DESCRIPTOR, 0);
    let text = records.iter().find(|r| r.path == "huge/text.log").unwrap();
    assert_eq!(text.method, METHOD_DEFLATE);
    let after = records.iter().find(|r| r.path == "z-after.txt").unwrap();
    assert!(after.local_header_offset > 8 * GIB);

    check_all_tools(&path, &expected);
}

/// Like `central_directory`, for the last `tail.len()` bytes of an archive starting at
/// `tail_offset`.
fn central_directory_at(tail: &[u8], tail_offset: u64) -> zip_support::Trailer {
    let end = tail.len() - 22;
    assert_eq!(u32_at(tail, end), 0x0605_4b50);
    let locator = end - 20;
    assert_eq!(u32_at(tail, locator), 0x0706_4b50);
    let zip64_end = (u64_at(tail, locator + 8) - tail_offset) as usize;
    assert_eq!(u32_at(tail, zip64_end), 0x0606_4b50);
    let offset = u64_at(tail, zip64_end + 48);
    zip_support::parse_trailer(&tail[(offset - tail_offset) as usize..], offset)
}
