//! Measures how much heap archive builds hold while their entries stream from generated sources
//! into a discarding sink.
//!
//! The multi-gigabyte run is ignored by default; run it in release mode:
//! `cargo test --release -p object-store --test zip_pipeline_memory -- --ignored --nocapture`

mod pipeline_support;

use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;

use object_store::zip::{
    build_archive, ArchiveResult, CompressionHint, ZipJobSpec, ZipProgress, ZipSettings,
};
use object_store_backends::UploadSettings;
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

static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const UPLOAD_BUDGET: u64 = 64 * MIB;
const SMALL_ENTRY: u64 = 4 * KIB;
const BYTES_PER_ENTRY: u64 = KIB;
const RUNTIME_SLACK: u64 = 8 * MIB;

fn memory_upload_settings() -> UploadSettings {
    UploadSettings {
        memory_budget_bytes: UPLOAD_BUDGET,
        ..upload_settings()
    }
}

/// What `pipelines` concurrent pipelines may hold on top of the shared upload budget: each has
/// queued and coalescing archive chunks, the prefetch window of small entries (raw and
/// compressed), a large entry's sample and its trial compression, a small record per entry for
/// the plan and central directory, and a large entry's Deflate blocks.
fn pipeline_heap_bound(settings: &ZipSettings, pipelines: u64, entries: usize) -> u64 {
    let archive_chunks = 8 * settings.write_chunk_bytes as u64;
    let prefetch =
        settings.fetch_concurrency as u64 * SMALL_ENTRY.min(settings.small_entry_bytes) * 2;
    let sample = MIB;
    let pipeline = archive_chunks + prefetch + sample + entries as u64 * BYTES_PER_ENTRY;
    pipelines * pipeline + deflate_heap_bound(settings, pipelines)
}

/// `large` generated sources of `large_size` bytes (random and auto, text and auto, zeros and
/// stored with a known crc, repeating) plus `small` 4 KiB text files.
fn mixed_spec(
    harness: &Harness,
    key: &str,
    large: usize,
    large_size: u64,
    small: usize,
) -> ZipJobSpec {
    let mut entries = Vec::with_capacity(large + small);
    for index in 0..large {
        let name = format!("large/{index}.bin");
        let (content, hint) = match index % 3 {
            0 => (Content::Random, CompressionHint::Auto),
            1 => (Content::Text, CompressionHint::Auto),
            _ => (Content::Zeros, CompressionHint::Store),
        };
        let source = Synthetic::new(content, index as u64, large_size);
        let mut entry = entry(&name, GENERATED_BUCKET, &name);
        entry.compression = hint;
        if hint == CompressionHint::Store {
            let (size, crc32) = source.digest();
            entry.size = Some(size);
            entry.crc32 = Some(crc32);
        }
        harness.add_generated(&name, source);
        entries.push(entry);
    }
    for index in 0..small {
        let name = format!("small/{:05}.txt", index);
        harness.add_generated(
            &name,
            Synthetic::new(Content::Text, 1_000 + index as u64, SMALL_ENTRY),
        );
        entries.push(entry(&name, GENERATED_BUCKET, &name));
    }
    spec(SINK_BUCKET, key, entries)
}

struct Measurement {
    results: Vec<ArchiveResult>,
    input_bytes: u64,
    peak_heap: u64,
    peak_reserved: u64,
    seconds: f64,
}

async fn measure(harness: &Harness, specs: &[ZipJobSpec], settings: &ZipSettings) -> Measurement {
    generate(Content::Text, 0, 0, 1);
    generate(Content::Random, 0, 0, 1);
    generate(Content::Zeros, 0, 0, 1);

    let baseline = CURRENT.load(Ordering::Relaxed);
    PEAK.store(baseline, Ordering::Relaxed);
    let started = Instant::now();

    let progress: Vec<Arc<ZipProgress>> =
        specs.iter().map(|_| Arc::new(ZipProgress::new())).collect();
    let results = futures::future::join_all(specs.iter().zip(&progress).map(|(spec, progress)| {
        build_archive(
            &harness.service,
            spec,
            settings,
            CancellationToken::new(),
            progress.clone(),
            None,
        )
    }))
    .await;

    let seconds = started.elapsed().as_secs_f64();
    let peak_heap = PEAK.load(Ordering::Relaxed).saturating_sub(baseline) as u64;

    let results: Vec<ArchiveResult> = results.into_iter().map(Result::unwrap).collect();
    for (spec, result) in specs.iter().zip(&results) {
        let stored = harness
            .backend
            .sink_object(&format!("{SINK_BUCKET}/{}", spec.destination.key))
            .expect("the archive reached the sink");
        assert_eq!(stored.size, result.size);
    }

    Measurement {
        results,
        input_bytes: progress
            .iter()
            .map(|progress| progress.snapshot().bytes_read)
            .sum(),
        peak_heap,
        peak_reserved: harness.backend.uploader_handle().peak_reserved_bytes(),
        seconds,
    }
}

