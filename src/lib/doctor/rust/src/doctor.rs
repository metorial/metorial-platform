use std::collections::{BTreeMap, HashMap};
use std::fmt;
use std::panic::AssertUnwindSafe;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;

use chrono::{DateTime, Utc};
use futures::future::{join_all, BoxFuture, Shared};
use futures::FutureExt;
use serde_json::{json, Map, Value};
use tokio::sync::{watch, Semaphore};
use tokio::time::Instant;

use crate::check::{Check, CheckContext, Outcome};
use crate::errors::describe_error;
use crate::redact::{redact_details, redact_string};
use crate::report::{
    format_time, is_valid_check_id, CheckResult, Report, Resolution, Status, PROTOCOL_VERSION,
};

pub const DEFAULT_CONCURRENCY: usize = 4;
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(5);
pub const DEFAULT_RUN_BUDGET: Duration = Duration::from_secs(12);
pub const DEFAULT_CACHE_TTL: Duration = Duration::from_secs(30);
pub const DEFAULT_FRESH_MIN_INTERVAL: Duration = Duration::from_secs(10);

static PROCESS_STARTED_AT: LazyLock<DateTime<Utc>> = LazyLock::new(Utc::now);

#[derive(Debug, Clone, Default)]
pub struct Options {
    pub component: String,
    pub instance: Option<String>,

    /// `None` reads METORIAL_RELEASE_VERSION, METORIAL_VERSION and METORIAL_RELEASE_CHANNEL.
    pub release_version: Option<String>,
    pub build_version: Option<String>,
    pub channel: Option<String>,
    pub public_url: Option<String>,

    pub fingerprints: BTreeMap<String, String>,
    pub concurrency: Option<usize>,
    pub timeout: Option<Duration>,
    pub run_budget: Option<Duration>,
    pub cache_ttl: Option<Duration>,
    pub fresh_min_interval: Option<Duration>,
}

impl Options {
    pub fn new(component: impl Into<String>) -> Self {
        Self {
            component: component.into(),
            ..Default::default()
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RegisterError {
    InvalidId(String),
    DuplicateId(String),
}

impl fmt::Display for RegisterError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RegisterError::InvalidId(id) => write!(f, "invalid doctor check id {id:?}"),
            RegisterError::DuplicateId(id) => write!(f, "duplicate doctor check id {id:?}"),
        }
    }
}

impl std::error::Error for RegisterError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunError(pub String);

impl fmt::Display for RunError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "doctor run failed: {}", self.0)
    }
}

impl std::error::Error for RunError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: Vec<(&'static str, String)>,
    pub body: String,
}

#[derive(Clone)]
struct Finished {
    report: Arc<Report>,
    finished_at: Instant,
}

type RunFuture = Shared<BoxFuture<'static, Result<Finished, RunError>>>;

#[derive(Default)]
struct State {
    inflight: Option<RunFuture>,
    last: Option<Finished>,
}

#[derive(Clone)]
struct Previous {
    result: CheckResult,
    produced_at: Instant,
    produced_wall: DateTime<Utc>,
}

struct Settings {
    concurrency: usize,
    timeout: Duration,
    run_budget: Duration,
    cache_ttl: Duration,
    fresh_min_interval: Duration,
}

struct Inner {
    component: String,
    instance: String,
    release_version: Option<String>,
    build_version: Option<String>,
    channel: Option<String>,
    public_url: Option<String>,
    fingerprints: BTreeMap<String, String>,
    settings: Settings,

    // Wall time is derived from tokio's clock so paused-time tests see consistent timestamps.
    anchor_wall: DateTime<Utc>,
    anchor_instant: Instant,

    checks: Mutex<Vec<Arc<Check>>>,
    state: Mutex<State>,
    previous: Mutex<HashMap<String, Previous>>,
}

/// Runs registered checks and serves debounced reports. Cloning is cheap and shares state.
/// `run` spawns onto the current tokio runtime.
#[derive(Clone)]
pub struct Doctor {
    inner: Arc<Inner>,
}

