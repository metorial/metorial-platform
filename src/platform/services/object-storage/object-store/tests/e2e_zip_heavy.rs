//! Heavy black-box ZIP export tests: ZIP64 archives built by the real `object-store-service`
//! binary over HTTP, with the service's RSS sampled every 200 ms. They move tens of GiB, so
//! they are ignored by default; run them on a release build:
//!
//! ```sh
//! cargo test --release -p object-store --test e2e_zip_heavy -- --ignored --nocapture --test-threads 1
//! ```
//!
//! Each test checks free disk space first (skipping with a message when short) and removes
//! everything it wrote when it ends.

mod e2e_support;
mod zip_support;

use std::process::Command;
use std::time::{Duration, Instant};

use bytes::Bytes;
use e2e_support::*;
use serde_json::{json, Value};

const RSS_LIMIT_MIB: f64 = 600.0;
/// A spec of max_entries entries costs roughly 150 bytes per entry plus its strings while it is
/// built, on top of its request body while that is parsed.
const MAX_SPEC_RSS_LIMIT_MIB: f64 = 768.0;
const JOB_LIMIT: Duration = Duration::from_secs(3600);

struct Heavy {
    service: Service,
    storage: Storage,
    src: String,
    out: String,
}

impl Heavy {
    async fn start(name: &str) -> Heavy {
        if cfg!(debug_assertions) {
            println!("[e2e] WARNING: heavy tests on a debug build are very slow; use --release");
        }
        let storage = Storage::new(BackendKind::Local);
        let service = ServiceBuilder::new(&storage, name).start().await;
        let src = unique("src");
        let out = unique("out");
        service.api.create_bucket(&src).await;
        service.api.create_bucket(&out).await;
        Heavy {
            service,
            storage,
            src,
            out,
        }
    }

    fn api(&self) -> &Api {
        &self.service.api
    }

    /// Runs one job to its end while sampling RSS.
    async fn run(&self, id: &str, spec: &Value) -> (Value, Duration, RssStats) {
        let sampler = self.service.sample_rss();
        let started = Instant::now();
        let reply = self.api().put_job(id, spec, Some(30.0)).await;
        assert!(matches!(reply.status, 200 | 202), "{}", reply.body);
        let job = if reply.status == 200 {
            reply.body
        } else {
            self.api().wait_ended(id, JOB_LIMIT).await
        };
        let elapsed = started.elapsed();
        (job, elapsed, sampler.stop())
    }
}

fn free_disk_or_skip(test: &str, gib: u64) -> bool {
    let dir = std::env::temp_dir();
    let dir = dir.to_str().unwrap();
    let human = Command::new("df").args(["-h", dir]).output().unwrap();
    report!(
        "{test}: df -h {dir}\n{}",
        String::from_utf8_lossy(&human.stdout).trim_end()
    );
    let kib = Command::new("df").args(["-k", dir]).output().unwrap();
    let available_kib: u64 = String::from_utf8_lossy(&kib.stdout)
        .lines()
        .nth(1)
        .and_then(|line| line.split_whitespace().nth(3))
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);
    if available_kib < gib * GIB / KIB {
        println!(
            "[e2e] SKIP {test}: needs {gib} GiB free in {dir}, only {} GiB available",
            available_kib / (GIB / KIB)
        );
        return false;
    }
    true
}

fn mib_per_second(bytes: u64, elapsed: Duration) -> f64 {
    bytes as f64 / MIB as f64 / elapsed.as_secs_f64()
}

fn assert_memory_bounded(test: &str, stats: &RssStats) {
    assert_memory_below(test, stats, RSS_LIMIT_MIB);
}

fn assert_memory_below(test: &str, stats: &RssStats, limit_mib: f64) {
    report!(
        "{test}: RSS {:.0} MiB at start, peak {:.0} MiB, {:.0} MiB at the end ({} samples)",
        stats.first_mib(),
        stats.peak_mib(),
        stats.last_mib(),
        stats.samples
    );
    report!("{test}: RSS timeline {}", stats.summary(24));
    assert!(stats.samples > 0, "no RSS samples");
    assert!(
        stats.peak_mib() < limit_mib,
        "{test}: RSS peaked at {:.0} MiB, limit {limit_mib:.0} MiB",
        stats.peak_mib()
    );
}