fn report(label: &str, measurement: &Measurement, bound: u64) {
    let output: u64 = measurement.results.iter().map(|result| result.size).sum();
    println!(
        "{label}: read {:.1} MiB, wrote {:.1} MiB in {:.2} s ({:.0} MiB/s in), peak heap {:.1} MiB \
         (bound {:.1} MiB), peak upload budget reserved {:.1} MiB",
        measurement.input_bytes as f64 / MIB as f64,
        output as f64 / MIB as f64,
        measurement.seconds,
        measurement.input_bytes as f64 / MIB as f64 / measurement.seconds,
        measurement.peak_heap as f64 / MIB as f64,
        bound as f64 / MIB as f64,
        measurement.peak_reserved as f64 / MIB as f64,
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn heap_stays_bounded_while_archiving_large_and_many_small_entries() {
    let _serial = SERIAL.lock().await;
    let harness = Harness::with(memory_upload_settings(), S3_LIKE).await;
    let settings = ZipSettings {
        compression_parallelism: Some(4),
        ..zip_settings()
    };
    let spec = mixed_spec(&harness, "bounded.zip", 3, 24 * MIB, 3_000);

    let measurement = measure(&harness, std::slice::from_ref(&spec), &settings).await;
    let bound =
        UPLOAD_BUDGET + pipeline_heap_bound(&settings, 1, spec.entries.len()) + RUNTIME_SLACK;
    report("3 x 24 MiB + 3,000 x 4 KiB", &measurement, bound);

    assert_eq!(measurement.input_bytes, 3 * 24 * MIB + 3_000 * SMALL_ENTRY);
    assert!(measurement.peak_heap < bound);
    assert!(measurement.peak_heap < measurement.input_bytes / 2);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
async fn sixteen_pipelines_share_one_upload_budget() {
    const PIPELINES: usize = 16;

    let _serial = SERIAL.lock().await;
    let harness = Harness::with(memory_upload_settings(), S3_LIKE).await;
    let settings = ZipSettings {
        fetch_concurrency: 4,
        ..zip_settings()
    };
    let specs: Vec<ZipJobSpec> = (0..PIPELINES)
        .map(|index| mixed_spec(&harness, &format!("parallel/{index}.zip"), 3, 6 * MIB, 200))
        .collect();

    let reference = measure(&harness, &specs[..1], &settings).await;
    let measurement = measure(&harness, &specs, &settings).await;
    let bound = UPLOAD_BUDGET
        + pipeline_heap_bound(&settings, PIPELINES as u64, specs[0].entries.len())
        + RUNTIME_SLACK;
    report(
        "16 pipelines of 3 x 6 MiB + 200 x 4 KiB",
        &measurement,
        bound,
    );

    for result in &measurement.results {
        assert_eq!(result.sha256, reference.results[0].sha256);
        assert_eq!(result.size, reference.results[0].size);
    }
    assert!(measurement.peak_reserved <= UPLOAD_BUDGET);
    assert!(measurement.peak_heap < bound);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
#[ignore = "streams 6 GiB through the pipeline; run with --release --ignored"]
async fn heap_stays_bounded_for_gigabytes_and_twenty_thousand_entries() {
    let _serial = SERIAL.lock().await;
    let harness = Harness::with(memory_upload_settings(), S3_LIKE).await;
    let settings = zip_settings();
    let spec = mixed_spec(&harness, "huge.zip", 3, 2 * GIB, 20_000);

    let measurement = measure(&harness, std::slice::from_ref(&spec), &settings).await;
    let bound =
        UPLOAD_BUDGET + pipeline_heap_bound(&settings, 1, spec.entries.len()) + RUNTIME_SLACK;
    report("3 x 2 GiB + 20,000 x 4 KiB", &measurement, bound);

    assert_eq!(measurement.input_bytes, 6 * GIB + 20_000 * SMALL_ENTRY);
    assert!(measurement.peak_heap < bound);
}