impl Doctor {
    pub fn new(options: Options) -> Self {
        LazyLock::force(&PROCESS_STARTED_AT);

        let instance = options
            .instance
            .and_then(non_empty)
            .or_else(|| env_value("HOSTNAME"))
            .or_else(|| {
                std::fs::read_to_string("/etc/hostname")
                    .ok()
                    .and_then(non_empty)
            })
            .unwrap_or_else(|| "unknown".to_string());

        let settings = Settings {
            concurrency: options
                .concurrency
                .filter(|value| *value > 0)
                .unwrap_or(DEFAULT_CONCURRENCY),
            timeout: positive(options.timeout).unwrap_or(DEFAULT_TIMEOUT),
            run_budget: positive(options.run_budget).unwrap_or(DEFAULT_RUN_BUDGET),
            cache_ttl: positive(options.cache_ttl).unwrap_or(DEFAULT_CACHE_TTL),
            fresh_min_interval: positive(options.fresh_min_interval)
                .unwrap_or(DEFAULT_FRESH_MIN_INTERVAL),
        };

        Self {
            inner: Arc::new(Inner {
                component: options.component,
                instance,
                release_version: identity_value(
                    options.release_version,
                    "METORIAL_RELEASE_VERSION",
                ),
                build_version: identity_value(options.build_version, "METORIAL_VERSION"),
                channel: identity_value(options.channel, "METORIAL_RELEASE_CHANNEL"),
                public_url: options.public_url.and_then(non_empty),
                fingerprints: options.fingerprints,
                settings,
                anchor_wall: Utc::now(),
                anchor_instant: Instant::now(),
                checks: Mutex::new(Vec::new()),
                state: Mutex::new(State::default()),
                previous: Mutex::new(HashMap::new()),
            }),
        }
    }

    pub fn register(&self, check: Check) -> Result<(), RegisterError> {
        if !is_valid_check_id(&check.id) {
            return Err(RegisterError::InvalidId(check.id));
        }

        let mut checks = self.inner.checks.lock().unwrap();
        if checks.iter().any(|existing| existing.id == check.id) {
            return Err(RegisterError::DuplicateId(check.id));
        }

        checks.push(Arc::new(check));
        Ok(())
    }

    /// Returns the current report. Concurrent callers share one run and recent reports come from
    /// the cache (spec/README.md, "Debouncing"). The run executes on its own task, so dropping
    /// this future only stops this caller from waiting.
    pub async fn run(&self, fresh: bool) -> Result<Report, RunError> {
        let future = {
            let mut state = self.inner.state.lock().unwrap();

            if state.inflight.is_none() {
                if let Some(last) = &state.last {
                    let max_age = if fresh {
                        self.inner.settings.fresh_min_interval
                    } else {
                        self.inner.settings.cache_ttl
                    };
                    if last.finished_at.elapsed() < max_age {
                        return Ok(served(last, true));
                    }
                }
            }

            state.inflight.get_or_insert_with(|| self.start()).clone()
        };

        let finished = future.await?;
        Ok(served(&finished, false))
    }

    /// Framework-agnostic `GET /doctor` handler. `query` is the raw query string without `?`.
    pub async fn respond(&self, method: &str, query: Option<&str>) -> HttpResponse {
        if !method.eq_ignore_ascii_case("GET") {
            return HttpResponse {
                status: 405,
                headers: vec![
                    ("allow", "GET".into()),
                    ("content-type", "text/plain".into()),
                ],
                body: "Method Not Allowed".into(),
            };
        }

        let fresh = query
            .unwrap_or_default()
            .split('&')
            .any(|pair| pair == "fresh=1" || pair == "fresh=true");

        let headers = vec![
            ("content-type", "application/json".to_string()),
            ("x-metorial-doctor", "1".to_string()),
            ("cache-control", "no-store".to_string()),
        ];

        match self.run(fresh).await {
            Ok(report) => HttpResponse {
                status: 200,
                headers,
                body: serde_json::to_string(&report).unwrap_or_default(),
            },
            Err(error) => HttpResponse {
                status: 503,
                headers,
                body: json!({ "error": redact_string(&error.to_string()) }).to_string(),
            },
        }
    }

    fn start(&self) -> RunFuture {
        let inner = self.inner.clone();

        let task = tokio::spawn(async move {
            let result = AssertUnwindSafe(inner.clone().produce())
                .catch_unwind()
                .await
                .map_err(|panic| RunError(panic_message(panic.as_ref())));

            let mut state = inner.state.lock().unwrap();
            state.inflight = None;
            if let Ok(finished) = &result {
                state.last = Some(finished.clone());
            }

            result
        });

        async move { task.await.map_err(|error| RunError(error.to_string()))? }
            .boxed()
            .shared()
    }
}

impl Inner {
    fn wall_now(&self) -> DateTime<Utc> {
        let elapsed = Instant::now().duration_since(self.anchor_instant);
        self.anchor_wall + chrono::Duration::from_std(elapsed).unwrap_or_default()
    }