async fn single_entry_over_4_gib(
    test: &str,
    gen: Gen,
    compression: &str,
    method: Method,
    supply_checks: bool,
) {
    let size = 4 * GIB + 1;
    if !free_disk_or_skip(test, 20) {
        return;
    }
    let heavy = Heavy::start(test).await;
    let api = heavy.api();

    let started = Instant::now();
    let generated = put_generated(api, &heavy.src, "big/entry", gen, 0xb16, size).await;
    report!(
        "{test}: uploaded {:.2} GiB in {:.1} s",
        size as f64 / GIB as f64,
        started.elapsed().as_secs_f64()
    );

    let mut entry = json!({
        "path": "big/entry.dat",
        "source": { "bucket": heavy.src, "key": "big/entry" },
        "compression": compression,
    });
    if supply_checks {
        entry["size"] = json!(generated.size);
        entry["crc32"] = json!(generated.crc32);
    }
    let spec = json!({
        "destination": { "bucket": heavy.out, "key": "zip64/one-entry.zip" },
        "entries": [entry],
    });
    let (job, elapsed, rss) = heavy.run(&unique("zip64-one"), &spec).await;
    assert_eq!(job["state"], "completed", "{job}");
    let archive_size = job["result"]["size"].as_u64().unwrap();
    report!(
        "{test}: {:.2} GiB {compression} entry -> {:.2} GiB archive in {:.1} s ({:.0} MiB/s of input)",
        size as f64 / GIB as f64,
        archive_size as f64 / GIB as f64,
        elapsed.as_secs_f64(),
        mib_per_second(size, elapsed)
    );
    assert_memory_bounded(test, &rss);

    let expected = [Expected {
        path: "big/entry.dat".into(),
        size,
        crc32: generated.crc32,
        data: None,
        method: Some(method),
    }];
    let started = Instant::now();
    let archive = verify_job_archive(
        api,
        &job,
        &heavy.out,
        "zip64/one-entry.zip",
        &expected,
        Tools::All,
    )
    .await;
    report!(
        "{test}: download and verification with every tool took {:.1} s",
        started.elapsed().as_secs_f64()
    );
    drop(archive);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "heavy: a 4 GiB + 1 entry; run with --release -- --ignored"]
async fn zip64_stored_entry_over_4_gib() {
    single_entry_over_4_gib(
        "zip64 stored 4 GiB+1",
        Gen::Random,
        "store",
        Method::Stored,
        true,
    )
    .await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "heavy: a 4 GiB + 1 entry; run with --release -- --ignored"]
async fn zip64_deflated_entry_over_4_gib() {
    single_entry_over_4_gib(
        "zip64 deflated 4 GiB+1",
        Gen::Text,
        "auto",
        Method::Deflated,
        false,
    )
    .await;
}

/// Five 1 GiB stored entries and a small deflated one after the 4 GiB mark, built twice at the
/// same time (both job slots busy).
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "heavy: two 5 GiB archives; run with --release -- --ignored"]
async fn zip64_archive_over_4_gib() {
    let test = "zip64 archive > 4 GiB";
    if !free_disk_or_skip(test, 30) {
        return;
    }
    let heavy = Heavy::start("zip64-total").await;
    let api = heavy.api();

    let part = put_generated(api, &heavy.src, "big/1g.bin", Gen::Random, 0x16, GIB).await;
    let tail = text_bytes(0x7a11, 64 * KIB as usize);
    api.put_object(
        &heavy.src,
        "small/tail.txt",
        tail.clone(),
        Some("text/plain"),
    )
    .await;

    let mut entries: Vec<Value> = (1..=5)
        .map(|index| {
            json!({
                "path": format!("part-{index}.bin"),
                "source": { "bucket": heavy.src, "key": "big/1g.bin" },
                "compression": "store",
                "size": part.size,
                "crc32": part.crc32,
            })
        })
        .collect();
    entries.push(json!({
        "path": "zz-tail.txt",
        "source": { "bucket": heavy.src, "key": "small/tail.txt" },
    }));
    let spec_for = |key: &str| {
        json!({
            "destination": { "bucket": heavy.out, "key": key },
            "entries": entries,
        })
    };

    let sampler = heavy.service.sample_rss();
    let started = Instant::now();
    let ids = [unique("zip64-total-a"), unique("zip64-total-b")];
    let keys = ["zip64/total-a.zip", "zip64/total-b.zip"];
    for (id, key) in ids.iter().zip(keys) {
        let reply = api.put_job(id, &spec_for(key), None).await;
        assert_eq!(reply.status, 202, "{}", reply.body);
    }
    let mut jobs = Vec::new();
    for id in &ids {
        jobs.push(api.wait_ended(id, JOB_LIMIT).await);
    }
    let elapsed = started.elapsed();
    let rss = sampler.stop();

    for job in &jobs {
        assert_eq!(job["state"], "completed", "{job}");
    }
    assert_eq!(jobs[0]["result"]["sha256"], jobs[1]["result"]["sha256"]);
    let archive_size = jobs[0]["result"]["size"].as_u64().unwrap();
    assert!(archive_size > 4 * GIB, "{archive_size}");
    report!(
        "{test}: two concurrent {:.2} GiB archives in {:.1} s ({:.0} MiB/s combined)",
        archive_size as f64 / GIB as f64,
        elapsed.as_secs_f64(),
        mib_per_second(2 * archive_size, elapsed)
    );
    assert_memory_bounded(test, &rss);

    let mut expected: Vec<Expected> = (1..=5)
        .map(|index| Expected {
            path: format!("part-{index}.bin"),
            size: part.size,
            crc32: part.crc32,
            data: None,
            method: Some(Method::Stored),
        })
        .collect();
    expected.push(Expected {
        path: "zz-tail.txt".into(),
        size: tail.len() as u64,
        crc32: crc32fast::hash(&tail),
        data: Some(Bytes::from(tail)),
        method: Some(Method::Deflated),
    });
    let started = Instant::now();
    let archive =
        verify_job_archive(api, &jobs[0], &heavy.out, keys[0], &expected, Tools::All).await;
    report!(
        "{test}: download and verification with every tool took {:.1} s",
        started.elapsed().as_secs_f64()
    );
    drop(archive);
}

