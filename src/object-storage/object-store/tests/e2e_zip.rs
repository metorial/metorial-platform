//! Black-box end-to-end tests of ZIP export jobs: every test starts the real
//! `object-store-service` binary as separate processes with temporary config files and talks to
//! it only over HTTP.
//!
//! Core scenarios run on the local backend always, and on S3 (SeaweedFS), Azure (Azurite) and
//! GCS (fake-gcs-server) when `scripts/test-emulators.sh` has set their variables; otherwise they
//! print a SKIP line. Multi-process lease tests need conditional writes that are atomic across
//! processes, so they only run on the cloud emulators.
//!
//! `cargo test -p object-store --test e2e_zip -- --nocapture` prints `[e2e]` measurement lines.

mod e2e_support;
mod zip_support;

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use std::time::{Duration, Instant};

use bytes::Bytes;
use e2e_support::api::raw_request;
use e2e_support::*;
use futures::StreamExt;
use serde_json::{json, Value};

macro_rules! backend_test {
    ($scenario:ident, $test:ident, $kind:expr, $turn:expr) => {
        #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
        async fn $test() {
            if let Some(_turn) = $kind.take_turn(stringify!($scenario), $turn).await {
                super::$scenario($kind).await
            }
        }
    };
}

macro_rules! on_every_backend {
    ($($scenario:ident),* $(,)?) => {$(
        mod $scenario {
            use super::*;

            backend_test!($scenario, local, BackendKind::Local, Turn::Shared);
            backend_test!($scenario, s3, BackendKind::S3, Turn::Shared);
            backend_test!($scenario, azure, BackendKind::Azure, Turn::Shared);
            backend_test!($scenario, gcs, BackendKind::Gcs, Turn::Shared);
        }
    )*};
}

/// Two instances sharing one store, timed against short leases: each takes its emulator alone.
macro_rules! on_cloud_backends {
    ($($scenario:ident),* $(,)?) => {$(
        mod $scenario {
            use super::*;

            backend_test!($scenario, s3, BackendKind::S3, Turn::Exclusive);
            backend_test!($scenario, azure, BackendKind::Azure, Turn::Exclusive);
            backend_test!($scenario, gcs, BackendKind::Gcs, Turn::Exclusive);
        }
    )*};
}

on_every_backend!(
    small_archive_completes_in_one_request,
    marketplace_export_is_valid_and_deterministic,
    awkward_names_are_renamed_and_extract_distinctly,
    multipart_archives,
    failures_leave_no_archive_and_no_upload_behind,
    cancel_retry_and_idempotency,
);

on_cloud_backends!(
    jobs_spread_over_two_instances,
    waits_on_another_instance,
    reads_race_record_rewrites,
    killed_runner_is_detected_and_restarted,
    stalled_runner_cannot_overwrite_newer_state,
    sigterm_interrupts_and_restarts_at_once,
);

struct Setup {
    service: Service,
    storage: Storage,
    src: String,
    out: String,
}

impl Setup {
    fn api(&self) -> &Api {
        &self.service.api
    }
}

async fn setup(kind: BackendKind, name: &str) -> Setup {
    setup_with(kind, name, |builder| builder).await
}

async fn setup_with(
    kind: BackendKind,
    name: &str,
    configure: impl FnOnce(ServiceBuilder) -> ServiceBuilder,
) -> Setup {
    let storage = Storage::new(kind);
    let service = configure(ServiceBuilder::new(&storage, name)).start().await;
    let src = unique("src");
    let out = unique("out");
    service.api.create_bucket(&src).await;
    service.api.create_bucket(&out).await;
    Setup {
        storage,
        service,
        src,
        out,
    }
}

fn timestamp(value: &Value) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::parse_from_rfc3339(value.as_str().unwrap_or_else(|| panic!("{value}")))
        .unwrap()
        .with_timezone(&chrono::Utc)
}

fn assert_completed(reply: &Reply) {
    assert_eq!(reply.status, 200, "{}", reply.body);
    assert_eq!(reply.state(), "completed", "{}", reply.body);
}

// 1. Small archive cheap path.

async fn small_archive_completes_in_one_request(kind: BackendKind) {
    let setup = setup(kind, "small").await;
    let api = setup.api();
    let fixtures = vec![
        Fixture::new("README.md", text_bytes(1, 2400)).expect(Method::Deflated),
        Fixture::new("src/main.py", text_bytes(2, 900)).expect(Method::Deflated),
        Fixture::new("assets/logo.png", random_bytes(3, 3000))
            .content_type("image/png")
            .expect(Method::Stored),
    ];
    upload_fixtures(api, &setup.src, &fixtures).await;

    let mut latencies = Vec::new();
    let mut first = None;
    for round in 0..6 {
        let id = unique("small");
        let key = format!("exports/small-{round}.zip");
        let spec = spec_for(&setup.out, &key, &setup.src, &fixtures);
        let reply = api.put_job(&id, &spec, Some(10.0)).await;
        assert_completed(&reply);
        assert_eq!(reply.body["attempt"], 1);
        assert_eq!(reply.body["progress"]["entriesDone"], 3);
        assert_eq!(
            reply.body["progress"]["bytesWritten"],
            reply.body["result"]["size"]
        );
        latencies.push(ms(reply.elapsed));

        let again = api.put_job(&id, &spec, Some(10.0)).await;
        assert_eq!(again.status, 200);
        assert_eq!(
            again.body, reply.body,
            "re-PUT of a completed job changed it"
        );
        first.get_or_insert((reply.body, key));
    }

    let (job, key) = first.unwrap();
    let expected = expected_entries(&fixtures, &job);
    verify_job_archive(api, &job, &setup.out, &key, &expected, Tools::All).await;

    let cold = latencies[0];
    let mut warm = latencies[1..].to_vec();
    report!(
        "small archive [{}]: 3 entries, {} bytes, one PUT ?wait=10 -> 200 completed; cold {:.1} ms, warm p50 {:.1} ms, max {:.1} ms",
        kind.name(),
        job["result"]["size"],
        cold,
        percentile(&mut warm, 0.5),
        percentile(&mut warm, 1.0),
    );
}

// 2. A realistic skills-marketplace export.

async fn build_marketplace(setup: &Setup, fixtures: &[Fixture], id: &str, key: &str) -> Value {
    let spec = spec_for(&setup.out, key, &setup.src, fixtures);
    let started = Instant::now();
    let reply = setup.api().put_job(id, &spec, Some(30.0)).await;
    let job = if reply.status == 200 {
        reply.body
    } else {
        setup.api().wait_ended(id, Duration::from_secs(300)).await
    };
    assert_eq!(job["state"], "completed", "{job}");
    report!(
        "marketplace [{}]: job {} took {:.2} s",
        setup.storage.kind.name(),
        id,
        started.elapsed().as_secs_f64()
    );
    job
}

async fn marketplace_export_is_valid_and_deterministic(kind: BackendKind) {
    let setup = setup(kind, "market").await;
    let api = setup.api();
    let fixtures = marketplace(320, 42);
    let distinct: BTreeSet<&str> = fixtures.iter().map(|f| f.key.as_str()).collect();
    let input: usize = fixtures.iter().map(|f| f.data.len()).sum();

    let started = Instant::now();
    upload_fixtures(api, &setup.src, &fixtures).await;
    report!(
        "marketplace [{}]: uploaded {} distinct sources for {} files ({:.1} MiB) in {:.2} s",
        kind.name(),
        distinct.len(),
        fixtures.len(),
        input as f64 / MIB as f64,
        started.elapsed().as_secs_f64()
    );
    assert!(fixtures.len() >= 2900, "{} files", fixtures.len());

    let job = build_marketplace(&setup, &fixtures, &unique("market"), "exports/market.zip").await;
    assert_eq!(job["result"]["renamedEntries"], json!([]));
    let expected = expected_entries(&fixtures, &job);
    verify_job_archive(
        api,
        &job,
        &setup.out,
        "exports/market.zip",
        &expected,
        Tools::All,
    )
    .await;

    let mut shuffled = fixtures.clone();
    Rng::new(7).shuffle(&mut shuffled);
    let again = build_marketplace(
        &setup,
        &shuffled,
        &unique("market-shuffled"),
        "other/prefix/market-copy.zip",
    )
    .await;
    assert_eq!(
        again["result"]["sha256"], job["result"]["sha256"],
        "the same entries in another order, under another job id and destination, gave other bytes"
    );
    assert_eq!(again["result"]["size"], job["result"]["size"]);

    let size = job["result"]["size"].as_u64().unwrap();
    report!(
        "marketplace [{}]: {} entries, {:.1} MiB in -> {:.1} MiB archive ({:.0}%), sha256 {}",
        kind.name(),
        fixtures.len(),
        input as f64 / MIB as f64,
        size as f64 / MIB as f64,
        size as f64 * 100.0 / input as f64,
        job["result"]["sha256"].as_str().unwrap()
    );

    if kind != BackendKind::Local {
        let reference = setup_with(BackendKind::Local, "market-ref", |b| b).await;
        upload_fixtures(reference.api(), &reference.src, &fixtures).await;
        let local = build_marketplace(
            &reference,
            &fixtures,
            &unique("market-ref"),
            "exports/market.zip",
        )
        .await;
        assert_eq!(
            local["result"]["sha256"],
            job["result"]["sha256"],
            "{} built different bytes than local storage",
            kind.name()
        );
        report!(
            "marketplace [{}]: sha256 identical to the local backend's",
            kind.name()
        );
    }
}

// 3. Awkward names.