    async fn produce(self: Arc<Self>) -> Finished {
        let checks = self.checks.lock().unwrap().clone();

        let started = Instant::now();
        let started_wall = self.wall_now();
        let results = self
            .run_checks(&checks, started + self.settings.run_budget)
            .await;
        let finished = Instant::now();
        let finished_wall = self.wall_now();

        let report = Report {
            doctor: PROTOCOL_VERSION,
            component: self.component.clone(),
            instance: self.instance.clone(),
            release_version: self.release_version.clone(),
            build_version: self.build_version.clone(),
            channel: self.channel.clone(),
            public_url: self.public_url.clone(),
            fingerprints: self.fingerprints.clone(),
            process_started_at: format_time(*PROCESS_STARTED_AT),
            started_at: format_time(started_wall),
            generated_at: format_time(finished_wall),
            duration_ms: millis(finished.duration_since(started)),
            run_id: random_run_id(),
            cached: false,
            age_ms: 0,
            checks: results,
        };

        Finished {
            report: Arc::new(report),
            finished_at: finished,
        }
    }

    async fn run_checks(&self, checks: &[Arc<Check>], deadline: Instant) -> Vec<CheckResult> {
        let index: HashMap<&str, usize> = checks
            .iter()
            .enumerate()
            .map(|(position, check)| (check.id.as_str(), position))
            .collect();
        let cyclic = find_cycles(checks, &index);
        let slots = Semaphore::new(self.settings.concurrency);

        let (senders, receivers): (Vec<_>, Vec<_>) = checks
            .iter()
            .map(|_| watch::channel(None::<CheckResult>))
            .unzip();

        let evaluations = checks.iter().enumerate().map(|(position, check)| {
            let index = &index;
            let cyclic = &cyclic;
            let slots = &slots;
            let senders = &senders;
            let receivers = &receivers;

            async move {
                let result = self
                    .evaluate(check, index, cyclic, slots, receivers, deadline)
                    .await;
                senders[position].send_replace(Some(result.clone()));
                result
            }
        });

        join_all(evaluations).await
    }

    async fn evaluate(
        &self,
        check: &Check,
        index: &HashMap<&str, usize>,
        cyclic: &HashMap<String, Vec<String>>,
        slots: &Semaphore,
        receivers: &[watch::Receiver<Option<CheckResult>>],
        deadline: Instant,
    ) -> CheckResult {
        if let Some(cycle) = cyclic.get(&check.id) {
            let message = format!("Dependency cycle: {}.", cycle.join(" → "));
            return result(check, Outcome::new(Status::Error, message), Duration::ZERO);
        }

        let unknown: Vec<&str> = check
            .depends_on
            .iter()
            .filter(|id| !index.contains_key(id.as_str()))
            .map(String::as_str)
            .collect();
        if !unknown.is_empty() {
            let message = format!("Unknown dependency: {}.", unknown.join(", "));
            return result(check, Outcome::new(Status::Error, message), Duration::ZERO);
        }

        let mut dependencies = HashMap::new();
        for id in &check.depends_on {
            let mut receiver = receivers[index[id.as_str()]].clone();
            let dependency = match receiver.wait_for(Option::is_some).await {
                Ok(value) => value.clone(),
                Err(_) => None,
            };
            if let Some(dependency) = dependency {
                dependencies.insert(id.clone(), dependency);
            }
        }

        let failed: Vec<&str> = check
            .depends_on
            .iter()
            .filter(|id| {
                dependencies
                    .get(*id)
                    .is_none_or(|dependency: &CheckResult| !dependency.status.is_passing())
            })
            .map(String::as_str)
            .collect();
        if !failed.is_empty() {
            let outcome = Outcome::skip(format!(
                "Skipped because {} did not pass.",
                failed.join(", ")
            ))
            .with_details(json!({ "dependsOn": failed }));
            return result(check, outcome, Duration::ZERO);
        }

        if let Some(min_interval) = check.min_interval {
            let previous = self.previous.lock().unwrap().get(&check.id).cloned();
            if let Some(previous) = previous {
                if previous.produced_at.elapsed() < min_interval {
                    let mut reused = previous.result;
                    reused.cached_at = Some(format_time(previous.produced_wall));
                    return reused;
                }
            }
        }

        let produced = {
            let _slot = slots.acquire().await.expect("semaphore is never closed");
            self.execute(check, dependencies, deadline).await
        };

        self.previous.lock().unwrap().insert(
            check.id.clone(),
            Previous {
                result: produced.clone(),
                produced_at: Instant::now(),
                produced_wall: self.wall_now(),
            },
        );

        produced
    }