/// More entries than a classic ZIP can count, from a few dozen small sources.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "heavy: 70,000 entries; run with --release -- --ignored"]
async fn zip64_seventy_thousand_entries() {
    let test = "zip64 70,000 entries";
    if !free_disk_or_skip(test, 5) {
        return;
    }
    let heavy = Heavy::start("zip64-many").await;
    let api = heavy.api();

    let sources: Vec<Fixture> = (0..64u64)
        .map(|index| {
            let data = match index % 8 {
                0 => Vec::new(),
                1 => random_bytes(index, 3000),
                _ => text_bytes(index, (index as usize * 131) % 8192 + 1),
            };
            Fixture::new(&format!("source-{index}"), data)
        })
        .collect();
    upload_fixtures(api, &heavy.src, &sources).await;

    let count = 70_000usize;
    let paths: Vec<String> = (0..count)
        .map(|index| format!("skills/s{:05}/f{}.md", index / 10, index % 10))
        .collect();
    let entries: Vec<Value> = paths
        .iter()
        .enumerate()
        .map(|(index, path)| {
            json!({
                "path": path,
                "source": { "bucket": heavy.src, "key": sources[index % sources.len()].key },
            })
        })
        .collect();
    let spec = json!({
        "destination": { "bucket": heavy.out, "key": "zip64/many.zip" },
        "entries": entries,
    });
    let spec_bytes = serde_json::to_vec(&spec).unwrap().len();

    let (job, elapsed, rss) = heavy.run(&unique("zip64-many"), &spec).await;
    assert_eq!(job["state"], "completed", "{job}");
    report!(
        "{test}: {count} entries ({:.1} MiB spec) -> {:.1} MiB archive in {:.1} s ({:.0} entries/s)",
        spec_bytes as f64 / MIB as f64,
        job["result"]["size"].as_u64().unwrap() as f64 / MIB as f64,
        elapsed.as_secs_f64(),
        count as f64 / elapsed.as_secs_f64()
    );
    assert_memory_bounded(test, &rss);

    let expected: Vec<Expected> = paths
        .iter()
        .enumerate()
        .map(|(index, path)| {
            let source = &sources[index % sources.len()];
            Expected {
                path: path.clone(),
                size: source.data.len() as u64,
                crc32: source.crc32(),
                data: Some(source.data.clone()),
                method: None,
            }
        })
        .collect();
    let started = Instant::now();
    let archive = verify_job_archive(
        api,
        &job,
        &heavy.out,
        "zip64/many.zip",
        &expected,
        Tools::All,
    )
    .await;
    report!(
        "{test}: download and verification with every tool took {:.1} s",
        started.elapsed().as_secs_f64()
    );
    drop(archive);
}

/// `count` one-byte entries with short paths, so a million fit in max_spec_bytes.
fn max_spec(bucket: &str, key: &str, count: usize) -> Value {
    let entries: Vec<Value> = (0..count)
        .map(|index| json!({ "path": format!("s/{index:07}"), "source": { "bucket": "src", "key": "k" } }))
        .collect();
    json!({
        "destination": { "bucket": bucket, "key": key },
        "entries": entries,
    })
}

