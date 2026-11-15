//! Admission of zip job specs over HTTP: what a PUT may cost before it is accepted as a job.
//! Specs share one parsing budget, are parsed off the runtime, and are refused without being
//! read when the instance is full. Every heap allocation is counted, so tests run one at a time.

mod job_support;
mod pipeline_support;

use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use bytes::Bytes;
use futures::future::join_all;
use job_support::*;
use object_store::zip::{ZipJobSpec, ZipSettings};
use pipeline_support::*;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

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

const LIMIT: Duration = Duration::from_secs(30);

/// Heap allocated from now on, beyond what is allocated now.
struct HeapPeak(usize);

impl HeapPeak {
    fn start() -> Self {
        let current = CURRENT.load(Ordering::SeqCst);
        PEAK.store(current, Ordering::SeqCst);
        HeapPeak(current)
    }

    fn above_start(&self) -> usize {
        PEAK.load(Ordering::SeqCst).saturating_sub(self.0)
    }
}

async fn setup() -> Harness {
    let harness = Harness::new().await;
    harness
        .put(SOURCE_BUCKET, "readme", b"read me\n".repeat(100))
        .await;
    harness
}

fn small_spec(key: &str) -> ZipJobSpec {
    spec(
        ARCHIVE_BUCKET,
        &format!("{key}.zip"),
        vec![entry("readme.txt", SOURCE_BUCKET, "readme")],
    )
}

/// One slow 2 MiB entry: about `32 * delay_ms` to build.
fn slow_spec(harness: &Harness, name: &str, delay_ms: u64) -> ZipJobSpec {
    let mut source = Synthetic::new(Content::Random, 11, 2 * MIB).chunk(64 * KIB as usize);
    source.chunk_delay = Duration::from_millis(delay_ms);
    harness.add_generated(name, source);
    spec(
        ARCHIVE_BUCKET,
        &format!("{name}.zip"),
        vec![entry("big.bin", GENERATED_BUCKET, name)],
    )
}