    async fn execute(
        &self,
        check: &Check,
        dependencies: HashMap<String, CheckResult>,
        deadline: Instant,
    ) -> CheckResult {
        let started = Instant::now();
        let timeout = check
            .timeout
            .unwrap_or(self.settings.timeout)
            .min(deadline.saturating_duration_since(started));

        if timeout.is_zero() {
            return result(check, timeout_outcome(timeout), Duration::ZERO);
        }

        let run = check.run.clone();
        let context = CheckContext {
            dependencies: Arc::new(dependencies),
        };
        let body = AssertUnwindSafe(async move { run(context).await }).catch_unwind();

        let outcome = match tokio::time::timeout(timeout, body).await {
            Err(_) => timeout_outcome(timeout),
            Ok(Err(panic)) => Outcome::new(
                Status::Error,
                format!("Check panicked: {}", panic_message(panic.as_ref())),
            ),
            Ok(Ok(Err(error))) => error_outcome(check, error.as_ref()),
            Ok(Ok(Ok(outcome))) => outcome,
        };

        result(check, outcome, started.elapsed())
    }
}

fn result(check: &Check, outcome: Outcome, elapsed: Duration) -> CheckResult {
    let resolution = outcome.resolution.or_else(|| {
        if matches!(outcome.status, Status::Pass | Status::Skip) {
            None
        } else {
            check.resolution.clone()
        }
    });

    CheckResult {
        id: check.id.clone(),
        title: check.title.clone(),
        category: check.category,
        target: check.target.as_deref().map(redact_string),
        status: outcome.status,
        severity: check.severity,
        duration_ms: millis(elapsed),
        message: redact_string(&outcome.message),
        resolution,
        details: outcome.details.as_ref().map(redact_details),
        cached_at: None,
    }
}

fn error_outcome(check: &Check, error: &(dyn std::error::Error + 'static)) -> Outcome {
    let info = describe_error(error);
    let resolution = check
        .resolution
        .clone()
        .or_else(|| info.hint.clone().map(Resolution::new));

    Outcome {
        status: Status::Error,
        message: info.message.clone(),
        resolution,
        details: Some(Map::from_iter([(
            "error".to_string(),
            serde_json::to_value(&info).unwrap_or(Value::Null),
        )])),
    }
}

fn timeout_outcome(timeout: Duration) -> Outcome {
    Outcome::new(
        Status::Timeout,
        format!("Timed out after {}ms.", timeout.as_millis()),
    )
    .with_details(json!({ "timeoutMs": timeout.as_millis() as u64 }))
}

fn served(finished: &Finished, cached: bool) -> Report {
    let mut report = (*finished.report).clone();
    report.cached = cached;
    report.age_ms = millis(finished.finished_at.elapsed());
    report
}

fn find_cycles(
    checks: &[Arc<Check>],
    index: &HashMap<&str, usize>,
) -> HashMap<String, Vec<String>> {
    #[derive(Clone, Copy, PartialEq)]
    enum Mark {
        Visiting,
        Done,
    }

    fn visit<'a>(
        id: &'a str,
        checks: &'a [Arc<Check>],
        index: &HashMap<&str, usize>,
        marks: &mut HashMap<&'a str, Mark>,
        stack: &mut Vec<&'a str>,
        cyclic: &mut HashMap<String, Vec<String>>,
    ) {
        match marks.get(id) {
            Some(Mark::Done) => return,
            Some(Mark::Visiting) => {
                let start = stack.iter().position(|item| *item == id).unwrap_or(0);
                let mut cycle: Vec<String> =
                    stack[start..].iter().map(|item| item.to_string()).collect();
                cycle.push(id.to_string());
                for member in &cycle {
                    cyclic.insert(member.clone(), cycle.clone());
                }
                return;
            }
            None => {}
        }

        marks.insert(id, Mark::Visiting);
        stack.push(id);

        for dependency in &checks[index[id]].depends_on {
            if index.contains_key(dependency.as_str()) {
                visit(dependency, checks, index, marks, stack, cyclic);
            }
        }

        stack.pop();
        marks.insert(id, Mark::Done);
    }

    let mut cyclic = HashMap::new();
    let mut marks = HashMap::new();
    let mut stack = Vec::new();

    for check in checks {
        visit(
            &check.id,
            checks,
            index,
            &mut marks,
            &mut stack,
            &mut cyclic,
        );
    }

    cyclic
}

fn panic_message(panic: &(dyn std::any::Any + Send)) -> String {
    panic
        .downcast_ref::<&str>()
        .map(|message| message.to_string())
        .or_else(|| panic.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "unknown panic".to_string())
}

fn millis(duration: Duration) -> u64 {
    (duration.as_secs_f64() * 1000.0).round() as u64
}

fn positive(value: Option<Duration>) -> Option<Duration> {
    value.filter(|duration| !duration.is_zero())
}

fn non_empty(value: String) -> Option<String> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn env_value(name: &str) -> Option<String> {
    std::env::var(name).ok().and_then(non_empty)
}

fn identity_value(value: Option<String>, env: &str) -> Option<String> {
    match value {
        Some(value) => non_empty(value),
        None => env_value(env),
    }
}

fn random_run_id() -> String {
    rand::random::<[u8; 6]>()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}
