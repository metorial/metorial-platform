//! Scale runs of the archive pipeline, each ignored by default; run them in release mode one at a
//! time, they measure the heap of the whole process:
//! `cargo test --release -p object-store --test zip_scale -- --ignored --nocapture --test-threads 1`

mod pipeline_support;

use std::alloc::{GlobalAlloc, Layout, System};
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;

use object_store::zip::{
    build_archive, build_archive_owned, ArchiveResult, CompressionHint, ZipJobSpec, ZipProgress,
};
use object_store_backends::{ByteStream, PutOptions, UploadSettings, Uploader};
use pipeline_support::*;
use tokio_util::sync::CancellationToken;

struct CountingAllocator;

static CURRENT: AtomicUsize = AtomicUsize::new(0);
static PEAK: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let ptr = unsafe { System.alloc(layout) };
        if !ptr.is_null() {
            let current = CURRENT.fetch_add(layout.size(), Ordering::Relaxed) + layout.size();
            PEAK.fetch_max(current, Ordering::Relaxed);
        }
        ptr
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) };
        CURRENT.fetch_sub(layout.size(), Ordering::Relaxed);
    }

    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        let new_ptr = unsafe { System.realloc(ptr, layout, new_size) };
        if !new_ptr.is_null() {
            if new_size >= layout.size() {
                let grown = new_size - layout.size();
                let current = CURRENT.fetch_add(grown, Ordering::Relaxed) + grown;
                PEAK.fetch_max(current, Ordering::Relaxed);
            } else {
                CURRENT.fetch_sub(layout.size() - new_size, Ordering::Relaxed);
            }
        }
        new_ptr
    }
}

#[global_allocator]
static ALLOCATOR: CountingAllocator = CountingAllocator;

const SMALL_ENTRY: u64 = 4 * KIB;
const RUNTIME_SLACK: u64 = 16 * MIB;

fn budget(bytes: u64) -> UploadSettings {
    UploadSettings {
        memory_budget_bytes: bytes,
        ..upload_settings()
    }
}

/// What `pipelines` concurrent pipelines hold besides their part buffers: each has queued and
/// coalescing archive chunks, the prefetch window of small entries (raw and compressed), a large
/// entry's sample and its trial compression, a record per entry for the plan and central
/// directory, and a large entry's Deflate blocks.
fn pipeline_overhead(pipelines: u64, entries: usize, bytes_per_entry: u64) -> u64 {
    let settings = zip_settings();
    let archive_chunks = 8 * settings.write_chunk_bytes as u64;
    let prefetch =
        settings.fetch_concurrency as u64 * SMALL_ENTRY.min(settings.small_entry_bytes) * 2;
    let sample = MIB;
    let pipeline = archive_chunks + prefetch + sample + entries as u64 * bytes_per_entry;
    pipelines * pipeline + deflate_heap_bound(&settings, pipelines)
}

fn add_large(
    harness: &Harness,
    entries: &mut Vec<object_store::zip::ZipEntrySpec>,
    name: &str,
    content: Content,
    seed: u64,
    size: u64,
) {
    let source = Synthetic::new(content, seed, size).chunk(MIB as usize);
    let mut spec = entry(name, GENERATED_BUCKET, name);
    if content == Content::Zeros {
        let (size, crc32) = source.digest();
        spec.compression = CompressionHint::Store;
        spec.size = Some(size);
        spec.crc32 = Some(crc32);
    }
    harness.add_generated(name, source);
    entries.push(spec);
}

fn add_small(
    harness: &Harness,
    entries: &mut Vec<object_store::zip::ZipEntrySpec>,
    prefix: &str,
    count: usize,
    size: u64,
) {
    for index in 0..count {
        let name = format!("{prefix}/{:03}/{index:07}.txt", index / 1000);
        harness.add_generated(
            &name,
            Synthetic::new(Content::Text, 10_000 + index as u64, size),
        );
        entries.push(entry(&name, GENERATED_BUCKET, &name));
    }
}

struct Run {
    results: Vec<ArchiveResult>,
    input_bytes: u64,
    size_bounds: Vec<u64>,
    peak_heap: u64,
    seconds: f64,
}

