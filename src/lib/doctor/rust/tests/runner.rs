use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use lowerdeck_doctor::{
    parse_report, Category, Check, CheckError, CodedError, Doctor, ErrorKind, Options, Outcome,
    RegisterError, Resolution, Severity, Status,
};
use serde_json::json;
use tokio::sync::Semaphore;

fn options() -> Options {
    Options {
        instance: Some("test-0".into()),
        ..Options::new("test")
    }
}

fn doctor_with(options: Options, checks: Vec<Check>) -> Doctor {
    let doctor = Doctor::new(options);
    for check in checks {
        doctor.register(check).unwrap();
    }
    doctor
}

fn check_with<F, Fut>(id: &str, run: F) -> Check
where
    F: Fn(lowerdeck_doctor::CheckContext) -> Fut + Send + Sync + 'static,
    Fut: std::future::Future<Output = Result<Outcome, CheckError>> + Send + 'static,
{
    Check::new(id, id, Category::Runtime, Severity::Critical, run)
}

fn passing(id: &str) -> Check {
    check_with(id, |_| async { Ok(Outcome::pass("OK")) })
}

fn failing(id: &str) -> Check {
    check_with(id, |_| async { Ok(Outcome::fail("broken")) })
}

fn counted(calls: &Arc<AtomicUsize>) -> Check {
    let calls = calls.clone();
    check_with("counted", move |_| {
        calls.fetch_add(1, Ordering::SeqCst);
        async { Ok(Outcome::pass("OK")) }
    })
}

struct Gate {
    calls: Arc<AtomicUsize>,
    open: Arc<Semaphore>,
}

impl Gate {
    fn new() -> Self {
        Self {
            calls: Arc::new(AtomicUsize::new(0)),
            open: Arc::new(Semaphore::new(0)),
        }
    }

    fn check(&self) -> Check {
        let calls = self.calls.clone();
        let open = self.open.clone();
        check_with("gated", move |_| {
            calls.fetch_add(1, Ordering::SeqCst);
            let open = open.clone();
            async move {
                let _permit = open.acquire().await?;
                Ok(Outcome::pass("OK"))
            }
        })
    }

    async fn started(&self) {
        while self.calls.load(Ordering::SeqCst) == 0 {
            tokio::task::yield_now().await;
        }
    }

    fn release(&self) {
        self.open.add_permits(1_000);
    }
}

#[tokio::test]
async fn report_identity_order_and_validity() {
    let doctor = doctor_with(
        Options {
            release_version: Some("2026.11.1".into()),
            build_version: Some("abc123".into()),
            channel: Some(" ".into()),
            public_url: Some("https://metorial.example.com".into()),
            fingerprints: [("database".to_string(), "f00".to_string())].into(),
            ..options()
        },
        vec![passing("b.second"), passing("a.first"), passing("c.third")],
    );

    let report = doctor.run(false).await.unwrap();

    assert_eq!(
        (
            report.doctor,
            report.component.as_str(),
            report.instance.as_str()
        ),
        (1, "test", "test-0")
    );
    assert_eq!(report.release_version.as_deref(), Some("2026.11.1"));
    assert_eq!(report.build_version.as_deref(), Some("abc123"));
    assert_eq!(report.channel, None);
    assert_eq!(report.run_id.len(), 12);
    assert!(!report.cached);

    let ids: Vec<&str> = report
        .checks
        .iter()
        .map(|check| check.id.as_str())
        .collect();
    assert_eq!(ids, ["b.second", "a.first", "c.third"]);

    let encoded = serde_json::to_vec(&report).unwrap();
    parse_report(&encoded).expect("own report validates");
}

#[tokio::test]
async fn outcomes_resolutions_and_redaction() {
    let resolution = Resolution::new("Grant kms:Encrypt").step("Edit the key policy");

    let doctor = doctor_with(
        options(),
        vec![
            check_with("kms.encrypt", |_| async {
                Ok(Outcome::fail("denied at https://kms.local/?token=abc")
                    .with_details(json!({ "password": "hunter2", "region": "eu-west-1" })))
            })
            .target("postgres://app:hunter2@db/core")
            .resolution(resolution.clone()),
            passing("kms.pass").resolution(resolution.clone()),
            check_with("kms.warn", |_| async {
                Ok(Outcome::warn("slow").with_resolution(Resolution::new("Own resolution")))
            })
            .resolution(resolution.clone()),
            check_with("kms.error", |_| async {
                Err(CodedError::new("KMSInvalidStateException", "key disabled").into())
            }),
            check_with("kms.panic", |_| async { panic!("kaboom") }),
        ],
    );

    let report = doctor.run(false).await.unwrap();
    let get = |id: &str| report.checks.iter().find(|check| check.id == id).unwrap();

    let failed = get("kms.encrypt");
    assert_eq!(failed.status, Status::Fail);
    assert_eq!(failed.message, "denied at https://kms.local/?token=***");
    assert_eq!(failed.target.as_deref(), Some("postgres://app:***@db/core"));
    assert_eq!(failed.details.as_ref().unwrap()["password"], "***");
    assert_eq!(failed.resolution.as_ref(), Some(&resolution));

    assert_eq!(get("kms.pass").resolution, None);
    assert_eq!(
        get("kms.warn").resolution.as_ref().unwrap().summary,
        "Own resolution"
    );

    let errored = get("kms.error");
    assert_eq!(errored.status, Status::Error);
    assert_eq!(
        errored.details.as_ref().unwrap()["error"]["kind"],
        "invalid_state"
    );
    assert_eq!(
        errored.resolution.as_ref().unwrap().summary,
        ErrorKind::InvalidState.hint().unwrap()
    );

    let panicked = get("kms.panic");
    assert_eq!(
        (panicked.status, panicked.message.as_str()),
        (Status::Error, "Check panicked: kaboom")
    );
}