/// With default settings an instance holds at most max_concurrent_jobs * max_entries entries
/// queued or running: two maximum-size jobs, not 66.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "heavy: two 1,000,000-entry specs; run with --release -- --ignored"]
async fn two_largest_specs_fill_the_instance() {
    let test = "2 x 1,000,000 entries";
    if !free_disk_or_skip(test, 5) {
        return;
    }
    let heavy = Heavy::start("max-specs").await;
    let api = heavy.api();
    api.create_bucket("src").await;
    api.put_object("src", "k", Bytes::from_static(b"x"), None)
        .await;

    let sampler = heavy.service.sample_rss();
    let started = Instant::now();
    let ids = [unique("max-a"), unique("max-b")];
    for (index, id) in ids.iter().enumerate() {
        let spec = max_spec(&heavy.out, &format!("max-{index}.zip"), 1_000_000);
        let reply = api.put_job(id, &spec, None).await;
        assert_eq!(reply.status, 202, "{}", reply.body);
    }
    let over = api
        .put_job(
            &unique("max-over"),
            &max_spec(&heavy.out, "over.zip", 1),
            None,
        )
        .await;
    assert_eq!(over.status, 429, "{}", over.body);
    assert_eq!(over.code(), "too_many_jobs");
    report!("{test}: third job refused: {}", over.body["error"]);

    for id in &ids {
        let job = api.wait_ended(id, JOB_LIMIT).await;
        assert_eq!(job["state"], "completed", "{job}");
    }
    let rss = sampler.stop();
    report!(
        "{test}: both completed in {:.1} s",
        started.elapsed().as_secs_f64()
    );
    assert_memory_below(test, &rss, 2.0 * MAX_SPEC_RSS_LIMIT_MIB);
}

/// The largest spec the default limits accept: max_entries entries within max_spec_bytes.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "heavy: a 1,000,000-entry spec; run with --release -- --ignored"]
async fn largest_default_spec_stays_within_memory() {
    let test = "1,000,000 entries";
    if !free_disk_or_skip(test, 5) {
        return;
    }
    let heavy = Heavy::start("max-spec").await;
    let api = heavy.api();
    api.create_bucket("src").await;
    api.put_object("src", "k", Bytes::from_static(b"x"), None)
        .await;

    let count = 1_000_000usize;
    let spec = max_spec(&heavy.out, "max.zip", count);
    let spec_bytes = serde_json::to_vec(&spec).unwrap().len();
    assert!(spec_bytes < 64 * MIB as usize, "{spec_bytes}");

    let (job, elapsed, rss) = heavy.run(&unique("max-spec"), &spec).await;
    assert_eq!(job["state"], "completed", "{job}");
    report!(
        "{test}: {:.1} MiB spec -> {:.1} MiB archive in {:.1} s",
        spec_bytes as f64 / MIB as f64,
        job["result"]["size"].as_u64().unwrap() as f64 / MIB as f64,
        elapsed.as_secs_f64()
    );
    assert_memory_below(test, &rss, MAX_SPEC_RSS_LIMIT_MIB);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "heavy: a 2 GiB source; run with --release -- --ignored"]
async fn huge_source_with_a_tiny_limit_fails_without_reading() {
    let test = "too_large on 2 GiB";
    if !free_disk_or_skip(test, 5) {
        return;
    }
    let heavy = Heavy::start("too-large").await;
    let api = heavy.api();
    put_generated(api, &heavy.src, "big/2g.bin", Gen::Random, 0x2, 2 * GIB).await;

    let spec = json!({
        "destination": { "bucket": heavy.out, "key": "never.zip" },
        "entries": [{ "path": "big.bin", "source": { "bucket": heavy.src, "key": "big/2g.bin" } }],
        "maxArchiveBytes": MIB,
    });
    let (job, elapsed, rss) = heavy.run(&unique("too-large"), &spec).await;
    assert_failed_cleanly(api, &job, "too_large", (&heavy.out, "never.zip"), None).await;
    assert_eq!(job["progress"]["bytesRead"], 0, "{job}");
    assert!(elapsed < Duration::from_secs(2), "{elapsed:?}");
    heavy
        .storage
        .assert_no_leftover_uploads(&heavy.out, "too_large")
        .await;
    report!(
        "{test}: maxArchiveBytes=1 MiB -> too_large in {:.0} ms, 0 bytes read, RSS peak {:.0} MiB",
        ms(elapsed),
        rss.peak_mib()
    );
}
