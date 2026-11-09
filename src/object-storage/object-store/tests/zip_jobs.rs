//! The zip job API over HTTP: real service instances on ephemeral ports sharing one storage,
//! covering waiting, idempotency, cancellation, leases, dead and stalled runners, shutdown,
//! concurrency limits, input validation and retention.

mod job_support;
mod pipeline_support;
mod zip_support;

use std::collections::HashSet;
use std::io::{Cursor, Read};
use std::time::{Duration, Instant};

use chrono::Utc;
use futures::future::join_all;
use job_support::*;
use object_store::zip::{ZipJobSpec, ZipSettings};
use pipeline_support::*;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use zip_support::tools::{check_zip_crate, Expected};
use zip_support::{command_exists, temp_dir};

const LIMIT: Duration = Duration::from_secs(30);

/// Takes about `chunks * delay_ms` to read.
fn slow_source(harness: &Harness, key: &str, chunk: u64, chunks: u64, delay_ms: u64) {
    let seed = key.bytes().fold(7u64, |hash, byte| {
        hash.wrapping_mul(31).wrapping_add(byte as u64)
    });
    let mut source = Synthetic::new(Content::Random, seed, chunk * chunks).chunk(chunk as usize);
    source.chunk_delay = Duration::from_millis(delay_ms);
    harness.add_generated(key, source);
}

/// One slow 2 MiB entry: a single-request archive that takes about `32 * delay_ms`.
fn slow_spec(harness: &Harness, name: &str, delay_ms: u64) -> ZipJobSpec {
    slow_source(harness, name, 64 * KIB, 32, delay_ms);
    spec(
        ARCHIVE_BUCKET,
        &format!("{name}.zip"),
        vec![
            entry("big.bin", GENERATED_BUCKET, name),
            entry("notes/readme.txt", SOURCE_BUCKET, "readme"),
        ],
    )
}

/// One slow 12 MiB entry, so the archive goes out as a multipart upload; about `48 * delay_ms`.
fn multipart_spec(harness: &Harness, name: &str, delay_ms: u64) -> ZipJobSpec {
    slow_source(harness, name, 256 * KIB, 48, delay_ms);
    spec(
        ARCHIVE_BUCKET,
        &format!("{name}.zip"),
        vec![entry("big.bin", GENERATED_BUCKET, name)],
    )
}

async fn put_readme(harness: &Harness) {
    harness
        .put(SOURCE_BUCKET, "readme", b"read me\n".repeat(100))
        .await;
}

async fn setup() -> Harness {
    let harness = Harness::new().await;
    put_readme(&harness).await;
    harness
}

async fn start(harness: &Harness, name: &str) -> Instance {
    Instance::start(&harness.backend, name, job_settings()).await
}

async fn start_short_lease(harness: &Harness, name: &str) -> Instance {
    Instance::start(&harness.backend, name, short_lease_settings()).await
}

fn sha256_hex(data: &[u8]) -> String {
    hex::encode(Sha256::digest(data))
}

fn read_archive(bytes: &[u8]) -> Vec<(String, Vec<u8>)> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
    (0..archive.len())
        .map(|index| {
            let mut file = archive.by_index(index).unwrap();
            let mut data = Vec::new();
            file.read_to_end(&mut data).unwrap();
            (file.name().to_string(), data)
        })
        .collect()
}

/// Sleeps until the stored lease of `id`, which nobody renews any more, has been expired for
/// longer than `grace`.
async fn sleep_until_presumed_dead(harness: &Harness, id: &str, grace: Duration) {
    use object_store_backends::Backend;
    let mut record = harness
        .backend
        .get_object(&format!("{JOB_RECORDS}{id}.json"))
        .await
        .unwrap();
    let mut data = Vec::new();
    while let Some(chunk) = futures::StreamExt::next(&mut record.stream).await {
        data.extend_from_slice(&chunk.unwrap());
    }
    let job: Value = serde_json::from_slice(&data).unwrap();
    let dead_at = timestamp(&job["leaseExpiresAt"])
        + chrono::Duration::from_std(grace + Duration::from_millis(200)).unwrap();
    if let Ok(left) = (dead_at - Utc::now()).to_std() {
        tokio::time::sleep(left).await;
    }
}

fn uploads_in_progress(harness: &Harness) -> usize {
    match std::fs::read_dir(harness.root().join(".uploads")) {
        Ok(entries) => entries.count(),
        Err(_) => 0,
    }
}

async fn job_records(harness: &Harness) -> Vec<String> {
    use object_store_backends::Backend;
    harness
        .backend
        .list_all_objects(Some(".metadata/zip-jobs/"))
        .await
        .unwrap()
        .into_iter()
        .map(|object| object.key)
        .collect()
}