async fn awkward_names_are_renamed_and_extract_distinctly(kind: BackendKind) {
    let setup = setup(kind, "names").await;
    let api = setup.api();
    let cases = awkward_names();
    let fixtures: Vec<Fixture> = cases.iter().map(|(fixture, _)| fixture.clone()).collect();
    upload_fixtures(api, &setup.src, &fixtures).await;

    let spec = spec_for(&setup.out, "exports/names.zip", &setup.src, &fixtures);
    let reply = api.put_job(&unique("names"), &spec, Some(10.0)).await;
    assert_completed(&reply);

    let renamed = renamed_map(&reply.body);
    let expected_renames: BTreeMap<String, String> = cases
        .iter()
        .filter(|(fixture, archive_path)| fixture.path != *archive_path)
        .map(|(fixture, archive_path)| (fixture.path.clone(), archive_path.to_string()))
        .collect();
    assert_eq!(renamed, expected_renames);

    let expected = expected_entries(&fixtures, &reply.body);
    verify_job_archive(
        api,
        &reply.body,
        &setup.out,
        "exports/names.zip",
        &expected,
        Tools::All,
    )
    .await;
    report!(
        "awkward names [{}]: {} entries, {} renamed and reported, all extract to distinct files on this volume",
        kind.name(),
        fixtures.len(),
        renamed.len()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn hard_path_errors_are_rejected_before_anything_is_written() {
    let setup = setup(BackendKind::Local, "badpaths").await;
    let api = setup.api();
    api.put_object(&setup.src, "k", "x", None).await;

    let cases: &[(&[&str], &str)] = &[
        (&["../x"], "invalid_path"),
        (&["a/../x"], "invalid_path"),
        (&["/abs"], "invalid_path"),
        (&["a//b"], "invalid_path"),
        (&["dir/"], "invalid_path"),
        (&["./x"], "invalid_path"),
        (&[""], "invalid_path"),
        (&["same.md", "same.md"], "duplicate_path"),
        (&["ok.md", "deep/same", "deep/same"], "duplicate_path"),
    ];
    for (index, (paths, code)) in cases.iter().enumerate() {
        let id = unique("badpath");
        let destination = format!("exports/bad-{index}.zip");
        let spec = json!({
            "destination": { "bucket": setup.out, "key": destination },
            "entries": paths.iter().map(|path| json!({
                "path": path, "source": { "bucket": setup.src, "key": "k" }
            })).collect::<Vec<_>>(),
        });
        let reply = api.put_job(&id, &spec, Some(5.0)).await;
        assert_eq!(reply.status, 400, "{paths:?}: {}", reply.body);
        assert_eq!(reply.code(), *code, "{paths:?}: {}", reply.body);
        assert_eq!(api.get_job(&id, None).await.status, 404, "{paths:?}");
        assert_eq!(api.object_status(&setup.out, &destination).await, 404);
        assert!(!setup.storage.local_job_record(&id).unwrap().exists());
    }
    assert_eq!(
        setup.storage.local_job_records().unwrap(),
        Vec::<String>::new()
    );
    report!(
        "hard path errors [local]: {} specs rejected with 400 invalid_path/duplicate_path, no record, no archive",
        cases.len()
    );
}

// 5. Multi-part archives.

async fn multipart_archives(kind: BackendKind) {
    let setup = setup_with(kind, "multipart", |b| {
        b.uploads("min_part_size_bytes", 5 * MIB)
    })
    .await;
    let api = setup.api();
    let fixtures = vec![
        Fixture::new("a/random-1.bin", random_bytes(51, (7 * MIB) as usize))
            .with_checks()
            .expect(Method::Stored),
        Fixture::new("b/random-2.bin", random_bytes(52, (7 * MIB + 333) as usize))
            .expect(Method::Stored),
        Fixture::new("c/forced-store.txt", text_bytes(53, (3 * MIB) as usize))
            .compression("store")
            .expect(Method::Stored),
        Fixture::new("d/log.txt", text_bytes(54, (6 * MIB) as usize)).expect(Method::Deflated),
        Fixture::new("e/forced-deflate.bin", random_bytes(55, (2 * MIB) as usize))
            .compression("deflate")
            .expect(Method::Deflated),
        Fixture::new("f/small.md", text_bytes(56, 4000)).expect(Method::Deflated),
        Fixture::new("g/empty", Vec::new()).expect(Method::Stored),
    ];
    upload_fixtures(api, &setup.src, &fixtures).await;

    let spec = spec_for(&setup.out, "exports/multipart.zip", &setup.src, &fixtures);
    let started = Instant::now();
    let id = unique("multipart");
    let reply = api.put_job(&id, &spec, Some(30.0)).await;
    let job = if reply.status == 200 {
        reply.body
    } else {
        api.wait_ended(&id, Duration::from_secs(300)).await
    };
    let seconds = started.elapsed().as_secs_f64();
    let expected = expected_entries(&fixtures, &job);
    verify_job_archive(
        api,
        &job,
        &setup.out,
        "exports/multipart.zip",
        &expected,
        Tools::All,
    )
    .await;

    let size = job["result"]["size"].as_u64().unwrap();
    assert!(size > 8 * MIB, "{size}");
    let etag = job["result"]["etag"].as_str().unwrap().to_string();
    let parts = etag
        .trim_matches('"')
        .rsplit_once('-')
        .and_then(|(_, parts)| parts.parse::<u32>().ok());
    if kind == BackendKind::S3 {
        let parts = parts.unwrap_or_else(|| panic!("S3 multipart ETag expected, got {etag}"));
        assert!(parts >= 3, "{parts} parts");
    }
    setup
        .storage
        .assert_no_leftover_uploads(&setup.out, "multipart")
        .await;
    report!(
        "multipart [{}]: {:.1} MiB archive in {:.2} s, etag {} ({})",
        kind.name(),
        size as f64 / MIB as f64,
        seconds,
        etag,
        parts.map_or(
            "parts not visible on this backend".to_string(),
            |p| format!("{p} parts")
        )
    );
}

// 6. Wait semantics.

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
async fn wait_semantics() {
    let setup = setup_with(BackendKind::Local, "wait", |b| b.zip("max_wait_seconds", 4)).await;
    let api = setup.api();
    let slow = SlowSource::upload(api, &setup.src).await;
    let entries = slow_entries_for(18.0);
    let id = unique("wait");
    let spec = slow.spec(&setup.out, "exports/wait.zip", entries);

    let reply = api.put_job(&id, &spec, Some(1.0)).await;
    assert_eq!(reply.status, 202, "{}", reply.body);
    assert!(
        reply.elapsed >= Duration::from_millis(950) && reply.elapsed < Duration::from_millis(2500),
        "PUT ?wait=1 took {:?}",
        reply.elapsed
    );
    let put_wait = reply.elapsed;

    let clamped = api.get_job(&id, Some(120.0)).await;
    assert_eq!(
        clamped.status, 202,
        "the job ended too soon to measure the clamp"
    );
    assert!(
        clamped.elapsed >= Duration::from_millis(3900) && clamped.elapsed < Duration::from_secs(6),
        "GET ?wait=120 with max_wait_seconds=4 took {:?}",
        clamped.elapsed
    );

    let dropped = api
        .try_request(
            reqwest::Method::GET,
            &api.job_url(&id, Some(4.0)),
            None,
            Some(Duration::from_millis(300)),
        )
        .await;
    assert!(dropped.is_err(), "the client timeout did not cut the wait");

    let second = unique("wait-dropped-put");
    let short = slow.spec(&setup.out, "exports/wait-dropped.zip", 2);
    let dropped_put = api
        .try_request(
            reqwest::Method::PUT,
            &api.job_url(&second, Some(4.0)),
            Some(serde_json::to_vec(&short).unwrap()),
            Some(Duration::from_millis(200)),
        )
        .await;
    assert!(dropped_put.is_err());

    let waiters = 100;
    let started = Instant::now();
    let results: Vec<(Value, Duration)> = futures::stream::iter(0..waiters)
        .map(|_| {
            let api = api.clone();
            let id = id.clone();
            async move {
                loop {
                    let reply = api.get_job(&id, Some(4.0)).await;
                    if reply.status == 200 {
                        return (reply.body, started.elapsed());
                    }
                    assert_eq!(reply.status, 202);
                }
            }
        })
        .buffer_unordered(waiters)
        .collect()
        .await;
    let job = results[0].0.clone();
    assert_eq!(job["state"], "completed", "{job}");
    assert!(results.iter().all(|(body, _)| *body == job));
    let first = results.iter().map(|(_, at)| *at).min().unwrap();
    let last = results.iter().map(|(_, at)| *at).max().unwrap();
    let finished = timestamp(&job["finishedAt"]);
    let lag = chrono::Utc::now()
        - finished
        - chrono::Duration::from_std(started.elapsed() - last).unwrap();

    verify_job_archive(
        api,
        &job,
        &setup.out,
        "exports/wait.zip",
        &slow.expected(entries),
        Tools::ZipCrate,
    )
    .await;

    let other = api.wait_ended(&second, Duration::from_secs(120)).await;
    assert_eq!(
        other["state"], "completed",
        "a dropped PUT ?wait affected its job: {other}"
    );
    verify_job_archive(
        api,
        &other,
        &setup.out,
        "exports/wait-dropped.zip",
        &slow.expected(2),
        Tools::ZipCrate,
    )
    .await;

    report!(
        "wait [local]: PUT ?wait=1 -> 202 after {:.0} ms; GET ?wait=120 clamped to {:.0} ms (max_wait_seconds=4); client disconnects mid-wait (GET and PUT) left both jobs running to completion",
        ms(put_wait),
        ms(clamped.elapsed)
    );
    report!(
        "wait [local]: {waiters} concurrent waiters on one job all got the identical completed job; spread {:.0} ms, last answer {:.0} ms after finishedAt",
        ms(last - first),
        lag.num_milliseconds()
    );
}

// 7. Concurrency.

fn job_pool() -> Vec<Fixture> {
    let mut pool = Vec::new();
    for index in 0..40u64 {
        let fixture = match index % 4 {
            0 => Fixture::new(&format!("docs/{index}.md"), text_bytes(900 + index, 6000)),
            1 => Fixture::new(&format!("bin/{index}.bin"), random_bytes(900 + index, 5000)),
            2 => Fixture::new(&format!("img/{index}.png"), random_bytes(900 + index, 8000)),
            _ => Fixture::new(&format!("src/{index}.rs"), text_bytes(900 + index, 3000)),
        };
        pool.push(fixture);
    }
    pool.push(Fixture::new(
        "large/streamed.log",
        text_bytes(999, (MIB + 200 * KIB) as usize),
    ));
    pool
}

fn subset(pool: &[Fixture], job: usize) -> Vec<Fixture> {
    let mut picked: Vec<Fixture> = (0..12)
        .map(|i| pool[(job * 7 + i * 3) % 40].clone())
        .collect();
    picked.sort_by(|a, b| a.path.cmp(&b.path));
    picked.dedup_by(|a, b| a.path == b.path);
    if job.is_multiple_of(5) {
        picked.push(pool[40].clone());
    }
    picked
}

fn max_overlap(jobs: &[Value]) -> usize {
    let mut events = Vec::new();
    for job in jobs {
        events.push((timestamp(&job["startedAt"]), 1i32));
        events.push((timestamp(&job["finishedAt"]), -1i32));
    }
    events.sort();
    let (mut current, mut peak) = (0i32, 0i32);
    for (_, delta) in events {
        current += delta;
        peak = peak.max(current);
    }
    peak as usize
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
async fn fifty_concurrent_jobs_on_one_instance() {
    let setup = setup_with(BackendKind::Local, "fifty", |b| {
        b.zip("max_concurrent_jobs", 2)
    })
    .await;
    let api = setup.api();
    let pool = job_pool();
    upload_fixtures(api, &setup.src, &pool).await;

    let started = Instant::now();
    let replies: Vec<(usize, String, Reply)> = futures::stream::iter(0..50usize)
        .map(|index| {
            let api = api.clone();
            let spec = spec_for(
                &setup.out,
                &format!("exports/job-{index}.zip"),
                &setup.src,
                &subset(&pool, index),
            );
            async move {
                let id = unique(&format!("fifty-{index}"));
                let reply = api.put_job(&id, &spec, Some(30.0)).await;
                (index, id, reply)
            }
        })
        .buffer_unordered(50)
        .collect()
        .await;

    let mut jobs = Vec::new();
    for (index, id, reply) in &replies {
        assert!(matches!(reply.status, 200 | 202), "{}", reply.body);
        let job = if reply.status == 200 {
            reply.body.clone()
        } else {
            api.wait_ended(id, Duration::from_secs(300)).await
        };
        let fixtures = subset(&pool, *index);
        let expected = expected_entries(&fixtures, &job);
        let tools = if *index == 0 {
            Tools::All
        } else {
            Tools::ZipCrate
        };
        verify_job_archive(
            api,
            &job,
            &setup.out,
            &format!("exports/job-{index}.zip"),
            &expected,
            tools,
        )
        .await;
        jobs.push(job);
    }
    let total = started.elapsed();
    let peak = max_overlap(&jobs);
    assert!(
        peak <= 2,
        "{peak} jobs ran at once with max_concurrent_jobs=2"
    );

    let mut by_subset: BTreeMap<usize, &Value> = BTreeMap::new();
    for ((index, _, _), job) in replies.iter().zip(&jobs) {
        let sha = &job["result"]["sha256"];
        if let Some(previous) = by_subset.insert(index % 40, sha) {
            assert_eq!(previous, sha, "jobs with the same entries differ");
        }
    }
    let immediate = replies.iter().filter(|(_, _, r)| r.status == 200).count();
    report!(
        "concurrency [local]: 50 jobs submitted at once, max_concurrent_jobs=2 -> all completed correctly in {:.2} s, at most {peak} ran at once, {immediate} answered within their ?wait=30",
        total.as_secs_f64()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn queue_cap_answers_429_with_retry_after() {
    let setup = setup_with(BackendKind::Local, "cap", |b| {
        b.zip("max_concurrent_jobs", 1).zip("max_queued_jobs", 2)
    })
    .await;
    let api = setup.api();
    let slow = SlowSource::upload(api, &setup.src).await;
    let entries = slow_entries_for(10.0);

    let mut accepted = Vec::new();
    let mut rejected = Vec::new();
    for index in 0..6 {
        let id = unique(&format!("cap-{index}"));
        let reply = api
            .put_job(
                &id,
                &slow.spec(&setup.out, &format!("exports/cap-{index}.zip"), entries),
                None,
            )
            .await;
        match reply.status {
            202 => accepted.push(id),
            429 => {
                assert_eq!(reply.code(), "too_many_jobs");
                assert_eq!(reply.retry_after.as_deref(), Some("5"));
                assert!(!setup.storage.local_job_record(&id).unwrap().exists());
                assert_eq!(api.get_job(&id, None).await.status, 404);
                rejected.push(id);
            }
            other => panic!("unexpected {other}: {}", reply.body),
        }
    }
    assert_eq!(
        accepted.len(),
        3,
        "max_concurrent_jobs=1 + max_queued_jobs=2"
    );
    assert_eq!(rejected.len(), 3);

    for id in &accepted {
        assert_eq!(api.delete_job(id).await.state(), "canceled");
    }
    let started = Instant::now();
    let retry = rejected[0].clone();
    loop {
        let reply = api
            .put_job(
                &retry,
                &slow.spec(&setup.out, "exports/cap-retry.zip", 1),
                Some(30.0),
            )
            .await;
        if reply.status == 200 {
            assert_eq!(reply.state(), "completed");
            break;
        }
        assert_eq!(reply.status, 429, "{}", reply.body);
        assert!(
            started.elapsed() < Duration::from_secs(20),
            "capacity never came back"
        );
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    setup
        .storage
        .assert_no_leftover_uploads(&setup.out, "cap")
        .await;
    report!(
        "queue cap [local]: 3 of 6 slow jobs accepted, 3 answered 429 too_many_jobs with Retry-After: 5 and no record; capacity back {:.0} ms after canceling",
        ms(started.elapsed())
    );
}

/// Queued jobs hold their spec in memory, so the queue is also bounded by entries:
/// `max_concurrent_jobs * max_entries` across queued and running jobs.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn queued_entries_are_bounded() {
    let setup = setup_with(BackendKind::Local, "entries", |b| {
        b.zip("max_concurrent_jobs", 1)
            .zip("max_queued_jobs", 64)
            .zip("max_entries", 200)
    })
    .await;
    let api = setup.api();
    let slow = SlowSource::upload(api, &setup.src).await;
    api.put_object(&setup.src, "tiny", Bytes::from_static(b"t"), None)
        .await;
    let padded = |key: &str, slow_entries: usize, total: usize| {
        let mut spec = slow.spec(&setup.out, key, slow_entries);
        let entries = spec["entries"].as_array_mut().unwrap();
        for index in slow_entries..total {
            entries.push(json!({
                "path": format!("pad/{index:04}"),
                "source": { "bucket": setup.src, "key": "tiny" },
            }));
        }
        spec
    };

    let running = unique("entries-running");
    let reply = api
        .put_job(
            &running,
            &padded("exports/running.zip", slow_entries_for(15.0), 150),
            None,
        )
        .await;
    assert_eq!(reply.status, 202, "{}", reply.body);
    let queued = unique("entries-queued");
    let reply = api
        .put_job(&queued, &padded("exports/queued.zip", 0, 50), None)
        .await;
    assert_eq!(reply.status, 202, "150 + 50 entries fit: {}", reply.body);

    let over = unique("entries-over");
    let reply = api
        .put_job(&over, &padded("exports/over.zip", 0, 1), None)
        .await;
    assert_eq!(reply.status, 429, "{}", reply.body);
    assert_eq!(reply.code(), "too_many_jobs");
    assert_eq!(reply.retry_after.as_deref(), Some("5"));
    assert!(
        reply.body["error"].as_str().unwrap().contains("entries"),
        "{}",
        reply.body
    );
    assert!(!setup.storage.local_job_record(&over).unwrap().exists());

    assert_eq!(api.delete_job(&running).await.state(), "canceled");
    let started = Instant::now();
    loop {
        let reply = api
            .put_job(&over, &padded("exports/over.zip", 0, 1), Some(10.0))
            .await;
        if reply.status == 200 {
            assert_eq!(reply.state(), "completed");
            break;
        }
        assert_eq!(reply.status, 429, "{}", reply.body);
        assert!(
            started.elapsed() < Duration::from_secs(20),
            "entry capacity never came back"
        );
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert_eq!(
        api.wait_ended(&queued, Duration::from_secs(30)).await["state"],
        "completed"
    );
    report!(
        "entry budget [local]: max_concurrent_jobs=1 x max_entries=200 -> 150 + 50 queued entries accepted, 1 more answered 429 too_many_jobs; capacity back {:.0} ms after canceling",
        ms(started.elapsed())
    );
}

/// On a case-insensitive volume the local backend stores `Job` and `job` as one record; the
/// second id must be refused rather than answer with, or change, the first job.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn job_ids_differing_only_in_case_never_alias() {
    let setup = setup(BackendKind::Local, "case").await;
    let api = setup.api();
    let fixture = Fixture::new("a.txt", text_bytes(5, 500));
    upload_fixtures(api, &setup.src, std::slice::from_ref(&fixture)).await;
    let spec = spec_for(
        &setup.out,
        "exports/case.zip",
        &setup.src,
        std::slice::from_ref(&fixture),
    );

    let probe = setup.storage.data_dir().join("CaseProbe");
    std::fs::write(&probe, b"").unwrap();
    let insensitive = setup.storage.data_dir().join("caseprobe").exists();

    let upper = format!("CaseJob-{}", unique("x"));
    let lower = upper.to_lowercase();
    let created = api.put_job(&upper, &spec, Some(10.0)).await;
    assert_completed(&created);

    let replies = [
        api.get_job(&lower, None).await,
        api.put_job(&lower, &spec, Some(10.0)).await,
        api.delete_job(&lower).await,
    ];
    for reply in &replies {
        if insensitive {
            assert_eq!(reply.status, 409, "{}", reply.body);
            assert_eq!(reply.code(), "job_id_conflict");
        } else {
            assert_ne!(reply.body["id"], json!(upper), "{}", reply.body);
        }
    }
    assert_eq!(api.get_job(&upper, None).await.body, created.body);
    report!(
        "case [local]: {} volume; {lower:?} next to {upper:?} -> {}",
        if insensitive {
            "case-insensitive"
        } else {
            "case-sensitive"
        },
        replies
            .iter()
            .map(|reply| reply.status.to_string())
            .collect::<Vec<_>>()
            .join("/")
    );
}

async fn object_round_trips(api: &Api, bucket: &str, count: usize) -> (Vec<f64>, Vec<f64>) {
    let mut puts = Vec::new();
    let mut gets = Vec::new();
    let data = Bytes::from(random_bytes(77, 256 * KIB as usize));
    for index in 0..count {
        let key = format!("traffic/{}-{index}", unique("o"));
        let started = Instant::now();
        api.put_object(bucket, &key, data.clone(), None).await;
        puts.push(ms(started.elapsed()));
        let started = Instant::now();
        let (status, body) = api.get_object(bucket, &key).await;
        gets.push(ms(started.elapsed()));
        assert_eq!(status, 200);
        assert_eq!(body.len(), data.len());
    }
    (puts, gets)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn object_traffic_keeps_working_while_zip_jobs_run() {
    let setup = setup(BackendKind::Local, "traffic").await;
    let api = setup.api();
    let slow = SlowSource::upload(api, &setup.src).await;

    let (mut idle_puts, mut idle_gets) = object_round_trips(api, &setup.src, 40).await;

    let entries = slow_entries_for(20.0);
    let mut ids = Vec::new();
    for index in 0..6 {
        let id = unique(&format!("traffic-{index}"));
        let reply = api
            .put_job(
                &id,
                &slow.spec(&setup.out, &format!("exports/t-{index}.zip"), entries),
                None,
            )
            .await;
        assert_eq!(reply.status, 202);
        ids.push(id);
    }
    api.wait_until_streaming(&ids[0]).await;

    let (mut busy_puts, mut busy_gets) = object_round_trips(api, &setup.src, 40).await;
    let running = api.get_job(&ids[1], None).await;
    assert!(
        matches!(running.state(), "running" | "queued"),
        "jobs ended before the traffic finished; make them slower"
    );

    for id in &ids {
        api.delete_job(id).await;
    }
    let busy_put_p95 = percentile(&mut busy_puts, 0.95);
    let busy_get_p95 = percentile(&mut busy_gets, 0.95);
    assert!(busy_put_p95 < 2000.0 && busy_get_p95 < 2000.0);
    report!(
        "object traffic [local]: 256 KiB PUT p50/p95 idle {:.1}/{:.1} ms vs with 2 running + 4 queued zip jobs {:.1}/{:.1} ms; GET idle {:.1}/{:.1} ms vs busy {:.1}/{:.1} ms",
        percentile(&mut idle_puts, 0.5),
        percentile(&mut idle_puts, 0.95),
        percentile(&mut busy_puts, 0.5),
        busy_put_p95,
        percentile(&mut idle_gets, 0.5),
        percentile(&mut idle_gets, 0.95),
        percentile(&mut busy_gets, 0.5),
        busy_get_p95,
    );
}

async fn jobs_spread_over_two_instances(kind: BackendKind) {
    let storage = Storage::new(kind);
    let a = ServiceBuilder::new(&storage, "spread-a").start().await;
    let b = ServiceBuilder::new(&storage, "spread-b").start().await;
    let src = unique("src");
    let out = unique("out");
    a.api.create_bucket(&src).await;
    a.api.create_bucket(&out).await;
    let pool = job_pool();
    upload_fixtures(&a.api, &src, &pool).await;

    let started = Instant::now();
    let instances = [&a, &b];
    let replies: Vec<(usize, String, Reply)> = futures::stream::iter(0..50usize)
        .map(|index| {
            let api = instances[index % 2].api.clone();
            let spec = spec_for(
                &out,
                &format!("exports/job-{index}.zip"),
                &src,
                &subset(&pool, index),
            );
            async move {
                let id = unique(&format!("spread-{index}"));
                let reply = api.put_job(&id, &spec, Some(20.0)).await;
                (index, id, reply)
            }
        })
        .buffer_unordered(50)
        .collect()
        .await;

    let mut owners = BTreeSet::new();
    for (index, id, reply) in &replies {
        assert!(matches!(reply.status, 200 | 202), "{}", reply.body);
        let other = &instances[(index + 1) % 2].api;
        let job = other.wait_ended(id, Duration::from_secs(600)).await;
        owners.insert(job["owner"].as_str().unwrap().to_string());
        let expected = expected_entries(&subset(&pool, *index), &job);
        verify_job_archive(
            &a.api,
            &job,
            &out,
            &format!("exports/job-{index}.zip"),
            &expected,
            Tools::ZipCrate,
        )
        .await;
    }
    assert_eq!(owners.len(), 2, "both instances should have run jobs");
    report!(
        "concurrency [{}]: 50 jobs alternated over 2 instances, all completed correctly in {:.2} s, read back through the other instance",
        kind.name(),
        started.elapsed().as_secs_f64()
    );
}

// 8. Failures.

async fn put_sentinel(api: &Api, bucket: &str, key: &str) -> Vec<u8> {
    let data = format!("previous object at {key}\n").into_bytes();
    api.put_object(bucket, key, data.clone(), None).await;
    data
}

async fn run_to_end(api: &Api, id: &str, spec: &Value) -> Value {
    let reply = api.put_job(id, spec, Some(30.0)).await;
    assert!(matches!(reply.status, 200 | 202), "{}", reply.body);
    if reply.status == 200 {
        reply.body
    } else {
        api.wait_ended(id, Duration::from_secs(300)).await
    }
}

async fn failures_leave_no_archive_and_no_upload_behind(kind: BackendKind) {
    let setup = setup_with(kind, "failures", |b| {
        b.uploads("min_part_size_bytes", 5 * MIB)
    })
    .await;
    let api = setup.api();
    let (src, out) = (setup.src.as_str(), setup.out.as_str());
    let present = Fixture::new("present.md", text_bytes(1, 5000));
    let big_a =
        Fixture::new("a/first.bin", random_bytes(2, (12 * MIB) as usize)).compression("store");
    let big_b =
        Fixture::new("b/second.bin", random_bytes(3, (9 * MIB) as usize)).compression("store");
    upload_fixtures(api, src, &[present.clone(), big_a.clone(), big_b.clone()]).await;
    let mut outcomes = Vec::new();

    let missing = Fixture::new("missing.md", "never uploaded");
    let key = "exports/missing.zip";
    let previous = put_sentinel(api, out, key).await;
    let job = run_to_end(
        api,
        &unique("missing"),
        &spec_for(out, key, src, &[present.clone(), missing]),
    )
    .await;
    assert_failed_cleanly(api, &job, "source_not_found", (out, key), Some(&previous)).await;
    assert_eq!(job["error"]["retryable"], false);
    outcomes.push("missing source -> source_not_found");

    let mut wrong_size = present.clone();
    wrong_size.size = Some(present.data.len() as u64 + 1);
    let key = "exports/wrong-size.zip";
    let previous = put_sentinel(api, out, key).await;
    let job = run_to_end(
        api,
        &unique("size"),
        &spec_for(out, key, src, &[wrong_size]),
    )
    .await;
    assert_failed_cleanly(api, &job, "source_changed", (out, key), Some(&previous)).await;
    assert_eq!(job["progress"]["bytesWritten"], 0);
    outcomes.push("wrong size -> source_changed before any byte was written");

    let mut wrong_crc = present.clone();
    wrong_crc.crc32 = Some(present.crc32() ^ 1);
    let key = "exports/wrong-crc.zip";
    let previous = put_sentinel(api, out, key).await;
    let job = run_to_end(api, &unique("crc"), &spec_for(out, key, src, &[wrong_crc])).await;
    assert_failed_cleanly(api, &job, "crc_mismatch", (out, key), Some(&previous)).await;
    outcomes.push("wrong crc32 (small entry) -> crc_mismatch");

    let mut late_wrong_crc = big_b.clone();
    late_wrong_crc.crc32 = Some(big_b.crc32() ^ 0x8000_0000);
    let key = "exports/late-crc.zip";
    let previous = put_sentinel(api, out, key).await;
    let job = run_to_end(
        api,
        &unique("late-crc"),
        &spec_for(out, key, src, &[big_a.clone(), late_wrong_crc]),
    )
    .await;
    assert_failed_cleanly(api, &job, "crc_mismatch", (out, key), Some(&previous)).await;
    let written = job["progress"]["bytesWritten"].as_u64().unwrap();
    assert!(
        written > 12 * MIB,
        "the mismatch should surface after multipart started ({written})"
    );
    setup
        .storage
        .assert_no_leftover_uploads(out, "late crc mismatch")
        .await;
    outcomes.push("wrong crc32 on a 9 MiB stored entry after 12 MiB uploaded -> crc_mismatch, multipart aborted");

    let key = "exports/too-large.zip";
    let previous = put_sentinel(api, out, key).await;
    let mut spec = spec_for(out, key, src, &[big_a.clone(), present.clone()]);
    spec["maxArchiveBytes"] = json!(4 * MIB);
    let reply = api.put_job(&unique("too-large"), &spec, Some(10.0)).await;
    assert_eq!(reply.status, 200);
    assert_failed_cleanly(api, &reply.body, "too_large", (out, key), Some(&previous)).await;
    assert_eq!(reply.body["progress"]["bytesRead"], 0);
    assert_eq!(reply.body["progress"]["bytesWritten"], 0);
    outcomes.push("maxArchiveBytes too small -> too_large before any read or upload");

    let slow = SlowSource::upload(api, src).await;
    let late =
        Fixture::new("z/late.bin", random_bytes(4, (2 * MIB) as usize)).key("late/source.bin");
    upload_fixtures(api, src, std::slice::from_ref(&late)).await;
    let key = "exports/changed.zip";
    let previous = put_sentinel(api, out, key).await;
    let mut spec = slow.spec(out, key, slow_entries_for(6.0));
    spec["entries"]
        .as_array_mut()
        .unwrap()
        .push(late.entry(src));
    let id = unique("changed");
    assert_eq!(api.put_job(&id, &spec, None).await.status, 202);
    api.wait_until_streaming(&id).await;
    api.put_object(src, &late.key, random_bytes(5, (2 * MIB) as usize), None)
        .await;
    let job = api.wait_ended(&id, Duration::from_secs(300)).await;
    assert_failed_cleanly(api, &job, "source_changed", (out, key), Some(&previous)).await;
    outcomes.push("source overwritten before its turn -> source_changed");

    let single_size = (if cfg!(debug_assertions) { 12 } else { 48 }) * MIB;
    let single =
        Fixture::new("only.txt", text_bytes(6, single_size as usize)).key("single/source.txt");
    upload_fixtures(api, src, std::slice::from_ref(&single)).await;
    let key = "exports/overwritten.zip";
    let previous = put_sentinel(api, out, key).await;
    let mut spec = spec_for(out, key, src, &[single.clone().compression("deflate")]);
    spec["deflateLevel"] = json!(9);
    let id = unique("overwritten");
    assert_eq!(api.put_job(&id, &spec, None).await.status, 202);
    api.wait_until_streaming(&id).await;
    api.put_object(src, &single.key, text_bytes(7, single_size as usize), None)
        .await;
    let job = api.wait_ended(&id, Duration::from_secs(300)).await;
    let overwrite_outcome = match job["state"].as_str().unwrap() {
        "completed" => {
            let expected = expected_entries(std::slice::from_ref(&single), &job);
            verify_job_archive(api, &job, out, key, &expected, Tools::ZipCrate).await;
            "completed from the version HEAD saw (consistent snapshot)"
        }
        _ => {
            assert_failed_cleanly(api, &job, "source_changed", (out, key), Some(&previous)).await;
            "source_changed"
        }
    };

    setup
        .storage
        .assert_no_leftover_uploads(out, "failures")
        .await;
    report!(
        "failures [{}]: {}; source overwritten while being read -> {}; every destination left as it was, no temp files or multipart uploads left",
        kind.name(),
        outcomes.join("; "),
        overwrite_outcome
    );
}

// 9. Lifecycle.

async fn cancel_retry_and_idempotency(kind: BackendKind) {
    let setup = setup(kind, "lifecycle").await;
    let api = setup.api();
    let (src, out) = (setup.src.as_str(), setup.out.as_str());
    let slow = SlowSource::upload(api, src).await;
    let entries = slow_entries_for(15.0);
    let key = "exports/lifecycle.zip";
    let previous = put_sentinel(api, out, key).await;
    let id = unique("lifecycle");
    let spec = slow.spec(out, key, entries);

    let created = api.put_job(&id, &spec, None).await;
    assert_eq!(created.status, 202);
    assert_eq!(created.body["attempt"], 1);
    api.wait_until_streaming(&id).await;

    let joined = api.put_job(&id, &spec, None).await;
    assert_eq!(joined.status, 202);
    assert_eq!(joined.body["attempt"], 1);
    assert_eq!(joined.body["createdAt"], created.body["createdAt"]);
    assert_eq!(joined.body["owner"], created.body["owner"]);
    assert_eq!(joined.body["specHash"], created.body["specHash"]);

    let mut other = spec.clone();
    other["deflateLevel"] = json!(1);
    let conflict = api.put_job(&id, &other, None).await;
    assert_eq!(conflict.status, 409);
    assert_eq!(conflict.code(), "spec_conflict");

    let canceled = api.delete_job(&id).await;
    assert_eq!(canceled.status, 200);
    assert_eq!(canceled.state(), "canceled");
    assert_eq!(canceled.error_code(), "canceled");
    let seen = api.get_job(&id, Some(5.0)).await;
    assert_eq!(seen.status, 200);
    assert_eq!(seen.state(), "canceled");
    assert_eq!(
        api.delete_job(&id).await.body,
        seen.body,
        "deleting an ended job changed it"
    );
    let (_, body) = api.get_object(out, key).await;
    assert!(
        body.as_ref() == previous.as_slice(),
        "cancel replaced the destination"
    );
    setup
        .storage
        .assert_no_leftover_uploads(out, "cancel")
        .await;

    let restarted = api.put_job(&id, &spec, None).await;
    assert_eq!(restarted.status, 202);
    assert_eq!(restarted.body["attempt"], 2);
    let joined = api.put_job(&id, &spec, None).await;
    assert_eq!(joined.body["attempt"], 2);
    let done = api.wait_ended(&id, Duration::from_secs(300)).await;
    assert_eq!(done["attempt"], 2);
    verify_job_archive(
        api,
        &done,
        out,
        key,
        &slow.expected(entries),
        Tools::ZipCrate,
    )
    .await;
    let again = api.put_job(&id, &spec, Some(5.0)).await;
    assert_eq!(again.status, 200);
    assert_eq!(again.body, done, "re-PUT of a completed job changed it");

    let fixed = Fixture::new("later.md", text_bytes(9, 3000));
    let key = "exports/after-failure.zip";
    let id = unique("after-failure");
    let spec = spec_for(out, key, src, std::slice::from_ref(&fixed));
    let failed = api.put_job(&id, &spec, Some(10.0)).await;
    assert_eq!(failed.state(), "failed");
    assert_eq!(failed.error_code(), "source_not_found");
    upload_fixtures(api, src, std::slice::from_ref(&fixed)).await;
    let retried = api.put_job(&id, &spec, Some(10.0)).await;
    assert_completed(&retried);
    assert_eq!(retried.body["attempt"], 2);
    assert_eq!(retried.body["createdAt"], failed.body["createdAt"]);
    let expected = expected_entries(&[fixed], &retried.body);
    verify_job_archive(api, &retried.body, out, key, &expected, Tools::ZipCrate).await;

    report!(
        "lifecycle [{}]: cancel mid-job -> canceled, destination untouched, no upload left; re-PUT while running/completed joins attempt; other spec -> 409; re-PUT after cancel -> attempt 2 completed; after a failure -> attempt 2 completed",
        kind.name()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn retention_deletes_ended_records_but_not_archives() {
    let storage = Storage::new(BackendKind::Local);
    let mut service = ServiceBuilder::new(&storage, "retention")
        .zip("job_retention_hours", 0)
        .start()
        .await;
    let api = service.api.clone();
    let (src, out) = (unique("src"), unique("out"));
    api.create_bucket(&src).await;
    api.create_bucket(&out).await;
    let fixture = Fixture::new("a.md", text_bytes(1, 100));
    upload_fixtures(&api, &src, std::slice::from_ref(&fixture)).await;
    let id = unique("retention");
    let reply = api
        .put_job(
            &id,
            &spec_for(&out, "exports/r.zip", &src, &[fixture]),
            Some(10.0),
        )
        .await;
    assert_completed(&reply);

    service.signal("TERM");
    service.wait_exit(Duration::from_secs(20)).unwrap();
    service.restart().await;
    let started = Instant::now();
    while api.get_job(&id, None).await.status != 404 {
        assert!(
            started.elapsed() < Duration::from_secs(10),
            "the record was not deleted"
        );
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert_eq!(api.object_status(&out, "exports/r.zip").await, 200);
    report!(
        "retention [local]: with job_retention_hours=0 the maintenance pass at startup deleted the ended record in {:.0} ms; the archive stayed",
        ms(started.elapsed())
    );
}

// 10. Multiple processes on one storage.

/// The same entries as the slow spec under another job id and destination; the archive must be
/// byte-identical.
async fn clean_sha256(api: &Api, slow: &SlowSource, out: &str, entries: usize) -> String {
    let id = unique("clean");
    let job = run_to_end(
        api,
        &id,
        &slow.spec(out, &format!("exports/{id}.zip"), entries),
    )
    .await;
    assert_eq!(job["state"], "completed", "{job}");
    job["result"]["sha256"].as_str().unwrap().to_string()
}

struct Pair {
    a: Service,
    b: Service,
    storage: Storage,
    src: String,
    out: String,
}

async fn pair(kind: BackendKind, name: &str) -> Pair {
    let storage = Storage::new(kind);
    let a = ServiceBuilder::new(&storage, &format!("{name}-a"))
        .short_leases()
        .zip("max_wait_seconds", 10)
        .start()
        .await;
    let b = ServiceBuilder::new(&storage, &format!("{name}-b"))
        .short_leases()
        .zip("max_wait_seconds", 10)
        .start()
        .await;
    let (src, out) = (unique("src"), unique("out"));
    a.api.create_bucket(&src).await;
    a.api.create_bucket(&out).await;
    Pair {
        storage,
        a,
        b,
        src,
        out,
    }
}

async fn waits_on_another_instance(kind: BackendKind) {
    let pair = pair(kind, "xwait").await;
    let slow = SlowSource::upload(&pair.a.api, &pair.src).await;
    let id = unique("xwait");
    let entries = slow_entries_for(6.0);
    assert_eq!(
        pair.a
            .api
            .put_job(&id, &slow.spec(&pair.out, "exports/x.zip", entries), None)
            .await
            .status,
        202
    );
    let job = loop {
        let reply = pair.b.api.get_job(&id, Some(10.0)).await;
        if reply.status == 200 {
            break reply.body;
        }
    };
    let lag = chrono::Utc::now() - timestamp(&job["finishedAt"]);
    assert_eq!(job["state"], "completed");
    assert!(lag < chrono::Duration::milliseconds(2500), "{lag}");
    verify_job_archive(
        &pair.b.api,
        &job,
        &pair.out,
        "exports/x.zip",
        &slow.expected(entries),
        Tools::ZipCrate,
    )
    .await;
    report!(
        "cross-instance wait [{}]: GET ?wait= on the other instance answered {} ms after the owner finished",
        kind.name(),
        lag.num_milliseconds()
    );
}

/// Another instance's reads race the owner's heartbeat writes; a record replaced mid-read must
/// be read again, never answered with an error.
async fn reads_race_record_rewrites(kind: BackendKind) {
    let pair = pair(kind, "race").await;
    let slow = SlowSource::upload(&pair.a.api, &pair.src).await;
    let id = unique("race");
    let reply = pair
        .a
        .api
        .put_job(
            &id,
            &slow.spec(&pair.out, "exports/race.zip", slow_entries_for(8.0)),
            None,
        )
        .await;
    assert_eq!(reply.status, 202, "{}", reply.body);

    let readers = (0..8).map(|_| {
        let api = &pair.b.api;
        let id = &id;
        async move {
            let mut reads = 0usize;
            loop {
                let reply = api.get_job(id, None).await;
                reads += 1;
                assert!(
                    matches!(reply.status, 200 | 202),
                    "read {reads} of a record being rewritten: {} {}",
                    reply.status,
                    reply.body
                );
                if reply.status == 200 {
                    return (reads, reply.body);
                }
            }
        }
    });
    let results = futures::future::join_all(readers).await;
    let reads: usize = results.iter().map(|(reads, _)| reads).sum();
    for (_, job) in &results {
        assert_eq!(job["state"], "completed", "{job}");
    }
    report!(
        "read race [{}]: {reads} reads from another instance while the owner renewed its lease every second, none failed",
        kind.name()
    );
}

async fn killed_runner_is_detected_and_restarted(kind: BackendKind) {
    let mut pair = pair(kind, "kill").await;
    let slow = SlowSource::upload(&pair.a.api, &pair.src).await;
    let entries = slow_entries_for(30.0);
    let id = unique("kill");
    let spec = slow.spec(&pair.out, "exports/kill.zip", entries);

    assert_eq!(pair.a.api.put_job(&id, &spec, None).await.status, 202);
    pair.b.api.wait_until_streaming(&id).await;
    tokio::time::sleep(Duration::from_millis(1200)).await;
    pair.a.kill();
    let killed_at = chrono::Utc::now();
    let last = pair.b.api.get_job(&id, None).await.body;
    assert_eq!(last["state"], "running", "{last}");
    let lease_expires_at = timestamp(&last["leaseExpiresAt"]);

    let failed = loop {
        let reply = pair.b.api.get_job(&id, Some(10.0)).await;
        if reply.status == 200 {
            break reply.body;
        }
    };
    let answered_at = chrono::Utc::now();
    assert_eq!(failed["state"], "failed", "{failed}");
    assert_eq!(failed["error"]["code"], "lease_expired");
    assert_eq!(failed["error"]["retryable"], true);
    let after_expiry = answered_at - lease_expires_at;
    assert!(
        after_expiry >= chrono::Duration::milliseconds(900)
            && after_expiry <= chrono::Duration::milliseconds(2600),
        "answered {after_expiry} after the lease expired (grace is 1 s, polling 1 s)"
    );
    assert_eq!(
        pair.b
            .api
            .object_status(&pair.out, "exports/kill.zip")
            .await,
        404
    );

    let restarted = pair.b.api.put_job(&id, &spec, None).await;
    assert_eq!(restarted.status, 202);
    assert_eq!(restarted.body["attempt"], 2);
    let done = pair.b.api.wait_ended(&id, Duration::from_secs(600)).await;
    assert_eq!(done["state"], "completed", "{done}");
    let clean = clean_sha256(&pair.b.api, &slow, &pair.out, entries).await;
    assert_eq!(done["result"]["sha256"], clean.as_str());
    verify_job_archive(
        &pair.b.api,
        &done,
        &pair.out,
        "exports/kill.zip",
        &slow.expected(entries),
        Tools::ZipCrate,
    )
    .await;

    report!(
        "kill -9 [{}]: lease expired {} ms after the kill; the other instance's GET ?wait= answered failed/lease_expired {} ms after leaseExpiresAt; re-PUT there completed attempt 2 with the clean run's sha256",
        kind.name(),
        (lease_expires_at - killed_at).num_milliseconds(),
        after_expiry.num_milliseconds()
    );
}

async fn stalled_runner_cannot_overwrite_newer_state(kind: BackendKind) {
    let pair = pair(kind, "stall").await;
    let slow = SlowSource::upload(&pair.a.api, &pair.src).await;
    let entries = slow_entries_for(20.0);
    let id = unique("stall");
    let key = "exports/stall.zip";
    let spec = slow.spec(&pair.out, key, entries);

    assert_eq!(pair.a.api.put_job(&id, &spec, None).await.status, 202);
    pair.b.api.wait_until_streaming(&id).await;
    pair.a.signal("STOP");
    let stopped_at = Instant::now();

    let failed = loop {
        let reply = pair.b.api.get_job(&id, Some(10.0)).await;
        if reply.status == 200 {
            break reply.body;
        }
    };
    assert_eq!(failed["error"]["code"], "lease_expired", "{failed}");
    let detected = stopped_at.elapsed();

    let restarted = pair.b.api.put_job(&id, &spec, None).await;
    assert_eq!(restarted.body["attempt"], 2);
    let done = pair.b.api.wait_ended(&id, Duration::from_secs(600)).await;
    assert_eq!(done["state"], "completed", "{done}");
    let committed = pair.b.api.object_info(&pair.out, key).await.unwrap();

    pair.a.signal("CONT");
    tokio::time::sleep(Duration::from_secs(6)).await;
    assert!(
        pair.a.api.health().await,
        "the resumed instance is unhealthy"
    );
    let after = pair.a.api.get_job(&id, None).await.body;
    assert_eq!(
        after, done,
        "the resumed runner changed the newer attempt's record"
    );
    let info = pair.b.api.object_info(&pair.out, key).await.unwrap();
    assert_eq!(info["etag"], committed["etag"]);
    assert_eq!(
        info["last_modified"], committed["last_modified"],
        "the resumed runner rewrote the archive"
    );
    verify_job_archive(
        &pair.b.api,
        &done,
        &pair.out,
        key,
        &slow.expected(entries),
        Tools::ZipCrate,
    )
    .await;
    let clean = clean_sha256(&pair.b.api, &slow, &pair.out, entries).await;
    assert_eq!(done["result"]["sha256"], clean.as_str());
    let noticed = pair.a.log().contains("lease");
    pair.storage
        .assert_no_leftover_uploads(&pair.out, "stalled runner")
        .await;

    report!(
        "SIGSTOP [{}]: survivor marked lease_expired {:.1} s after the stop; attempt 2 completed there; after SIGCONT the stale runner {} and changed neither the record nor the archive",
        kind.name(),
        detected.as_secs_f64(),
        if noticed { "logged its lost lease, aborted" } else { "aborted" }
    );
}

async fn sigterm_interrupts_and_restarts_at_once(kind: BackendKind) {
    let mut pair = pair(kind, "term").await;
    let slow = SlowSource::upload(&pair.a.api, &pair.src).await;
    let entries = slow_entries_for(20.0);
    let id = unique("term");
    let key = "exports/term.zip";
    let spec = slow.spec(&pair.out, key, entries);

    assert_eq!(pair.a.api.put_job(&id, &spec, None).await.status, 202);
    pair.b.api.wait_until_streaming(&id).await;
    let signaled = Instant::now();
    pair.a.signal("TERM");
    let interrupted = pair
        .b
        .api
        .wait_for_job(&id, Duration::from_secs(15), |job| {
            job["state"] != "running"
        })
        .await;
    let recorded = signaled.elapsed();
    assert_eq!(interrupted["state"], "failed", "{interrupted}");
    assert_eq!(interrupted["error"]["code"], "interrupted");
    assert_eq!(interrupted["error"]["retryable"], true);
    let status = pair
        .a
        .wait_exit(Duration::from_secs(20))
        .expect("no exit after SIGTERM");
    let exited = signaled.elapsed();
    assert!(status.success(), "{status}");
    assert_eq!(pair.b.api.object_status(&pair.out, key).await, 404);

    let restarted = pair.b.api.put_job(&id, &spec, None).await;
    assert_eq!(restarted.status, 202, "{}", restarted.body);
    assert_eq!(restarted.body["attempt"], 2);
    let done = pair.b.api.wait_ended(&id, Duration::from_secs(600)).await;
    verify_job_archive(
        &pair.b.api,
        &done,
        &pair.out,
        key,
        &slow.expected(entries),
        Tools::ZipCrate,
    )
    .await;
    pair.storage
        .assert_no_leftover_uploads(&pair.out, "sigterm")
        .await;

    report!(
        "SIGTERM [{}]: record was failed/interrupted {:.0} ms after the signal, process exited after {:.0} ms; immediate re-PUT on the other instance completed attempt 2",
        kind.name(),
        ms(recorded),
        ms(exited)
    );
}

// 11. Security and DoS.

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn job_id_injection_is_rejected_without_writing() {
    let setup = setup(BackendKind::Local, "ids").await;
    let api = setup.api();
    api.put_object(&setup.src, "k", "x", None).await;
    let body = serde_json::to_vec(&json!({
        "destination": { "bucket": setup.out, "key": "x.zip" },
        "entries": [{ "path": "a", "source": { "bucket": setup.src, "key": "k" } }],
    }))
    .unwrap();

    let long = format!("/zip-jobs/{}", "x".repeat(129));
    let paths: Vec<&[u8]> = vec![
        b"/zip-jobs/..",
        b"/zip-jobs/%2e%2e",
        b"/zip-jobs/%2E%2E%2Fbuckets",
        b"/zip-jobs/a%2Fb",
        b"/zip-jobs/a/b",
        b"/zip-jobs/../../etc/passwd",
        b"/zip-jobs/.hidden",
        b"/zip-jobs/a%00b",
        b"/zip-jobs/a%20b",
        b"/zip-jobs/%C3%A4",
        b"/zip-jobs/a%5Cb",
        b"/zip-jobs/",
        b"/zip-jobs",
        long.as_bytes(),
    ];
    for path in &paths {
        for method in ["PUT", "GET", "DELETE"] {
            let (status, response) = raw_request(
                &api.url,
                method,
                path,
                if method == "PUT" { &body } else { b"" },
            );
            assert_eq!(
                status,
                400,
                "{method} {}: {response}",
                String::from_utf8_lossy(path)
            );
            assert!(response.contains("invalid_job_id"), "{response}");
        }
    }
    assert_eq!(
        setup.storage.local_job_records().unwrap(),
        Vec::<String>::new()
    );
    let mut written = Vec::new();
    let mut pending = vec![setup.storage.data_dir()];
    while let Some(dir) = pending.pop() {
        for entry in std::fs::read_dir(&dir).unwrap() {
            let entry = entry.unwrap();
            if entry.file_type().unwrap().is_dir() {
                pending.push(entry.path());
            } else {
                written.push(entry.path());
            }
        }
    }
    assert!(
        written.iter().all(|path| {
            let path = path.to_string_lossy();
            path.contains("/.metadata/buckets/")
                || path.contains(&format!("/{}/", setup.src))
                || path.contains(&format!("/{}/", setup.out))
        }),
        "unexpected files: {written:?}"
    );
    report!(
        "job id injection [local]: {} paths x PUT/GET/DELETE -> 400 invalid_job_id, no record or file written",
        paths.len()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn spec_limits_are_enforced() {
    let setup = setup_with(BackendKind::Local, "limits", |b| {
        b.zip("max_spec_bytes", 256 * KIB).zip("max_entries", 1000)
    })
    .await;
    let api = setup.api();
    api.put_object(&setup.src, "k", "x", None).await;
    let entries = |count: usize| -> Vec<Value> {
        (0..count)
            .map(|index| json!({ "path": format!("f/{index}"), "source": { "bucket": setup.src, "key": "k" } }))
            .collect()
    };
    let spec = |count: usize| json!({ "destination": { "bucket": setup.out, "key": "x.zip" }, "entries": entries(count) });

    let mut huge = spec(1);
    huge["entries"][0]["path"] = json!("p".repeat(300 * KIB as usize));
    let id = unique("too-big");
    let reply = api.put_job(&id, &huge, None).await;
    assert_eq!(reply.status, 413, "{}", reply.body);
    assert_eq!(reply.code(), "spec_too_large");

    let id_many = unique("too-many");
    let reply = api.put_job(&id_many, &spec(1001), None).await;
    assert_eq!(reply.status, 400, "{}", reply.body);
    assert_eq!(reply.code(), "invalid_spec");

    let bad_bodies: Vec<(&str, Vec<u8>)> = vec![
        ("malformed JSON", b"{\"destination\":".to_vec()),
        ("not an object", b"[]".to_vec()),
        ("unknown field", serde_json::to_vec(&json!({"destination": {"bucket": setup.out, "key": "x.zip"}, "entries": entries(1), "acl": "public"})).unwrap()),
        ("deflateLevel 10", serde_json::to_vec(&json!({"destination": {"bucket": setup.out, "key": "x.zip"}, "entries": entries(1), "deflateLevel": 10})).unwrap()),
        ("compression zstd", serde_json::to_vec(&json!({"destination": {"bucket": setup.out, "key": "x.zip"}, "entries": [{"path": "a", "source": {"bucket": setup.src, "key": "k"}, "compression": "zstd"}]})).unwrap()),
        ("no entries", serde_json::to_vec(&json!({"destination": {"bucket": setup.out, "key": "x.zip"}, "entries": []})).unwrap()),
        ("crc32 above u32", serde_json::to_vec(&json!({"destination": {"bucket": setup.out, "key": "x.zip"}, "entries": [{"path": "a", "source": {"bucket": setup.src, "key": "k"}, "crc32": 4294967296u64}]})).unwrap()),
        ("maxArchiveBytes above the service limit", serde_json::to_vec(&json!({"destination": {"bucket": setup.out, "key": "x.zip"}, "entries": entries(1), "maxArchiveBytes": 1u64 << 41})).unwrap()),
    ];
    for (what, body) in &bad_bodies {
        let reply = api.put_job_body(&unique("bad"), body.clone(), None).await;
        assert_eq!(reply.status, 400, "{what}: {}", reply.body);
        assert_eq!(reply.code(), "invalid_spec", "{what}: {}", reply.body);
    }
    for wait in ["-1", "abc", "NaN", "inf"] {
        let url = format!("{}/zip-jobs/{}?wait={wait}", api.url, unique("w"));
        let reply = api
            .request(
                reqwest::Method::PUT,
                &url,
                Some(serde_json::to_vec(&spec(1)).unwrap()),
                None,
            )
            .await;
        assert_eq!(reply.status, 400, "wait={wait}: {}", reply.body);
        assert_eq!(reply.code(), "invalid_request");
    }
    assert_eq!(
        setup.storage.local_job_records().unwrap(),
        Vec::<String>::new()
    );

    let reply = api
        .put_job(&unique("at-limit"), &spec(1000), Some(10.0))
        .await;
    assert_completed(&reply);

    let default = setup_with(BackendKind::Local, "default-limits", |b| b).await;
    default.api().put_object(&default.src, "k", "x", None).await;
    let mut large =
        json!({ "destination": { "bucket": default.out, "key": "x.zip" }, "entries": [] });
    let count = 20_000;
    large["entries"] = json!((0..count)
        .map(|index| json!({ "path": format!("files/a-fairly-long-directory-name/{index:08}.md"), "source": { "bucket": default.src, "key": "k" } }))
        .collect::<Vec<_>>());
    let size = serde_json::to_vec(&large).unwrap().len();
    assert!(size > 2 * MIB as usize, "{size}");
    let reply = default
        .api()
        .put_job(&unique("large-spec"), &large, Some(30.0))
        .await;
    assert!(matches!(reply.status, 200 | 202), "{}", reply.body);

    report!(
        "spec limits [local]: {} KiB body over max_spec_bytes -> 413; max_entries+1 -> 400; {} malformed specs and 4 bad waits -> 400 with no record; {} entries at the limit completed; a {:.1} MiB spec (over axum's 2 MiB default) accepted with default settings",
        300,
        bad_bodies.len(),
        1000,
        size as f64 / MIB as f64
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn reserved_sources_and_destinations_are_rejected() {
    let setup = setup(BackendKind::Local, "reserved").await;
    let api = setup.api();
    let (src, out) = (setup.src.as_str(), setup.out.as_str());
    api.put_object(src, "k", "x", None).await;
    api.put_object(out, "exports/a.zip", "x", None).await;

    let existing = unique("existing");
    let reply = api
        .put_job(&existing, &json!({ "destination": { "bucket": out, "key": "e.zip" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": "k" } }] }), Some(10.0))
        .await;
    assert_completed(&reply);

    let rejected: Vec<(&str, Value)> = vec![
        (
            "source bucket .metadata",
            json!({ "destination": { "bucket": out, "key": "x.zip" }, "entries": [{ "path": "a", "source": { "bucket": ".metadata", "key": format!("zip-jobs/{existing}.json") } }] }),
        ),
        (
            "source key ../",
            json!({ "destination": { "bucket": out, "key": "x.zip" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": "../.metadata/buckets/x.json" } }] }),
        ),
        (
            "source key a/../../",
            json!({ "destination": { "bucket": out, "key": "x.zip" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": "a/../../etc" } }] }),
        ),
        (
            "source key /abs",
            json!({ "destination": { "bucket": out, "key": "x.zip" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": "/etc/passwd" } }] }),
        ),
        (
            "source key .bucket",
            json!({ "destination": { "bucket": out, "key": "x.zip" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": ".bucket" } }] }),
        ),
        (
            "destination .metadata/",
            json!({ "destination": { "bucket": out, "key": ".metadata/zip-jobs/evil.json" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": "k" } }] }),
        ),
        (
            "destination .METADATA/",
            json!({ "destination": { "bucket": out, "key": ".METADATA/x" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": "k" } }] }),
        ),
        (
            "destination .uploads/",
            json!({ "destination": { "bucket": out, "key": ".uploads/x" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": "k" } }] }),
        ),
        (
            "destination .bucket",
            json!({ "destination": { "bucket": out, "key": ".bucket" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": "k" } }] }),
        ),
        (
            "destination x/.bucket",
            json!({ "destination": { "bucket": out, "key": "x/.bucket" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": "k" } }] }),
        ),
        (
            "destination ../",
            json!({ "destination": { "bucket": out, "key": "../escape.zip" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": "k" } }] }),
        ),
        (
            "destination bucket .metadata",
            json!({ "destination": { "bucket": ".metadata", "key": "x.zip" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": "k" } }] }),
        ),
        (
            "destination is a source",
            json!({ "destination": { "bucket": out, "key": "exports/a.zip" }, "entries": [{ "path": "a", "source": { "bucket": out, "key": "exports/a.zip" } }] }),
        ),
        (
            "destination is a source modulo //",
            json!({ "destination": { "bucket": out, "key": "exports//a.zip" }, "entries": [{ "path": "a", "source": { "bucket": out, "key": "exports/a.zip" } }] }),
        ),
        (
            "missing destination bucket",
            json!({ "destination": { "bucket": "no-such-bucket", "key": "x.zip" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": "k" } }] }),
        ),
    ];
    let records_before = setup.storage.local_job_records().unwrap();
    for (what, spec) in &rejected {
        let id = unique("reserved");
        let reply = api.put_job(&id, spec, Some(5.0)).await;
        assert_eq!(reply.status, 400, "{what}: {}", reply.body);
        assert_eq!(reply.code(), "invalid_spec", "{what}: {}", reply.body);
        assert_eq!(api.get_job(&id, None).await.status, 404);
    }
    assert_eq!(setup.storage.local_job_records().unwrap(), records_before);

    let id = unique("own-namespace");
    let reply = api
        .put_job(&id, &json!({ "destination": { "bucket": out, "key": "y.zip" }, "entries": [{ "path": "a", "source": { "bucket": src, "key": format!(".metadata/zip-jobs/{existing}.json") } }] }), Some(10.0))
        .await;
    assert_eq!(reply.state(), "failed");
    assert_eq!(
        reply.error_code(),
        "source_not_found",
        "a bucket's .metadata/ key must not reach service records"
    );
    assert_eq!(api.object_status(out, "y.zip").await, 404);
    assert_eq!(api.object_status(out, "exports/a.zip").await, 200);
    report!(
        "reserved names [local]: {} source/destination specs reaching for service state -> 400 invalid_spec without a record; a bucket's own .metadata/ key is just a missing object",
        rejected.len()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn huge_source_with_a_tiny_limit_fails_without_reading() {
    let setup = setup(BackendKind::Local, "huge").await;
    let api = setup.api();
    let size = 64 * MIB;
    put_generated(api, &setup.src, "huge.bin", Gen::Random, 1, size).await;
    let spec = json!({
        "destination": { "bucket": setup.out, "key": "huge.zip" },
        "entries": [{ "path": "huge.bin", "source": { "bucket": setup.src, "key": "huge.bin" } }],
        "maxArchiveBytes": MIB,
    });
    let reply = api.put_job(&unique("huge"), &spec, Some(10.0)).await;
    assert_eq!(reply.status, 200);
    assert_eq!(reply.error_code(), "too_large");
    assert_eq!(reply.body["progress"]["bytesRead"], 0);
    assert!(
        reply.elapsed < Duration::from_secs(1),
        "{:?}",
        reply.elapsed
    );
    report!(
        "huge source [local]: {} MiB source with maxArchiveBytes=1 MiB -> too_large in {:.0} ms with 0 bytes read",
        size / MIB,
        ms(reply.elapsed)
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
async fn a_flood_of_jobs_is_bounded() {
    let setup = setup(BackendKind::Local, "flood").await;
    let api = setup.api();
    let slow = SlowSource::upload(api, &setup.src).await;
    let baseline = setup.service.rss_kib().unwrap();
    let sampler = setup.service.sample_rss();

    let health = {
        let api = api.clone();
        tokio::spawn(async move {
            let mut worst = Duration::ZERO;
            for _ in 0..40 {
                let started = Instant::now();
                assert!(api.health().await, "unhealthy during the flood");
                worst = worst.max(started.elapsed());
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
            worst
        })
    };

    let entries = slow_entries_for(60.0);
    let started = Instant::now();
    let replies: Vec<(String, Reply)> = futures::stream::iter(0..1000usize)
        .map(|index| {
            let api = api.clone();
            let spec = slow.spec(&setup.out, &format!("flood/{index}.zip"), entries);
            async move {
                let id = unique(&format!("flood-{index}"));
                let reply = api.put_job(&id, &spec, None).await;
                (id, reply)
            }
        })
        .buffer_unordered(100)
        .collect()
        .await;
    let flood_time = started.elapsed();
    let worst_health = health.await.unwrap();

    let accepted: Vec<&String> = replies
        .iter()
        .filter(|(_, r)| r.status == 202)
        .map(|(id, _)| id)
        .collect();
    let rejected = replies.iter().filter(|(_, r)| r.status == 429).count();
    assert_eq!(accepted.len() + rejected, 1000, "only 202 and 429 expected");
    assert!(
        (66..=70).contains(&accepted.len()),
        "{} accepted; capacity is 2 running + 64 queued",
        accepted.len()
    );
    assert!(replies
        .iter()
        .filter(|(_, r)| r.status == 429)
        .all(|(_, r)| r.retry_after.as_deref() == Some("5")));

    for id in &accepted {
        assert_eq!(api.delete_job(id).await.state(), "canceled");
    }
    let idle_at = Instant::now();
    loop {
        let reply = api
            .put_job(
                &unique("after-flood"),
                &slow.spec(&setup.out, "flood/after.zip", 1),
                Some(30.0),
            )
            .await;
        if reply.status == 200 {
            assert_eq!(reply.state(), "completed");
            break;
        }
        assert!(
            idle_at.elapsed() < Duration::from_secs(30),
            "{}",
            reply.body
        );
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    let rss = sampler.stop();
    assert!(api.health().await);
    let records = setup.storage.local_job_records().unwrap().len();
    assert!(
        records <= 71,
        "{records} records for {} accepted jobs",
        accepted.len()
    );
    assert!(
        rss.peak_kib < baseline + 300 * 1024,
        "RSS grew from {} to {} KiB",
        baseline,
        rss.peak_kib
    );
    report!(
        "flood [local]: 1000 PUTs (100 at a time) in {:.2} s -> {} accepted, {} x 429 Retry-After: 5; /health worst {:.0} ms during the flood; {} records written; RSS {:.0} -> peak {:.0} MiB; new job completed after canceling",
        flood_time.as_secs_f64(),
        accepted.len(),
        rejected,
        ms(worst_health),
        records,
        baseline as f64 / 1024.0,
        rss.peak_mib()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
async fn many_waiters_do_not_grow_memory() {
    let setup = setup(BackendKind::Local, "waiters").await;
    let api = setup.api();
    let slow = SlowSource::upload(api, &setup.src).await;
    let id = unique("waiters");
    let entries = slow_entries_for(15.0);
    assert_eq!(
        api.put_job(&id, &slow.spec(&setup.out, "w.zip", entries), None)
            .await
            .status,
        202
    );
    api.wait_until_streaming(&id).await;
    let before = setup.service.rss_kib().unwrap();
    let sampler = setup.service.sample_rss();

    let waiters = 500;
    let api_arc = Arc::new(api.clone());
    let statuses: Vec<u16> = futures::stream::iter(0..waiters)
        .map(|_| {
            let api = api_arc.clone();
            let id = id.clone();
            async move { api.get_job(&id, Some(3.0)).await.status }
        })
        .buffer_unordered(waiters)
        .collect()
        .await;
    let rss = sampler.stop();
    assert!(statuses.iter().all(|status| matches!(status, 200 | 202)));
    let growth = rss.peak_kib.saturating_sub(before);
    assert!(
        growth < 64 * 1024,
        "{waiters} waiters grew RSS by {growth} KiB"
    );
    api.delete_job(&id).await;
    report!(
        "waiters [local]: {waiters} concurrent GET ?wait=3 on a running job: RSS {:.0} -> peak {:.0} MiB (+{:.1} MiB), all answered",
        before as f64 / 1024.0,
        rss.peak_mib(),
        growth as f64 / 1024.0
    );
}
