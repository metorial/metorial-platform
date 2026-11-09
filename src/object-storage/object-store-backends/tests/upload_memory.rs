//! Measures how much heap an upload holds while gigabytes stream through the uploader.
//!
//! The 8 GiB run is ignored by default; run it in release mode:
//! `cargo test --release -p object-store-backends --test upload_memory -- --ignored --nocapture`

mod common;

use bytes::Bytes;
use common::*;
use object_store_backends::{Backend, ByteStream, PutOptions, UploadSettings};
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

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

/// Yields `total` bytes as 64 KiB slices of one shared block, like a request body arriving from
/// the network, without the source itself holding more than the block.
fn generated(total: u64) -> ByteStream {
    let block = Bytes::from(pattern(MIB as usize, 42));
    let chunk = 64 * KIB;

    Box::pin(futures::stream::iter((0..total.div_ceil(chunk)).map(
        move |index| {
            let start = index * chunk;
            let len = chunk.min(total - start);
            let offset = (start % MIB) as usize;
            Ok(block.slice(offset..offset + len as usize))
        },
    )))
}

struct Measurement {
    bytes: u64,
    peak_heap: usize,
    peak_reserved: u64,
    parts_in_flight: usize,
    seconds: f64,
}

async fn measure(
    settings: UploadSettings,
    total: u64,
    size_hint: Option<u64>,
    part_latency: Duration,
) -> Measurement {
    let _serial = SERIAL.lock().await;

    let backend = FakeBackend::new(settings).discarding();
    backend.state.faults().part_delay = part_latency;
    let opts = PutOptions {
        size_hint,
        ..Default::default()
    };

    let baseline = CURRENT.load(Ordering::Relaxed);
    PEAK.store(baseline, Ordering::Relaxed);
    let started = Instant::now();

    let uploaded = backend
        .put_object_stream("big", generated(total), opts)
        .await
        .unwrap();

    let seconds = started.elapsed().as_secs_f64();
    let peak_heap = PEAK.load(Ordering::Relaxed).saturating_sub(baseline);

    assert_eq!(uploaded.metadata.size, total);
    assert_eq!(backend.state.bytes_received.load(Ordering::SeqCst), total);

    Measurement {
        bytes: total,
        peak_heap,
        peak_reserved: backend.uploader.peak_reserved_bytes(),
        parts_in_flight: backend.state.max_parts_in_flight.load(Ordering::SeqCst),
        seconds,
    }
}

fn report(label: &str, measurement: &Measurement) {
    println!(
        "{}: pushed {} MiB, peak heap {:.1} MiB, peak budget reserved {:.1} MiB, \
         {} parts in flight, {:.2} s, {:.0} MiB/s",
        label,
        measurement.bytes / MIB,
        measurement.peak_heap as f64 / MIB as f64,
        measurement.peak_reserved as f64 / MIB as f64,
        measurement.parts_in_flight,
        measurement.seconds,
        measurement.bytes as f64 / MIB as f64 / measurement.seconds
    );
}

const SLACK: usize = 8 * MIB as usize;

const NETWORK: Duration = Duration::from_millis(100);

fn default_settings() -> UploadSettings {
    UploadSettings {
        retry: fast_retries(),
        ..UploadSettings::default()
    }
}

fn small_budget() -> UploadSettings {
    UploadSettings {
        part_concurrency: 16,
        min_part_size: 8 * MIB,
        memory_budget_bytes: 64 * MIB,
        ..default_settings()
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn holds_a_bounded_amount_of_memory() {
    let settings = UploadSettings {
        part_concurrency: 16,
        min_part_size: 2 * MIB,
        memory_budget_bytes: 16 * MIB,
        single_request_threshold: 2 * MIB,
        ..default_settings()
    };
    let measurement = measure(settings.clone(), 48 * MIB, None, Duration::from_millis(500)).await;
    report("48 MiB, 16 MiB budget, 500 ms parts", &measurement);

    assert!(measurement.parts_in_flight > 1);
    assert!(measurement.peak_reserved <= settings.memory_budget_bytes);
    assert!(measurement.peak_heap <= settings.memory_budget_bytes as usize + SLACK);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "pushes 8 GiB; run in release mode"]
async fn streams_eight_gibibytes_in_bounded_memory() {
    let total = 8 * 1024 * MIB;

    let settings = default_settings();
    let instant = measure(settings.clone(), total, None, Duration::ZERO).await;
    report("8 GiB, defaults, instant parts", &instant);

    let without_hint = measure(settings.clone(), total, None, NETWORK).await;
    report("8 GiB, defaults, no hint, 100 ms parts", &without_hint);

    let with_hint = measure(settings.clone(), total, Some(total), NETWORK).await;
    report("8 GiB, defaults, exact hint, 100 ms parts", &with_hint);

    let lying_hint = measure(settings.clone(), total, Some(u64::MAX), NETWORK).await;
    report("8 GiB, defaults, u64::MAX hint, 100 ms parts", &lying_hint);

    let small = small_budget();
    let budgeted = measure(small.clone(), total, None, NETWORK).await;
    report("8 GiB, 64 MiB budget, 16 parallel, 100 ms parts", &budgeted);

    // Defaults: 16 MiB parts, four in flight plus one filling.
    let expected = 5 * 16 * MIB as usize + SLACK;
    for measurement in [&instant, &without_hint, &with_hint] {
        assert!(
            measurement.peak_heap <= expected,
            "{}",
            measurement.peak_heap
        );
    }
    assert_eq!(without_hint.parts_in_flight, 4);
    assert!(lying_hint.peak_heap <= settings.memory_budget_bytes as usize + SLACK);
    assert!(budgeted.parts_in_flight >= 4);
    assert!(budgeted.peak_reserved <= small.memory_budget_bytes);
    assert!(budgeted.peak_heap <= small.memory_budget_bytes as usize + SLACK);
}