async fn wait_for_state(instance: &Instance, id: &str, check: impl Fn(&Value) -> bool) -> Value {
    let started = Instant::now();
    loop {
        let reply = instance.get_job(id, None).await;
        if check(&reply.body) {
            return reply.body;
        }
        assert!(started.elapsed() < LIMIT, "gave up on {id}: {}", reply.body);
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}

async fn wait_until_running(instance: &Instance, id: &str) -> Value {
    wait_for_state(instance, id, |job| job["state"] == "running").await
}

async fn wait_for_multipart(harness: &Harness) {
    let started = Instant::now();
    while harness.calls().start_multipart == 0 {
        assert!(started.elapsed() < LIMIT, "no multipart upload started");
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
}

fn assert_failed(job: &Value, code: &str, retryable: bool) {
    assert_eq!(job["state"], "failed", "{job}");
    assert_eq!(job["error"]["code"], code, "{job}");
    assert_eq!(job["error"]["retryable"], retryable, "{job}");
    assert_eq!(job["leaseExpiresAt"], Value::Null, "{job}");
}

/// The SHA-256 a clean, uninterrupted run of `spec` produces.
async fn clean_sha256(instance: &Instance, id: &str, spec: &ZipJobSpec) -> String {
    let mut clean = spec.clone();
    clean.destination.key = format!("clean-{id}.zip");
    let reply = instance.put_job(id, &clean, Some(10.0)).await;
    assert_eq!(reply.status, 200, "{}", reply.body);
    assert_eq!(reply.body["state"], "completed", "{}", reply.body);
    reply.body["result"]["sha256"].as_str().unwrap().to_string()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn creates_polls_and_completes_a_job() {
    let harness = setup().await;
    let a = start(&harness, "a").await;

    let files: Vec<(&str, Vec<u8>)> = vec![
        ("docs/readme.md", b"# Hello\n".repeat(500)),
        ("docs/what?.md", b"odd name".to_vec()),
        ("data/empty.txt", Vec::new()),
    ];
    let mut entries = Vec::new();
    for (index, (path, data)) in files.iter().enumerate() {
        let key = format!("src-{index}");
        harness.put(SOURCE_BUCKET, &key, data.clone()).await;
        entries.push(entry(path, SOURCE_BUCKET, &key));
    }
    let large = Synthetic::new(Content::Text, 3, 300 * KIB);
    let large_bytes = large.bytes();
    harness.add_generated("large-text", large);
    entries.push(entry("logs/large.log", GENERATED_BUCKET, "large-text"));
    let spec = spec(ARCHIVE_BUCKET, "exports/mixed.zip", entries);

    let created = a.put_job("mixed-1", &spec, None).await;
    assert_eq!(created.status, 202, "{}", created.body);
    let job = &created.body;
    assert_eq!(job["id"], "mixed-1");
    assert_eq!(job["state"], "queued");
    assert_eq!(job["attempt"], 1);
    assert_eq!(job["owner"], "a");
    assert_eq!(job["specHash"], spec.spec_hash());
    assert!(timestamp(&job["leaseExpiresAt"]) > Utc::now());
    assert_eq!(job["result"], Value::Null);
    assert_eq!(job["error"], Value::Null);

    let job = wait_for_state(&a, "mixed-1", |job| job["state"] == "completed").await;
    assert_eq!(a.get_job("mixed-1", None).await.status, 200);
    assert_eq!(job["attempt"], 1);
    assert_eq!(job["progress"]["entriesTotal"], 4);
    assert_eq!(job["progress"]["entriesDone"], 4);
    assert_eq!(job["leaseExpiresAt"], Value::Null);
    assert!(timestamp(&job["startedAt"]) <= timestamp(&job["finishedAt"]));
    assert_eq!(
        job["result"]["renamedEntries"],
        json!([{ "path": "docs/what?.md", "archivePath": "docs/what_.md" }])
    );

    let (status, archive) = a.get_object(ARCHIVE_BUCKET, "exports/mixed.zip").await;
    assert_eq!(status, 200);
    assert_eq!(
        archive.len() as u64,
        job["result"]["size"].as_u64().unwrap()
    );
    assert_eq!(sha256_hex(&archive), job["result"]["sha256"]);
    let head = harness
        .service
        .head_object(ARCHIVE_BUCKET, "exports/mixed.zip")
        .await
        .unwrap();
    assert_eq!(head.etag, job["result"]["etag"]);

    let expected: Vec<(String, Vec<u8>)> = vec![
        ("data/empty.txt".to_string(), Vec::new()),
        ("docs/readme.md".to_string(), files[0].1.clone()),
        ("docs/what_.md".to_string(), files[1].1.clone()),
        ("logs/large.log".to_string(), large_bytes),
    ];
    assert_eq!(read_archive(&archive), expected);

    let dir = temp_dir();
    let path = dir.path().join("mixed.zip");
    std::fs::write(&path, &archive).unwrap();
    let expected: Vec<Expected> = expected
        .iter()
        .map(|(path, data)| Expected {
            path: path.clone(),
            size: data.len() as u64,
            crc32: crc32fast::hash(data),
        })
        .collect();
    check_zip_crate(&path, &expected);
    if command_exists("unzip") {
        zip_support::tools::check_unzip(&path);
    }
    if command_exists("python3") {
        zip_support::tools::check_python(&path, &expected);
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn put_with_wait_completes_a_small_archive_in_one_request() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let spec = spec(
        ARCHIVE_BUCKET,
        "small.zip",
        vec![entry("readme.txt", SOURCE_BUCKET, "readme")],
    );

    let reply = a.put_job("small", &spec, Some(10.0)).await;

    assert_eq!(reply.status, 200, "{}", reply.body);
    assert_eq!(reply.body["state"], "completed");
    assert_eq!(reply.body["attempt"], 1);
    assert!(
        reply.elapsed < Duration::from_secs(3),
        "{:?}",
        reply.elapsed
    );
    let (status, archive) = a.get_object(ARCHIVE_BUCKET, "small.zip").await;
    assert_eq!(status, 200);
    assert_eq!(
        read_archive(&archive),
        vec![("readme.txt".to_string(), b"read me\n".repeat(100))]
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn slow_jobs_return_202_and_a_waiting_get_returns_when_they_end() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let spec = slow_spec(&harness, "slow", 60);

    let reply = a.put_job("slow", &spec, Some(0.5)).await;
    assert_eq!(reply.status, 202, "{}", reply.body);
    assert!(
        reply.elapsed >= Duration::from_millis(450),
        "{:?}",
        reply.elapsed
    );
    assert!(
        reply.elapsed < Duration::from_millis(1500),
        "{:?}",
        reply.elapsed
    );
    assert!(["queued", "running"].contains(&reply.body["state"].as_str().unwrap()));

    let reply = a.get_job("slow", Some(10.0)).await;
    let answered = Utc::now();
    assert_eq!(reply.status, 200, "{}", reply.body);
    assert_eq!(reply.body["state"], "completed");
    let lag = answered - timestamp(&reply.body["finishedAt"]);
    assert!(lag < chrono::Duration::milliseconds(300), "{lag}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_waiting_get_on_another_instance_returns_when_the_owner_finishes() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let b = start(&harness, "b").await;
    let spec = slow_spec(&harness, "remote", 50);

    assert_eq!(a.put_job("remote", &spec, None).await.status, 202);
    let reply = b.get_job("remote", Some(10.0)).await;
    let answered = Utc::now();

    assert_eq!(reply.status, 200, "{}", reply.body);
    assert_eq!(reply.body["state"], "completed");
    assert_eq!(reply.body["owner"], "a");
    let lag = answered - timestamp(&reply.body["finishedAt"]);
    assert!(lag < chrono::Duration::milliseconds(700), "{lag}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_failure_inside_the_wait_window_returns_200_failed() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let spec = spec(
        ARCHIVE_BUCKET,
        "missing.zip",
        vec![
            entry("a.txt", SOURCE_BUCKET, "readme"),
            entry("b.txt", SOURCE_BUCKET, "does-not-exist"),
        ],
    );

    let reply = a.put_job("missing", &spec, Some(10.0)).await;

    assert_eq!(reply.status, 200, "{}", reply.body);
    assert_failed(&reply.body, "source_not_found", false);
    assert!(reply.elapsed < Duration::from_secs(3));
    assert!(!harness.exists(ARCHIVE_BUCKET, "missing.zip").await);
    assert_eq!(a.get_job("missing", None).await.body, reply.body);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn wait_is_clamped_to_max_wait() {
    let harness = setup().await;
    let settings = ZipSettings {
        max_wait: Duration::from_secs(1),
        ..job_settings()
    };
    let a = Instance::start(&harness.backend, "a", settings.clone()).await;
    let b = Instance::start(&harness.backend, "b", settings).await;
    let spec = slow_spec(&harness, "clamped", 150);

    let put = a.put_job("clamped", &spec, Some(30.0)).await;
    let local = a.get_job("clamped", Some(30.0)).await;
    let remote = b.get_job("clamped", Some(3600.0)).await;

    for reply in [&put, &local, &remote] {
        assert_eq!(reply.status, 202, "{}", reply.body);
        assert!(
            reply.elapsed >= Duration::from_millis(950)
                && reply.elapsed < Duration::from_millis(2000),
            "{:?}",
            reply.elapsed
        );
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn disconnected_waiters_do_not_affect_the_job() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let b = start(&harness, "b").await;
    let spec = slow_spec(&harness, "abandoned", 40);

    assert_eq!(a.put_job("abandoned", &spec, None).await.status, 202);
    let impatient = (0..5).map(|index| {
        let url = if index % 2 == 0 { &a } else { &b }.job_url("abandoned", Some(10.0));
        async move {
            reqwest::Client::new()
                .get(url)
                .timeout(Duration::from_millis(200))
                .send()
                .await
        }
    });
    for result in join_all(impatient).await {
        assert!(result.unwrap_err().is_timeout());
    }

    let reply = a.get_job("abandoned", Some(10.0)).await;
    assert_eq!(reply.status, 200);
    assert_eq!(reply.body["state"], "completed");
    assert_eq!(reply.body["attempt"], 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn re_put_joins_the_running_or_completed_job_and_409s_on_another_spec() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let b = start(&harness, "b").await;
    let spec = slow_spec(&harness, "same", 40);
    let mut reordered = spec.clone();
    reordered.entries.reverse();
    let mut other = spec.clone();
    other.destination.key = "other.zip".to_string();

    let first = a.put_job("same", &spec, None).await;
    assert_eq!(first.status, 202);
    for reply in [
        a.put_job("same", &reordered, None).await,
        b.put_job("same", &spec, None).await,
    ] {
        assert_eq!(reply.status, 202, "{}", reply.body);
        assert_eq!(reply.body["attempt"], 1);
        assert_eq!(reply.body["owner"], "a");
        assert_eq!(reply.body["createdAt"], first.body["createdAt"]);
    }

    let conflict = b.put_job("same", &other, None).await;
    assert_eq!(conflict.status, 409, "{}", conflict.body);
    assert_eq!(conflict.body["code"], "spec_conflict");

    let done = a.wait_until_ended("same", LIMIT).await;
    assert_eq!(done["state"], "completed");

    for instance in [&a, &b] {
        let again = instance.put_job("same", &reordered, Some(10.0)).await;
        assert_eq!(again.status, 200);
        assert_eq!(again.body, done);
        assert_eq!(instance.put_job("same", &other, None).await.status, 409);
    }
    assert_eq!(
        harness.calls().put_single,
        2,
        "the archive was written once"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn concurrent_puts_of_a_new_job_start_one_attempt() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let b = start(&harness, "b").await;
    let spec = slow_spec(&harness, "race", 20);

    let puts = (0..10).map(|index| {
        let instance = if index % 2 == 0 { &a } else { &b };
        instance.put_job("race", &spec, None)
    });
    let replies = join_all(puts).await;

    let owners: HashSet<String> = replies
        .iter()
        .map(|reply| {
            assert_eq!(reply.status, 202, "{}", reply.body);
            assert_eq!(reply.body["attempt"], 1);
            reply.body["owner"].as_str().unwrap().to_string()
        })
        .collect();
    assert_eq!(owners.len(), 1);
    let done = a.wait_until_ended("race", LIMIT).await;
    assert_eq!(done["state"], "completed");
    assert_eq!(done["attempt"], 1);
    a.wait_until_idle(LIMIT).await;
    b.wait_until_idle(LIMIT).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn re_put_after_failure_or_cancel_starts_a_new_attempt() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let b = start(&harness, "b").await;

    let failing = spec(
        ARCHIVE_BUCKET,
        "later.zip",
        vec![entry("later.txt", SOURCE_BUCKET, "later")],
    );
    let failed = a.put_job("later", &failing, Some(10.0)).await;
    assert_failed(&failed.body, "source_not_found", false);
    harness
        .put(SOURCE_BUCKET, "later", b"here now".to_vec())
        .await;
    let retried = b.put_job("later", &failing, Some(10.0)).await;
    assert_eq!(retried.status, 200, "{}", retried.body);
    assert_eq!(retried.body["state"], "completed");
    assert_eq!(retried.body["attempt"], 2);
    assert_eq!(retried.body["owner"], "b");
    assert_eq!(retried.body["error"], Value::Null);
    assert_eq!(retried.body["createdAt"], failed.body["createdAt"]);

    let slow = slow_spec(&harness, "canceled", 40);
    assert_eq!(a.put_job("canceled", &slow, None).await.status, 202);
    let canceled = a.delete_job("canceled").await;
    assert_eq!(canceled.status, 200);
    assert_eq!(canceled.body["state"], "canceled");
    assert_eq!(canceled.body["error"]["code"], "canceled");
    assert_eq!(canceled.body["error"]["retryable"], false);
    let restarted = a.put_job("canceled", &slow, None).await;
    assert_eq!(restarted.status, 202);
    assert_eq!(restarted.body["attempt"], 2);
    let done = a.wait_until_ended("canceled", LIMIT).await;
    assert_eq!(done["state"], "completed");
    assert_eq!(done["attempt"], 2);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn cancel_aborts_the_upload_and_leaves_an_existing_destination_untouched() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    harness
        .put(ARCHIVE_BUCKET, "cancel.zip", b"previous export".to_vec())
        .await;
    let spec = multipart_spec(&harness, "cancel", 60);

    assert_eq!(a.put_job("cancel", &spec, None).await.status, 202);
    wait_for_multipart(&harness).await;
    let canceled = a.delete_job("cancel").await;
    assert_eq!(canceled.status, 200, "{}", canceled.body);
    assert_eq!(canceled.body["state"], "canceled");
    a.wait_until_idle(Duration::from_secs(5)).await;

    assert_eq!(
        harness.read(ARCHIVE_BUCKET, "cancel.zip").await,
        b"previous export"
    );
    assert!(harness.calls().abort >= 1);
    assert_eq!(harness.calls().complete, 0);
    assert_eq!(uploads_in_progress(&harness), 0);

    let again = a.delete_job("cancel").await;
    assert_eq!(again.status, 200);
    assert_eq!(again.body, canceled.body);
    assert_eq!(a.get_job("cancel", Some(5.0)).await.body, canceled.body);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_cancel_on_another_instance_stops_the_owner_at_its_next_heartbeat() {
    let harness = setup().await;
    let frequent_heartbeats = ZipSettings {
        heartbeat_interval: Duration::from_millis(150),
        ..job_settings()
    };
    let a = Instance::start(&harness.backend, "a", frequent_heartbeats).await;
    let b = start(&harness, "b").await;
    let spec = multipart_spec(&harness, "remote-cancel", 80);

    assert_eq!(a.put_job("remote-cancel", &spec, None).await.status, 202);
    wait_for_multipart(&harness).await;
    let canceled = b.delete_job("remote-cancel").await;
    assert_eq!(canceled.body["state"], "canceled");
    let started = Instant::now();
    a.wait_until_idle(Duration::from_secs(5)).await;

    assert!(
        started.elapsed() < Duration::from_secs(1),
        "{:?}",
        started.elapsed()
    );
    assert!(!harness.exists(ARCHIVE_BUCKET, "remote-cancel.zip").await);
    assert!(harness.calls().abort >= 1);
    assert_eq!(a.get_job("remote-cancel", None).await.body, canceled.body);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_lease_check_before_committing_catches_a_cancel_between_heartbeats() {
    let harness = setup().await;
    let rare_heartbeats = ZipSettings {
        heartbeat_interval: Duration::from_secs(20),
        lease: Duration::from_secs(60),
        ..job_settings()
    };
    let a = Instance::start(&harness.backend, "a", rare_heartbeats).await;
    let b = start(&harness, "b").await;
    let spec = slow_spec(&harness, "commit-check", 25);

    let started = Instant::now();
    assert_eq!(a.put_job("commit-check", &spec, None).await.status, 202);
    wait_until_running(&b, "commit-check").await;
    assert_eq!(b.delete_job("commit-check").await.status, 200);
    a.wait_until_idle(Duration::from_secs(10)).await;

    assert!(started.elapsed() < Duration::from_secs(10));
    assert!(!harness.exists(ARCHIVE_BUCKET, "commit-check.zip").await);
    let job = a.get_job("commit-check", None).await.body;
    assert_eq!(job["state"], "canceled");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn another_instance_takes_over_once_the_lease_expires() {
    let harness = setup().await;
    let a = start_short_lease(&harness, "a").await;
    let b = start(&harness, "b").await;
    let spec = slow_spec(&harness, "takeover", 60);
    let clean = clean_sha256(&b, "takeover-clean", &spec).await;

    assert_eq!(a.put_job("takeover", &spec, None).await.status, 202);
    wait_until_running(&b, "takeover").await;
    a.freeze();
    let frozen_at = Instant::now();

    let joined = b.put_job("takeover", &spec, None).await;
    assert_eq!(joined.body["attempt"], 1, "the lease is still live");
    assert_eq!(joined.body["owner"], "a");

    let taken = loop {
        let reply = b.put_job("takeover", &spec, None).await;
        if reply.body["attempt"] == 2 {
            break reply;
        }
        assert!(
            frozen_at.elapsed() < Duration::from_secs(15),
            "{}",
            reply.body
        );
        tokio::time::sleep(Duration::from_millis(50)).await;
    };
    assert!(frozen_at.elapsed() >= Duration::from_millis(1300));
    assert_eq!(taken.status, 202);
    assert_eq!(taken.body["owner"], "b");

    let done = b.get_job("takeover", Some(10.0)).await.body;
    assert_eq!(done["state"], "completed");
    assert_eq!(done["attempt"], 2);
    assert_eq!(done["result"]["sha256"], clean);

    a.thaw();
    a.wait_until_idle(Duration::from_secs(5)).await;
    assert_eq!(b.get_job("takeover", None).await.body, done);
    let (_, archive) = b.get_object(ARCHIVE_BUCKET, "takeover.zip").await;
    assert_eq!(sha256_hex(&archive), clean);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_dead_runner_is_reported_within_a_second_of_its_lease_expiring() {
    let harness = setup().await;
    let mut a = start_short_lease(&harness, "a").await;
    let production_polling = ZipSettings {
        wait_poll_interval: Duration::from_secs(1),
        ..job_settings()
    };
    let grace = production_polling.lease_skew_grace;
    let b = Instance::start(&harness.backend, "b", production_polling).await;
    let spec = slow_spec(&harness, "dead", 60);
    let clean = clean_sha256(&b, "dead-clean", &spec).await;

    assert_eq!(a.put_job("dead", &spec, None).await.status, 202);
    wait_until_running(&b, "dead").await;
    a.kill();
    let last = b.get_job("dead", None).await.body;
    assert_eq!(last["state"], "running");
    let presumed_dead_at =
        timestamp(&last["leaseExpiresAt"]) + chrono::Duration::from_std(grace).unwrap();

    let reply = b.get_job("dead", Some(10.0)).await;
    let answered = Utc::now();

    assert_eq!(reply.status, 200, "{}", reply.body);
    assert_failed(&reply.body, "lease_expired", true);
    assert_eq!(reply.body["attempt"], 1);
    let lag = answered - presumed_dead_at;
    assert!(
        lag >= chrono::Duration::zero() && lag < chrono::Duration::milliseconds(3000),
        "{lag}"
    );

    let restarted = b.put_job("dead", &spec, Some(10.0)).await;
    assert_eq!(restarted.status, 200, "{}", restarted.body);
    assert_eq!(restarted.body["state"], "completed");
    assert_eq!(restarted.body["attempt"], 2);
    assert_eq!(restarted.body["result"]["sha256"], clean);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_stalled_runner_cannot_write_its_archive_or_overwrite_newer_state() {
    let harness = setup().await;
    let a = start_short_lease(&harness, "a").await;
    let b = start(&harness, "b").await;
    let spec = multipart_spec(&harness, "stalled", 60);

    assert_eq!(a.put_job("stalled", &spec, None).await.status, 202);
    wait_for_multipart(&harness).await;
    a.freeze();

    let marked = b.get_job("stalled", Some(10.0)).await;
    assert_eq!(marked.status, 200);
    assert_failed(&marked.body, "lease_expired", true);
    assert!(marked.body["error"]["message"]
        .as_str()
        .unwrap()
        .contains("stopped renewing"));

    a.thaw();
    a.wait_until_idle(Duration::from_secs(5)).await;
    tokio::time::sleep(Duration::from_millis(300)).await;

    assert_eq!(b.get_job("stalled", None).await.body, marked.body);
    assert!(!harness.exists(ARCHIVE_BUCKET, "stalled.zip").await);
    assert!(harness.calls().abort >= 1);
    assert_eq!(harness.calls().complete, 0);
    assert_eq!(uploads_in_progress(&harness), 0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn graceful_shutdown_interrupts_jobs_and_a_re_put_restarts_at_once() {
    let harness = setup().await;
    let mut a = start(&harness, "a").await;
    let b = start(&harness, "b").await;
    let spec = multipart_spec(&harness, "shutdown", 60);

    assert_eq!(a.put_job("shutdown", &spec, None).await.status, 202);
    wait_for_multipart(&harness).await;
    let url = a.job_url("shutdown", Some(10.0));
    let waiter = tokio::spawn(async move { request(reqwest::Method::GET, &url, None, None).await });
    a.wait_for_waiters(1, LIMIT).await;

    let took = a.shutdown().await;
    assert!(took < Duration::from_secs(3), "{took:?}");

    let waited = waiter.await.unwrap();
    assert_eq!(waited.status, 200, "{}", waited.body);
    assert_failed(&waited.body, "interrupted", true);
    assert_eq!(b.get_job("shutdown", None).await.body, waited.body);
    assert!(!harness.exists(ARCHIVE_BUCKET, "shutdown.zip").await);
    assert!(harness.calls().abort >= 1);
    assert_eq!(uploads_in_progress(&harness), 0);

    let restarted = b.put_job("shutdown", &spec, None).await;
    assert_eq!(restarted.status, 202);
    assert_eq!(restarted.body["attempt"], 2);
    assert_eq!(restarted.body["owner"], "b");
    let done = b.get_job("shutdown", Some(10.0)).await.body;
    assert_eq!(done["state"], "completed");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_panicking_job_task_fails_as_internal_and_releases_its_waiters() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    slow_source(&harness, "first", 64 * KIB, 16, 40);
    harness.add_generated("boom", Synthetic::new(Content::Random, 9, 512 * KIB));
    a.backend.panic_on_read(&format!("{GENERATED_BUCKET}/boom"));
    let spec = spec(
        ARCHIVE_BUCKET,
        "panic.zip",
        vec![
            entry("a-first.bin", GENERATED_BUCKET, "first"),
            entry("b-boom.bin", GENERATED_BUCKET, "boom"),
        ],
    );

    assert_eq!(a.put_job("panic", &spec, None).await.status, 202);
    let waiters = (0..5).map(|_| a.get_job("panic", Some(10.0)));
    let replies = join_all(waiters).await;

    for reply in &replies {
        assert_eq!(reply.status, 200, "{}", reply.body);
        assert_failed(&reply.body, "internal", true);
        assert!(
            reply.elapsed < Duration::from_secs(3),
            "{:?}",
            reply.elapsed
        );
    }
    a.wait_until_idle(Duration::from_secs(5)).await;
    assert!(!harness.exists(ARCHIVE_BUCKET, "panic.zip").await);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_failed_commit_is_a_retryable_backend_error() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let spec = multipart_spec(&harness, "commit", 0);
    a.backend.fail_next_complete();

    let failed = a.put_job("commit", &spec, Some(10.0)).await;
    assert_eq!(failed.status, 200, "{}", failed.body);
    assert_failed(&failed.body, "backend_error", true);
    assert!(!harness.exists(ARCHIVE_BUCKET, "commit.zip").await);

    let retried = a.put_job("commit", &spec, Some(10.0)).await;
    assert_eq!(retried.body["state"], "completed", "{}", retried.body);
    assert_eq!(retried.body["attempt"], 2);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn runs_at_most_max_concurrent_jobs_and_rejects_beyond_the_queue() {
    let harness = setup().await;
    let settings = ZipSettings {
        max_concurrent_jobs: 2,
        max_queued_jobs: 18,
        ..job_settings()
    };
    let a = Instance::start(&harness.backend, "a", settings).await;
    let b = start(&harness, "b").await;
    let ids: Vec<String> = (0..20).map(|index| format!("many-{index}")).collect();
    let specs: Vec<ZipJobSpec> = ids.iter().map(|id| slow_spec(&harness, id, 12)).collect();

    let submitted = join_all(
        ids.iter()
            .zip(&specs)
            .map(|(id, spec)| a.put_job(id, spec, None)),
    )
    .await;
    for reply in &submitted {
        assert_eq!(reply.status, 202, "{}", reply.body);
        assert_eq!(reply.body["state"], "queued");
    }

    let extra = slow_spec(&harness, "extra", 12);
    let rejected = a.put_job("extra", &extra, None).await;
    assert_eq!(rejected.status, 429, "{}", rejected.body);
    assert_eq!(rejected.body["code"], "too_many_jobs");
    assert_eq!(rejected.retry_after.as_deref(), Some("5"));
    assert_eq!(a.get_job("extra", None).await.status, 404);

    let started = Instant::now();
    loop {
        let now = Utc::now();
        let snapshot = join_all(ids.iter().map(|id| b.get_job(id, None))).await;
        let queued: Vec<&Value> = snapshot
            .iter()
            .map(|reply| &reply.body)
            .filter(|job| job["state"] == "queued")
            .collect();
        assert!(!queued.is_empty(), "every job already started");
        for job in &queued {
            assert!(timestamp(&job["leaseExpiresAt"]) > now, "{job}");
        }
        if queued
            .iter()
            .any(|job| timestamp(&job["updatedAt"]) > timestamp(&job["createdAt"]))
        {
            break;
        }
        assert!(started.elapsed() < LIMIT, "no queued job renewed its lease");
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    let done = join_all(ids.iter().map(|id| a.wait_until_ended(id, LIMIT))).await;
    let mut intervals = Vec::new();
    for job in &done {
        assert_eq!(job["state"], "completed", "{job}");
        assert_eq!(job["attempt"], 1, "a queued job lost its lease");
        intervals.push((timestamp(&job["startedAt"]), timestamp(&job["finishedAt"])));
    }
    let most_at_once = intervals
        .iter()
        .map(|(start, _)| {
            intervals
                .iter()
                .filter(|(other_start, other_end)| other_start <= start && start < other_end)
                .count()
        })
        .max()
        .unwrap();
    assert_eq!(most_at_once, 2);

    a.wait_until_idle(LIMIT).await;
    assert_eq!(a.put_job("extra", &extra, None).await.status, 202);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn many_waiters_all_get_the_result_promptly() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let b = start(&harness, "b").await;
    let spec = slow_spec(&harness, "crowd", 40);

    assert_eq!(a.put_job("crowd", &spec, None).await.status, 202);
    let waiters = (0..120).map(|index| {
        let instance = if index < 100 { &a } else { &b };
        async move {
            let reply = instance.get_job("crowd", Some(10.0)).await;
            (reply, Utc::now())
        }
    });
    let replies = join_all(waiters).await;

    let first = &replies[0].0.body;
    assert_eq!(first["state"], "completed");
    let finished = timestamp(&first["finishedAt"]);
    for (reply, answered) in &replies {
        assert_eq!(reply.status, 200);
        assert_eq!(&reply.body, first);
        let lag = *answered - finished;
        assert!(lag < chrono::Duration::milliseconds(1000), "{lag}");
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn remote_waiters_share_one_record_read_per_poll_interval() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let b = start(&harness, "b").await;
    let interval = job_settings().wait_poll_interval;
    let spec = slow_spec(&harness, "shared-poll", 190);

    assert_eq!(a.put_job("shared-poll", &spec, None).await.status, 202);
    let waiters = join_all((0..100).map(|_| b.get_job("shared-poll", Some(10.0))));
    let measured = async {
        b.wait_for_waiters(100, LIMIT).await;
        let before = b.backend.record_reads();
        let started = Instant::now();
        tokio::time::sleep(Duration::from_secs(2)).await;
        let reads = b.backend.record_reads() - before;
        (reads, started.elapsed())
    };
    let (replies, (reads, elapsed)) = tokio::join!(waiters, measured);

    // A poll is a HEAD and a GET of the record.
    let polls = (elapsed.as_secs_f64() / interval.as_secs_f64()).ceil() as u64 + 1;
    assert!(
        (2..=2 * polls).contains(&reads),
        "{reads} record reads in {elapsed:?} for 100 waiters"
    );
    for reply in &replies {
        assert_eq!(reply.status, 200, "{}", reply.body);
        assert_eq!(reply.body["state"], "completed");
    }
    assert_eq!(b.jobs.waiting_requests(), 0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn rejects_invalid_job_ids_without_writing_anything() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let spec = spec(
        ARCHIVE_BUCKET,
        "ids.zip",
        vec![entry("readme.txt", SOURCE_BUCKET, "readme")],
    );
    let body = serde_json::to_vec(&spec).unwrap();
    let too_long = "x".repeat(129);

    let paths = [
        "/zip-jobs/..".to_string(),
        "/zip-jobs/.".to_string(),
        "/zip-jobs/%2e%2e".to_string(),
        "/zip-jobs/%2E%2E%2Fescape".to_string(),
        "/zip-jobs/a/b".to_string(),
        "/zip-jobs/a%2Fb".to_string(),
        "/zip-jobs/../buckets".to_string(),
        "/zip-jobs/.hidden".to_string(),
        "/zip-jobs/a%20b".to_string(),
        "/zip-jobs/a%00".to_string(),
        "/zip-jobs/%FF".to_string(),
        format!("/zip-jobs/{too_long}"),
        "/zip-jobs/".to_string(),
        "/zip-jobs".to_string(),
    ];
    let url = a.url.clone();
    let statuses = tokio::task::spawn_blocking(move || {
        paths
            .iter()
            .flat_map(|path| {
                ["PUT", "GET", "DELETE"].map(|method| {
                    let body: &[u8] = if method == "PUT" { &body } else { &[] };
                    (
                        format!("{method} {path}"),
                        raw_request(&url, method, path, body),
                    )
                })
            })
            .collect::<Vec<_>>()
    })
    .await
    .unwrap();
    for (request, status) in statuses {
        assert_eq!(status, 400, "{request}");
    }

    let reply = a.put_job("a%2Fb", &spec, None).await;
    assert_eq!(reply.status, 400);
    assert_eq!(reply.body["code"], "invalid_job_id");
    assert_eq!(job_records(&harness).await, Vec::<String>::new());

    let longest = "y".repeat(128);
    assert_eq!(a.put_job(&longest, &spec, Some(10.0)).await.status, 200);
    assert_eq!(
        job_records(&harness).await,
        vec![format!(".metadata/zip-jobs/{longest}.json")]
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn rejects_oversized_and_invalid_specs_without_writing_anything() {
    let harness = setup().await;
    let settings = ZipSettings {
        max_spec_bytes: 4096,
        ..job_settings()
    };
    let a = Instance::start(&harness.backend, "a", settings).await;
    let valid = spec(
        ARCHIVE_BUCKET,
        "spec.zip",
        vec![entry("readme.txt", SOURCE_BUCKET, "readme")],
    );

    let huge = spec(
        ARCHIVE_BUCKET,
        "huge.zip",
        (0..200)
            .map(|index| entry(&format!("file-{index}.txt"), SOURCE_BUCKET, "readme"))
            .collect(),
    );
    let reply = a.put_job("huge", &huge, None).await;
    assert_eq!(reply.status, 413, "{}", reply.body);
    assert_eq!(reply.body["code"], "spec_too_large");

    let mut cases: Vec<(Vec<u8>, &str)> = vec![
        (b"{not json".to_vec(), "invalid_spec"),
        (b"".to_vec(), "invalid_spec"),
    ];
    let mut with_unknown = serde_json::to_value(&valid).unwrap();
    with_unknown["level"] = json!(3);
    cases.push((serde_json::to_vec(&with_unknown).unwrap(), "invalid_spec"));

    let mut invalid = Vec::new();
    let mut duplicate = valid.clone();
    duplicate.entries.push(duplicate.entries[0].clone());
    invalid.push((duplicate, "duplicate_path"));
    let mut bad_path = valid.clone();
    bad_path.entries[0].path = "a//b.txt".to_string();
    invalid.push((bad_path, "invalid_path"));
    let mut reserved = valid.clone();
    reserved.destination.key = ".metadata/zip-jobs/x.json".to_string();
    invalid.push((reserved, "invalid_spec"));
    let mut missing_bucket = valid.clone();
    missing_bucket.destination.bucket = "no-such-bucket".to_string();
    invalid.push((missing_bucket, "invalid_spec"));
    let mut empty = valid.clone();
    empty.entries.clear();
    invalid.push((empty, "invalid_spec"));
    for (spec, code) in invalid {
        cases.push((serde_json::to_vec(&spec).unwrap(), code));
    }

    for (index, (body, code)) in cases.into_iter().enumerate() {
        let reply = a.put_job_raw(&format!("bad-{index}"), body, None).await;
        assert_eq!(reply.status, 400, "case {index}: {}", reply.body);
        assert_eq!(reply.body["code"], code, "case {index}: {}", reply.body);
    }

    for wait in ["-1", "abc", "NaN", "inf"] {
        let reply = request(
            reqwest::Method::GET,
            &format!("{}/zip-jobs/whatever?wait={wait}", a.url),
            None,
            None,
        )
        .await;
        assert_eq!(reply.status, 400, "wait={wait}: {}", reply.body);
        assert_eq!(reply.body["code"], "invalid_request");
    }

    assert_eq!(job_records(&harness).await, Vec::<String>::new());
    assert_eq!(a.put_job("fine", &valid, Some(10.0)).await.status, 200);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn unknown_jobs_are_404() {
    let harness = setup().await;
    let a = start(&harness, "a").await;

    for reply in [
        a.get_job("nope", None).await,
        a.get_job("nope", Some(5.0)).await,
        a.delete_job("nope").await,
    ] {
        assert_eq!(reply.status, 404, "{}", reply.body);
        assert_eq!(reply.body["code"], "job_not_found");
        assert!(reply.elapsed < Duration::from_secs(1));
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn retention_deletes_only_old_ended_records() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let mut c = start_short_lease(&harness, "c").await;
    let small = spec(
        ARCHIVE_BUCKET,
        "done.zip",
        vec![entry("readme.txt", SOURCE_BUCKET, "readme")],
    );
    let missing = spec(
        ARCHIVE_BUCKET,
        "failed.zip",
        vec![entry("x.txt", SOURCE_BUCKET, "missing")],
    );
    let canceled = slow_spec(&harness, "r-canceled", 50);
    let running = slow_spec(&harness, "r-running", 400);
    let dead = slow_spec(&harness, "r-dead", 150);

    assert_eq!(a.put_job("r-done", &small, Some(10.0)).await.status, 200);
    assert_eq!(
        a.put_job("r-failed", &missing, Some(10.0)).await.status,
        200
    );
    assert_eq!(a.put_job("r-canceled", &canceled, None).await.status, 202);
    assert_eq!(a.delete_job("r-canceled").await.status, 200);
    assert_eq!(a.put_job("r-running", &running, None).await.status, 202);
    assert_eq!(c.put_job("r-dead", &dead, None).await.status, 202);
    c.kill();
    sleep_until_presumed_dead(&harness, "r-dead", job_settings().lease_skew_grace).await;
    assert_eq!(job_records(&harness).await.len(), 5);

    let an_hour_ago = Utc::now() - chrono::Duration::hours(1);
    assert_eq!(
        a.jobs.delete_records_older_than(an_hour_ago).await.unwrap(),
        0
    );
    assert_eq!(a.jobs.delete_expired_records().await.unwrap(), 0);
    assert_eq!(job_records(&harness).await.len(), 5);

    let later = Utc::now() + chrono::Duration::minutes(1);
    assert_eq!(a.jobs.delete_records_older_than(later).await.unwrap(), 4);
    assert_eq!(
        job_records(&harness).await,
        vec![".metadata/zip-jobs/r-running.json".to_string()]
    );
    assert_eq!(a.get_job("r-running", None).await.status, 202);
    assert_eq!(a.get_job("r-done", None).await.status, 404);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn job_records_are_not_reachable_through_the_object_api() {
    let harness = setup().await;
    let a = start(&harness, "a").await;
    let small = spec(
        ARCHIVE_BUCKET,
        "hidden.zip",
        vec![entry("readme.txt", SOURCE_BUCKET, "readme")],
    );
    assert_eq!(a.put_job("hidden", &small, Some(10.0)).await.status, 200);
    assert_eq!(job_records(&harness).await.len(), 1);

    for path in [
        "/buckets/.metadata/objects/zip-jobs/hidden.json",
        "/buckets/exports/objects/..%2F.metadata%2Fzip-jobs%2Fhidden.json",
        "/buckets/exports/objects/%2E%2E/.metadata/zip-jobs/hidden.json",
        "/buckets/exports/object-info/..%2F.metadata%2Fzip-jobs%2Fhidden.json",
    ] {
        let reply = request(
            reqwest::Method::GET,
            &format!("{}{path}", a.url),
            None,
            None,
        )
        .await;
        assert!(
            reply.status == 400 || reply.status == 404,
            "{path}: {}",
            reply.status
        );
    }

    let listing = request(
        reqwest::Method::GET,
        &format!("{}/buckets/exports/objects", a.url),
        None,
        None,
    )
    .await;
    let keys: Vec<&str> = listing.body["objects"]
        .as_array()
        .unwrap()
        .iter()
        .map(|object| object["key"].as_str().unwrap())
        .collect();
    assert_eq!(keys, vec!["hidden.zip"]);
}