fn reset_peak() -> usize {
    let baseline = CURRENT.load(Ordering::Relaxed);
    PEAK.store(baseline, Ordering::Relaxed);
    baseline
}

struct Built {
    results: Vec<ArchiveResult>,
    input_bytes: u64,
    size_bounds: Vec<u64>,
}

async fn build_all(harness: &Harness, specs: &[ZipJobSpec]) -> Built {
    let settings = zip_settings();
    let progress: Vec<Arc<ZipProgress>> =
        specs.iter().map(|_| Arc::new(ZipProgress::new())).collect();
    let results = futures::future::join_all(specs.iter().zip(&progress).map(|(spec, progress)| {
        build_archive(
            &harness.service,
            spec,
            &settings,
            CancellationToken::new(),
            progress.clone(),
            None,
        )
    }))
    .await;

    let snapshots: Vec<_> = progress
        .iter()
        .map(|progress| progress.snapshot())
        .collect();
    Built {
        results: results.into_iter().map(Result::unwrap).collect(),
        input_bytes: snapshots.iter().map(|snapshot| snapshot.bytes_read).sum(),
        size_bounds: snapshots
            .iter()
            .map(|snapshot| snapshot.bytes_estimate)
            .collect(),
    }
}

async fn run(harness: &Harness, specs: &[ZipJobSpec]) -> Run {
    warm_up();
    let baseline = reset_peak();
    let started = Instant::now();

    let built = build_all(harness, specs).await;

    Run {
        results: built.results,
        input_bytes: built.input_bytes,
        size_bounds: built.size_bounds,
        peak_heap: PEAK.load(Ordering::Relaxed).saturating_sub(baseline) as u64,
        seconds: started.elapsed().as_secs_f64(),
    }
}

/// [`run`] for one spec handed over the way a job hands it over, counting the spec itself in
/// the peak heap.
async fn run_owned(harness: &Harness, spec: ZipJobSpec) -> Run {
    warm_up();
    let before = CURRENT.load(Ordering::Relaxed);
    let owned = spec.clone();
    let spec_heap = CURRENT.load(Ordering::Relaxed) - before;
    drop(spec);
    let baseline = reset_peak() - spec_heap;
    let started = Instant::now();

    let progress = Arc::new(ZipProgress::new());
    let result = build_archive_owned(
        &harness.service,
        owned,
        &zip_settings(),
        CancellationToken::new(),
        progress.clone(),
        None,
    )
    .await
    .unwrap();

    let snapshot = progress.snapshot();
    Run {
        results: vec![result],
        input_bytes: snapshot.bytes_read,
        size_bounds: vec![snapshot.bytes_estimate],
        peak_heap: PEAK.load(Ordering::Relaxed).saturating_sub(baseline) as u64,
        seconds: started.elapsed().as_secs_f64(),
    }
}

fn warm_up() {
    for content in [Content::Text, Content::Random, Content::Zeros] {
        generate(content, 0, 0, 1);
    }
}

fn mib(bytes: u64) -> f64 {
    bytes as f64 / MIB as f64
}

fn gib(bytes: u64) -> f64 {
    bytes as f64 / GIB as f64
}