#[tokio::test(start_paused = true)]
async fn timeout_and_run_budget() {
    let never = || check_with("slow", |_| std::future::pending());

    let doctor = doctor_with(options(), vec![never().timeout(Duration::from_millis(20))]);
    let result = &doctor.run(false).await.unwrap().checks[0];
    assert_eq!(
        (result.status, result.message.as_str()),
        (Status::Timeout, "Timed out after 20ms.")
    );

    let doctor = doctor_with(
        Options {
            run_budget: Some(Duration::from_millis(30)),
            ..options()
        },
        vec![never()],
    );
    let result = &doctor.run(false).await.unwrap().checks[0];
    assert_eq!(
        (result.status, result.message.as_str()),
        (Status::Timeout, "Timed out after 30ms.")
    );
}

#[tokio::test]
async fn dependencies() {
    let seen = Arc::new(AtomicUsize::new(0));
    let seen_by_check = seen.clone();

    let doctor = doctor_with(
        options(),
        vec![
            check_with("db.query", move |ctx| {
                if ctx.dependency("db.reachable").is_some() {
                    seen_by_check.fetch_add(1, Ordering::SeqCst);
                }
                async { Ok(Outcome::pass("OK")) }
            })
            .depends_on(["db.reachable"]),
            passing("db.reachable"),
            passing("kms.encrypt").depends_on(["kms.reachable"]),
            failing("kms.reachable"),
            passing("orphan").depends_on(["missing"]),
            passing("cycle.a").depends_on(["cycle.b"]),
            passing("cycle.b").depends_on(["cycle.a"]),
            passing("cycle.c").depends_on(["cycle.a"]),
        ],
    );

    let report = doctor.run(false).await.unwrap();
    let get = |id: &str| report.checks.iter().find(|check| check.id == id).unwrap();

    assert_eq!(get("db.query").status, Status::Pass);
    assert_eq!(seen.load(Ordering::SeqCst), 1);

    let skipped = get("kms.encrypt");
    assert_eq!(skipped.status, Status::Skip);
    assert_eq!(
        skipped.details.as_ref().unwrap()["dependsOn"],
        json!(["kms.reachable"])
    );

    assert_eq!(get("orphan").message, "Unknown dependency: missing.");
    assert_eq!(get("cycle.a").status, Status::Error);
    assert_eq!(get("cycle.b").status, Status::Error);
    assert_eq!(get("cycle.c").status, Status::Skip);
}

#[tokio::test(start_paused = true)]
async fn min_interval_reuses_result_even_when_fresh() {
    let calls = Arc::new(AtomicUsize::new(0));
    let doctor = doctor_with(
        options(),
        vec![counted(&calls).min_interval(Duration::from_secs(60))],
    );

    let first = doctor.run(false).await.unwrap();
    tokio::time::advance(Duration::from_secs(15)).await;
    let second = doctor.run(true).await.unwrap();
    tokio::time::advance(Duration::from_secs(60)).await;
    let third = doctor.run(true).await.unwrap();

    assert_eq!(calls.load(Ordering::SeqCst), 2);
    assert_eq!(first.checks[0].cached_at, None);
    assert_eq!(
        second.checks[0].cached_at.as_deref(),
        Some(first.generated_at.as_str())
    );
    assert_eq!(third.checks[0].cached_at, None);
}

#[tokio::test]
async fn concurrency_limit() {
    let active = Arc::new(AtomicUsize::new(0));
    let peak = Arc::new(AtomicUsize::new(0));

    let checks = (1..=8)
        .map(|index| {
            let active = active.clone();
            let peak = peak.clone();
            check_with(&format!("c{index}"), move |_| {
                let active = active.clone();
                let peak = peak.clone();
                async move {
                    let current = active.fetch_add(1, Ordering::SeqCst) + 1;
                    peak.fetch_max(current, Ordering::SeqCst);
                    tokio::time::sleep(Duration::from_millis(10)).await;
                    active.fetch_sub(1, Ordering::SeqCst);
                    Ok(Outcome::pass("OK"))
                }
            })
        })
        .collect();

    doctor_with(
        Options {
            concurrency: Some(3),
            ..options()
        },
        checks,
    )
    .run(false)
    .await
    .unwrap();

    assert!(
        (1..=3).contains(&peak.load(Ordering::SeqCst)),
        "peak = {}",
        peak.load(Ordering::SeqCst)
    );
}