/// A spec body of just under `size` bytes whose destination bucket does not exist, so it is
/// read, parsed and validated in full and then refused.
fn large_spec_body(size: usize) -> Bytes {
    let mut body =
        String::from(r#"{"destination":{"bucket":"no-such-bucket","key":"x.zip"},"entries":["#);
    let mut index = 0;
    while body.len() + 200 < size {
        if index > 0 {
            body.push(',');
        }
        body.push_str(&format!(
            r#"{{"path":"dir{}/file-{index}.txt","source":{{"bucket":"files","key":"k{index}"}}}}"#,
            index % 100
        ));
        index += 1;
    }
    body.push_str("]}");
    Bytes::from(body)
}

async fn put_bytes(instance: &Instance, id: &str, body: Bytes) -> (u16, serde_json::Value) {
    let response = reqwest::Client::new()
        .put(instance.job_url(id, None))
        .header("content-type", "application/json")
        .body(body)
        .send()
        .await
        .unwrap();
    let status = response.status().as_u16();
    (status, response.json().await.unwrap_or_default())
}

/// Starts a PUT that announces `content_length` bytes but only ever sends `sent` of them.
async fn start_stalled_put(
    instance: &Instance,
    id: &str,
    content_length: usize,
    sent: usize,
) -> TcpStream {
    let address = instance.url.trim_start_matches("http://");
    let mut stream = TcpStream::connect(address).await.unwrap();
    let head = format!(
        "PUT /zip-jobs/{id} HTTP/1.1\r\nHost: {address}\r\nContent-Type: application/json\r\nContent-Length: {content_length}\r\n\r\n"
    );
    let mut request = head.into_bytes();
    request.extend(std::iter::repeat_n(b' ', sent));
    stream.write_all(&request).await.unwrap();
    stream.flush().await.unwrap();
    stream
}

/// The status and `Retry-After` of the response head on `stream`, or `None` if none arrives
/// within `limit`.
async fn response_head(stream: &mut TcpStream, limit: Duration) -> Option<(u16, Option<String>)> {
    let mut head = Vec::new();
    let read = tokio::time::timeout(limit, async {
        let mut buffer = [0u8; 1024];
        while !head.windows(4).any(|window| window == b"\r\n\r\n") {
            let Ok(read @ 1..) = stream.read(&mut buffer).await else {
                break;
            };
            head.extend_from_slice(&buffer[..read]);
        }
    })
    .await;
    read.ok()?;

    let head = String::from_utf8_lossy(&head);
    let status = head.split(' ').nth(1)?.parse().ok()?;
    let retry_after = head.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.eq_ignore_ascii_case("retry-after")
            .then(|| value.trim().to_string())
    });
    Some((status, retry_after))
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_large_specs_share_one_parsing_budget_off_the_runtime() {
    let _serial = SERIAL.lock().await;
    let harness = setup().await;
    let max_spec_bytes = 4 * MIB as usize;
    let settings = ZipSettings {
        max_spec_bytes,
        max_parsing_spec_bytes: max_spec_bytes,
        spec_admission_wait: LIMIT,
        ..job_settings()
    };
    let a = Instance::start(&harness.backend, "a", settings).await;
    let body = large_spec_body(max_spec_bytes);

    let alone = HeapPeak::start();
    let started = Instant::now();
    let (status, reply) = put_bytes(&a, "alone", body.clone()).await;
    let one_spec_takes = started.elapsed();
    assert_eq!(status, 400, "{reply}");
    assert_eq!(reply["code"], "invalid_spec");
    let one_spec = alone.above_start();

    let stop = Arc::new(AtomicBool::new(false));
    let health = tokio::spawn({
        let url = format!("{}/health", a.url);
        let stop = stop.clone();
        async move {
            let client = reqwest::Client::new();
            let mut slowest = Duration::ZERO;
            while !stop.load(Ordering::SeqCst) {
                let started = Instant::now();
                assert!(client.get(&url).send().await.unwrap().status().is_success());
                slowest = slowest.max(started.elapsed());
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
            slowest
        }
    });

    let together = HeapPeak::start();
    let ids: Vec<String> = (0..8).map(|index| format!("big-{index}")).collect();
    let puts = ids.iter().map(|id| put_bytes(&a, id, body.clone()));
    let replies = join_all(puts).await;
    let all_specs = together.above_start();
    stop.store(true, Ordering::SeqCst);
    let slowest_health = health.await.unwrap();

    for (status, reply) in &replies {
        assert_eq!(*status, 400, "{reply}");
        assert_eq!(reply["code"], "invalid_spec");
    }
    println!(
        "one spec: {} KiB in {one_spec_takes:?}; eight at once: {} KiB; slowest health check {slowest_health:?}",
        one_spec / 1024,
        all_specs / 1024
    );
    assert!(
        all_specs < one_spec + 3 * max_spec_bytes,
        "eight specs at once held {all_specs} bytes, one alone {one_spec}"
    );
    assert!(
        slowest_health < Duration::from_millis(500).max(one_spec_takes / 2),
        "a health check took {slowest_health:?} while specs were parsed (one spec: {one_spec_takes:?})"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_full_instance_refuses_new_specs_unread_but_lets_them_join() {
    let _serial = SERIAL.lock().await;
    let harness = setup().await;
    let settings = ZipSettings {
        max_concurrent_jobs: 1,
        max_queued_jobs: 0,
        ..job_settings()
    };
    let a = Instance::start(&harness.backend, "a", settings).await;
    let busy = slow_spec(&harness, "busy", 150);
    assert_eq!(a.put_job("busy", &busy, None).await.status, 202);

    let mut stalled = start_stalled_put(&a, "another", 100_000, 10).await;
    let head = response_head(&mut stalled, Duration::from_secs(10)).await;
    assert_eq!(
        head,
        Some((429, Some("5".to_string()))),
        "a full instance read the spec body"
    );

    let joined = a.put_job("busy", &busy, None).await;
    assert_eq!(joined.status, 202, "{}", joined.body);
    assert_eq!(joined.body["attempt"], 1);
    let mut other = busy.clone();
    other.destination.key = "other.zip".to_string();
    assert_eq!(a.put_job("busy", &other, None).await.status, 409);

    let refused = a.put_job("small", &small_spec("small"), None).await;
    assert_eq!(refused.status, 429, "{}", refused.body);
    assert_eq!(refused.body["code"], "too_many_jobs");

    let done = a.get_job("busy", Some(10.0)).await;
    assert_eq!(done.body["state"], "completed", "{}", done.body);
    a.wait_until_idle(LIMIT).await;
    let again = a.put_job("busy", &busy, None).await;
    assert_eq!(again.status, 200, "{}", again.body);
    assert_eq!(again.body, done.body);
    assert_eq!(
        a.put_job("small", &small_spec("small"), Some(10.0))
            .await
            .status,
        200
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_full_entry_budget_refuses_new_specs_unread() {
    let _serial = SERIAL.lock().await;
    let harness = setup().await;
    let settings = ZipSettings {
        max_concurrent_jobs: 1,
        max_queued_jobs: 4,
        max_entries: 1,
        ..job_settings()
    };
    let a = Instance::start(&harness.backend, "a", settings).await;
    assert_eq!(
        a.put_job("busy", &slow_spec(&harness, "busy", 100), None)
            .await
            .status,
        202
    );

    let mut stalled = start_stalled_put(&a, "another", 100_000, 10).await;
    let head = response_head(&mut stalled, Duration::from_secs(10)).await;
    assert_eq!(head, Some((429, Some("5".to_string()))));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_spec_that_gets_no_parsing_budget_in_time_is_refused() {
    let _serial = SERIAL.lock().await;
    let harness = setup().await;
    let budget = 64 * KIB as usize;
    let settings = ZipSettings {
        max_spec_bytes: budget,
        max_parsing_spec_bytes: budget,
        spec_admission_wait: Duration::from_millis(300),
        ..job_settings()
    };
    let a = Instance::start(&harness.backend, "a", settings).await;

    let holder = start_stalled_put(&a, "holder", budget, 10).await;
    tokio::time::sleep(Duration::from_millis(200)).await;
    let refused = a.put_job("small", &small_spec("small"), None).await;
    assert_eq!(refused.status, 429, "{}", refused.body);
    assert_eq!(refused.body["code"], "too_many_jobs");
    assert_eq!(refused.retry_after.as_deref(), Some("1"));
    assert!(
        refused.elapsed >= Duration::from_millis(250),
        "{:?}",
        refused.elapsed
    );

    drop(holder);
    let started = Instant::now();
    loop {
        let reply = a.put_job("small", &small_spec("small"), Some(10.0)).await;
        if reply.status == 200 {
            break;
        }
        assert_eq!(reply.status, 429, "{}", reply.body);
        assert!(started.elapsed() < LIMIT, "the budget was never released");
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn chunked_specs_are_read_up_to_max_spec_bytes() {
    let _serial = SERIAL.lock().await;
    let harness = setup().await;
    let max_spec_bytes = 64 * KIB as usize;
    let settings = ZipSettings {
        max_spec_bytes,
        ..job_settings()
    };
    let a = Instance::start(&harness.backend, "a", settings).await;

    let chunked = |body: Vec<u8>| {
        let chunks: Vec<std::io::Result<Bytes>> = body
            .chunks(1000)
            .map(|chunk| Ok(Bytes::copy_from_slice(chunk)))
            .collect();
        reqwest::Body::wrap_stream(futures::stream::iter(chunks))
    };
    let send = |id: &str, body: reqwest::Body| {
        reqwest::Client::new()
            .put(a.job_url(id, Some(10.0)))
            .header("content-type", "application/json")
            .body(body)
            .send()
    };

    let small = serde_json::to_vec(&small_spec("chunked")).unwrap();
    let reply = send("chunked", chunked(small)).await.unwrap();
    assert_eq!(reply.status(), 200);

    let reply = send("oversized", chunked(vec![b' '; 3 * max_spec_bytes]))
        .await
        .unwrap();
    assert_eq!(reply.status(), 413);
    let body: serde_json::Value = reply.json().await.unwrap();
    assert_eq!(body["code"], "spec_too_large");
}