/// Checks the parts against S3's limits and returns `(count, largest, smallest but the last)`.
fn check_s3_parts(parts: &[u64]) -> (usize, u64, u64) {
    assert!(parts.len() <= 10_000, "{} parts", parts.len());
    let (last, rest) = parts.split_last().unwrap();
    assert!(*last <= 5 * GIB);
    for part in rest {
        assert!((5 * MIB..=5 * GIB).contains(part), "part of {} bytes", part);
    }
    (
        parts.len(),
        parts.iter().copied().max().unwrap(),
        rest.iter().copied().min().unwrap_or(*last),
    )
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
#[ignore = "streams over 100 GiB through the pipeline; run with --release --ignored"]
async fn archives_over_a_hundred_gibibytes_in_bounded_memory() {
    const ARCHIVE_BUDGET: u64 = 256 * MIB;
    const SMALL: usize = 50_000;

    let archive_uploader = Arc::new(Uploader::new(budget(ARCHIVE_BUDGET)));
    let harness =
        Harness::with_archive_uploader(upload_settings(), S3_LIKE, archive_uploader.clone()).await;

    let mut entries = Vec::new();
    // Parts are sized from the archive's size bound, so the archive has to come close to it,
    // with little compressible data, for the part count to approach S3's limit.
    let large = [
        (Content::Zeros, 20 * GIB),
        (Content::Random, 20 * GIB),
        (Content::Random, 15 * GIB),
        (Content::Zeros, 15 * GIB),
        (Content::Random, 15 * GIB),
        (Content::Random, 10 * GIB),
        (Content::Text, 5 * GIB),
    ];
    for (index, (content, size)) in large.iter().enumerate() {
        add_large(
            &harness,
            &mut entries,
            &format!("large/{index}.bin"),
            *content,
            index as u64,
            *size,
        );
    }
    add_small(&harness, &mut entries, "small", SMALL, SMALL_ENTRY);
    let entry_count = entries.len();
    let spec = spec(SINK_BUCKET, "hundred.zip", entries);

    let run = run(&harness, std::slice::from_ref(&spec)).await;

    let expected_input: u64 =
        large.iter().map(|(_, size)| size).sum::<u64>() + SMALL as u64 * SMALL_ENTRY;
    let sink = harness
        .backend
        .sink_object(&format!("{SINK_BUCKET}/hundred.zip"))
        .unwrap();
    let (parts, largest, smallest) = check_s3_parts(&sink.parts);
    let peak_reserved = archive_uploader.peak_reserved_bytes();
    let overhead = pipeline_overhead(1, entry_count, KIB);
    let size_bound = run.size_bounds[0];
    let parts_for_the_bound = size_bound.div_ceil(sink.parts[1]);

    println!(
        "100 GiB run: {} entries, read {:.2} GiB, wrote {:.2} GiB in {:.1} s ({:.0} MiB/s in, {:.0} MiB/s out); \
         peak heap {:.1} MiB; peak archive budget reserved {:.1} MiB of {:.0} MiB; \
         {} parts, {:.2} MiB each (largest {:.2} MiB, smallest before the last {:.2} MiB), \
         sized for the {:.2} GiB size bound to take {} parts",
        entry_count,
        gib(run.input_bytes),
        gib(sink.size),
        run.seconds,
        mib(run.input_bytes) / run.seconds,
        mib(sink.size) / run.seconds,
        mib(run.peak_heap),
        mib(peak_reserved),
        mib(ARCHIVE_BUDGET),
        parts,
        mib(sink.parts[1]),
        mib(largest),
        mib(smallest),
        gib(size_bound),
        parts_for_the_bound,
    );

    assert_eq!(run.input_bytes, expected_input);
    assert_eq!(sink.size, run.results[0].size);
    assert!(run.input_bytes > 100 * GIB);
    assert!(
        (8_000..=9_000).contains(&parts_for_the_bound),
        "the size bound would take {} parts",
        parts_for_the_bound
    );
    assert_eq!(
        parts as u64,
        (sink.size - sink.parts[0]).div_ceil(sink.parts[1]) + 1
    );
    assert!(peak_reserved <= ARCHIVE_BUDGET);
    assert!(
        run.peak_heap <= peak_reserved + overhead + RUNTIME_SLACK,
        "peak heap {} over {} reserved + {} overhead",
        run.peak_heap,
        peak_reserved,
        overhead
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
#[ignore = "deflates two 4 GiB + 1 text entries; run with --release --ignored"]
async fn deflates_four_gibibyte_text_entries() {
    const SIZE: u64 = 4 * GIB + 1;

    let harness = Harness::with_archive_uploader(
        upload_settings(),
        S3_LIKE,
        Arc::new(Uploader::new(budget(256 * MIB))),
    )
    .await;

    for (content, max_ratio) in [(Content::Prose, 0.35), (Content::Text, 0.1)] {
        let name = format!("{content:?}.log");
        let mut entries = Vec::new();
        add_large(&harness, &mut entries, &name, content, 7, SIZE);
        let spec = spec(SINK_BUCKET, &format!("{content:?}.zip"), entries);

        let run = run(&harness, std::slice::from_ref(&spec)).await;
        let size = run.results[0].size;
        let ratio = size as f64 / SIZE as f64;
        println!(
            "4 GiB + 1 {content:?} entry: {:.2} GiB -> {} bytes (ratio {:.5}) in {:.1} s \
             ({:.0} MiB/s in); peak heap {:.1} MiB; sha256 {}",
            gib(run.input_bytes),
            size,
            ratio,
            run.seconds,
            mib(run.input_bytes) / run.seconds,
            mib(run.peak_heap),
            run.results[0].sha256,
        );

        assert_eq!(run.input_bytes, SIZE);
        assert!(ratio < max_ratio, "{content:?} ratio {ratio}");
    }
}

fn zip_entry_count(path: &Path) -> u64 {
    let script = r#"
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    infos = archive.infolist()
    bad = archive.testzip()
    if bad is not None:
        sys.exit("bad entry: " + bad)
    print(len(infos))
"#;
    let output = std::process::Command::new("python3")
        .args(["-c", script])
        .arg(path)
        .output()
        .expect("python3 runs");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse()
        .unwrap()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
#[ignore = "builds a 1,000,000-entry archive; run with --release --ignored"]
async fn archives_a_million_entries() {
    const ENTRIES: usize = 1_000_000;
    const ENTRY_SIZE: u64 = 100;

    let archive_uploader = Arc::new(Uploader::new(budget(256 * MIB)));
    let harness =
        Harness::with_archive_uploader(upload_settings(), local_limits(), archive_uploader.clone())
            .await;

    let mut entries = Vec::with_capacity(ENTRIES);
    add_small(&harness, &mut entries, "m", ENTRIES, ENTRY_SIZE);
    let spec = spec(ARCHIVE_BUCKET, "million.zip", entries);

    let run = run_owned(&harness, spec).await;
    let result = &run.results[0];
    let path = harness
        .root()
        .join("data")
        .join(ARCHIVE_BUCKET)
        .join("million.zip");
    assert_eq!(std::fs::metadata(&path).unwrap().len(), result.size);

    let validate = Instant::now();
    let listed = zip_entry_count(&path);
    let validated_in = validate.elapsed().as_secs_f64();
    let unzip = std::process::Command::new("unzip")
        .args(["-tqq"])
        .arg(&path)
        .status();

    println!(
        "1M entries: built {:.1} MiB archive in {:.1} s ({:.0} entries/s); peak heap with the spec \
         {:.1} MiB ({:.0} bytes per entry); peak archive budget reserved {:.1} MiB; python zipfile listed \
         and tested {} entries in {:.1} s; unzip -t: {:?}",
        mib(result.size),
        run.seconds,
        ENTRIES as f64 / run.seconds,
        mib(run.peak_heap),
        run.peak_heap as f64 / ENTRIES as f64,
        mib(archive_uploader.peak_reserved_bytes()),
        listed,
        validated_in,
        unzip.as_ref().map(|status| status.code()),
    );

    assert_eq!(run.input_bytes, ENTRIES as u64 * ENTRY_SIZE);
    assert_eq!(listed, ENTRIES as u64);
    if let Ok(status) = unzip {
        assert!(status.success(), "unzip -t failed: {:?}", status);
    }
    assert!(run.peak_heap / (ENTRIES as u64) < 300);
}

fn client_body(seed: u64, size: u64) -> ByteStream {
    let chunk = 256 * KIB;
    Box::pin(futures::stream::unfold(0u64, move |offset| async move {
        if offset >= size {
            return None;
        }
        let len = chunk.min(size - offset);
        let data = generate(Content::Random, seed, offset, len as usize);
        Some((Ok(data), offset + len))
    }))
}

#[tokio::test(flavor = "multi_thread", worker_threads = 16)]
#[ignore = "runs 16 multi-GiB pipelines next to client uploads; run with --release --ignored"]
async fn sixteen_pipelines_and_client_uploads_stay_within_their_budgets() {
    const PIPELINES: usize = 16;
    const CLIENT_UPLOADS: usize = 8;
    const CLIENT_UPLOAD_SIZE: u64 = 2 * GIB;
    const CLIENT_BUDGET: u64 = 64 * MIB;
    const ARCHIVE_BUDGET: u64 = 64 * MIB;
    const SMALL: usize = 200;

    let archive_uploader = Arc::new(Uploader::new(budget(ARCHIVE_BUDGET)));
    let harness =
        Harness::with_archive_uploader(budget(CLIENT_BUDGET), S3_LIKE, archive_uploader.clone())
            .await;

    let specs: Vec<ZipJobSpec> = (0..PIPELINES)
        .map(|pipeline| {
            let mut entries = Vec::new();
            add_large(
                &harness,
                &mut entries,
                &format!("p{pipeline}/random.bin"),
                Content::Random,
                pipeline as u64,
                2 * GIB,
            );
            add_large(
                &harness,
                &mut entries,
                &format!("p{pipeline}/text.bin"),
                Content::Text,
                100 + pipeline as u64,
                GIB,
            );
            add_small(
                &harness,
                &mut entries,
                &format!("p{pipeline}/small"),
                SMALL,
                SMALL_ENTRY,
            );
            spec(SINK_BUCKET, &format!("parallel/{pipeline}.zip"), entries)
        })
        .collect();

    warm_up();
    let baseline = reset_peak();
    let started = Instant::now();

    let uploads = futures::future::join_all((0..CLIENT_UPLOADS).map(|index| {
        let service = harness.service.clone();
        async move {
            service
                .put_object_stream(
                    SINK_BUCKET,
                    &format!("client/{index}.bin"),
                    client_body(index as u64, CLIENT_UPLOAD_SIZE),
                    PutOptions {
                        size_hint: (index % 2 == 0).then_some(CLIENT_UPLOAD_SIZE),
                        ..Default::default()
                    },
                )
                .await
                .unwrap()
        }
    }));
    let (built, uploaded) = tokio::join!(build_all(&harness, &specs), uploads);
    let (results, input_bytes) = (built.results, built.input_bytes);

    let seconds = started.elapsed().as_secs_f64();
    let peak_heap = PEAK.load(Ordering::Relaxed).saturating_sub(baseline) as u64;
    let client_reserved = harness.backend.uploader_handle().peak_reserved_bytes();
    let archive_reserved = archive_uploader.peak_reserved_bytes();
    let overhead = pipeline_overhead(PIPELINES as u64, SMALL + 2, KIB);
    let bound = CLIENT_BUDGET + ARCHIVE_BUDGET + overhead + RUNTIME_SLACK;

    let archived: u64 = results.iter().map(|result| result.size).sum();
    let client_bytes: u64 = uploaded.iter().map(|object| object.metadata.size).sum();
    println!(
        "16 pipelines + {} client uploads: read {:.1} GiB into archives of {:.1} GiB and \
         uploaded {:.1} GiB in {:.1} s ({:.0} MiB/s through the uploaders); peak heap {:.1} MiB \
         (bound {:.1} MiB = budgets {:.0} + {:.0} MiB, pipeline overhead {:.1} MiB, slack {:.0} MiB); \
         peak reserved: client {:.1} MiB, archives {:.1} MiB",
        CLIENT_UPLOADS,
        gib(input_bytes),
        gib(archived),
        gib(client_bytes),
        seconds,
        mib(archived + client_bytes) / seconds,
        mib(peak_heap),
        mib(bound),
        mib(CLIENT_BUDGET),
        mib(ARCHIVE_BUDGET),
        mib(overhead),
        mib(RUNTIME_SLACK),
        mib(client_reserved),
        mib(archive_reserved),
    );

    assert_eq!(client_bytes, CLIENT_UPLOADS as u64 * CLIENT_UPLOAD_SIZE);
    assert_eq!(
        input_bytes,
        PIPELINES as u64 * (3 * GIB + SMALL as u64 * SMALL_ENTRY)
    );
    for result in &results[1..] {
        assert_ne!(result.sha256, results[0].sha256);
    }
    assert!(client_reserved <= CLIENT_BUDGET);
    assert!(archive_reserved <= ARCHIVE_BUDGET);
    assert!(peak_heap <= bound, "peak heap {} over {}", peak_heap, bound);
}