#[tokio::test]
async fn register_validation() {
    let doctor = Doctor::new(options());

    assert!(matches!(
        doctor.register(passing("Bad_ID")),
        Err(RegisterError::InvalidId(_))
    ));
    doctor.register(passing("ok")).unwrap();
    assert!(matches!(
        doctor.register(passing("ok")),
        Err(RegisterError::DuplicateId(_))
    ));
}

#[tokio::test]
async fn debounce_concurrent_requests_share_run() {
    let gate = Gate::new();
    let doctor = doctor_with(options(), vec![gate.check()]);

    let callers: Vec<_> = (0..6)
        .map(|_| {
            let doctor = doctor.clone();
            tokio::spawn(async move { doctor.run(false).await.unwrap() })
        })
        .collect();

    gate.started().await;
    tokio::task::yield_now().await;
    gate.release();

    let reports: Vec<_> = futures::future::join_all(callers)
        .await
        .into_iter()
        .map(Result::unwrap)
        .collect();

    assert_eq!(gate.calls.load(Ordering::SeqCst), 1);
    assert!(reports
        .iter()
        .all(|report| report.run_id == reports[0].run_id));
}

#[tokio::test(start_paused = true)]
async fn debounce_cache_ttl() {
    let calls = Arc::new(AtomicUsize::new(0));
    let doctor = doctor_with(options(), vec![counted(&calls)]);

    let first = doctor.run(false).await.unwrap();
    tokio::time::advance(Duration::from_secs(20)).await;
    let cached = doctor.run(false).await.unwrap();

    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert!(cached.cached);
    assert_eq!(
        (cached.age_ms, cached.run_id.as_str()),
        (20_000, first.run_id.as_str())
    );

    tokio::time::advance(Duration::from_secs(15)).await;
    let expired = doctor.run(false).await.unwrap();
    assert!(!expired.cached);
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}

#[tokio::test]
async fn debounce_fresh_joins_running_run() {
    let gate = Gate::new();
    let doctor = doctor_with(options(), vec![gate.check()]);

    let first = tokio::spawn({
        let doctor = doctor.clone();
        async move { doctor.run(false).await.unwrap() }
    });
    gate.started().await;

    let fresh = tokio::spawn({
        let doctor = doctor.clone();
        async move { doctor.run(true).await.unwrap() }
    });
    tokio::task::yield_now().await;
    gate.release();

    let (first, fresh) = (first.await.unwrap(), fresh.await.unwrap());
    assert_eq!(gate.calls.load(Ordering::SeqCst), 1);
    assert_eq!(first.run_id, fresh.run_id);
}

#[tokio::test(start_paused = true)]
async fn debounce_fresh_min_interval() {
    let calls = Arc::new(AtomicUsize::new(0));
    let doctor = doctor_with(options(), vec![counted(&calls)]);

    let first = doctor.run(false).await.unwrap();
    tokio::time::advance(Duration::from_secs(5)).await;
    let recent = doctor.run(true).await.unwrap();

    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert!(recent.cached);
    assert_eq!(recent.run_id, first.run_id);

    tokio::time::advance(Duration::from_secs(6)).await;
    let forced = doctor.run(true).await.unwrap();
    assert!(!forced.cached);
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}

#[tokio::test]
async fn debounce_abort_does_not_cancel_run() {
    let gate = Gate::new();
    let doctor = doctor_with(options(), vec![gate.check()]);

    let aborted = tokio::spawn({
        let doctor = doctor.clone();
        async move { doctor.run(false).await }
    });
    gate.started().await;

    let joined = tokio::spawn({
        let doctor = doctor.clone();
        async move { doctor.run(false).await.unwrap() }
    });
    tokio::task::yield_now().await;

    aborted.abort();
    assert!(aborted.await.unwrap_err().is_cancelled());

    gate.release();
    let report = joined.await.unwrap();

    assert_eq!(gate.calls.load(Ordering::SeqCst), 1);
    assert_eq!(report.checks[0].status, Status::Pass);
}

#[tokio::test]
async fn respond() {
    let doctor = doctor_with(options(), vec![passing("ok")]);

    let response = doctor.respond("GET", Some("fresh=1")).await;
    assert_eq!(response.status, 200);
    assert!(response
        .headers
        .contains(&("x-metorial-doctor", "1".to_string())));
    assert!(response
        .headers
        .contains(&("cache-control", "no-store".to_string())));
    assert_eq!(
        parse_report(response.body.as_bytes()).unwrap().checks[0].id,
        "ok"
    );

    let rejected = doctor.respond("POST", None).await;
    assert_eq!(rejected.status, 405);
    assert!(rejected.headers.contains(&("allow", "GET".to_string())));
}
