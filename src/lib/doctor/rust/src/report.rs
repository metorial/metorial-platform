use std::collections::BTreeMap;
use std::fmt;
use std::sync::LazyLock;

use chrono::{DateTime, SecondsFormat, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

pub const PROTOCOL_VERSION: u64 = 1;

static CHECK_ID_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$").unwrap());

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Pass,
    Warn,
    Fail,
    Skip,
    Error,
    Timeout,
}

impl Status {
    pub fn is_failing(self) -> bool {
        matches!(self, Status::Fail | Status::Error | Status::Timeout)
    }

    pub fn is_passing(self) -> bool {
        matches!(self, Status::Pass | Status::Warn)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Critical,
    Warning,
    Info,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Category {
    Database,
    Cache,
    Messaging,
    Storage,
    Dependency,
    External,
    Configuration,
    Runtime,
    Security,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Resolution {
    pub summary: String,
    #[serde(default)]
    pub steps: Vec<String>,
    #[serde(default)]
    pub docs: Option<String>,
}

impl Resolution {
    pub fn new(summary: impl Into<String>) -> Self {
        Self {
            summary: summary.into(),
            steps: Vec::new(),
            docs: None,
        }
    }

    pub fn step(mut self, step: impl Into<String>) -> Self {
        self.steps.push(step.into());
        self
    }

    pub fn docs(mut self, docs: impl Into<String>) -> Self {
        self.docs = Some(docs.into());
        self
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub id: String,
    pub title: String,
    pub category: Category,
    #[serde(default)]
    pub target: Option<String>,
    pub status: Status,
    pub severity: Severity,
    pub duration_ms: u64,
    pub message: String,
    #[serde(default)]
    pub resolution: Option<Resolution>,
    #[serde(default)]
    pub details: Option<Map<String, Value>>,
    #[serde(default)]
    pub cached_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub doctor: u64,
    pub component: String,
    pub instance: String,
    #[serde(default)]
    pub release_version: Option<String>,
    #[serde(default)]
    pub build_version: Option<String>,
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(default)]
    pub public_url: Option<String>,
    #[serde(default)]
    pub fingerprints: BTreeMap<String, String>,
    pub process_started_at: String,
    pub started_at: String,
    pub generated_at: String,
    pub duration_ms: u64,
    pub run_id: String,
    #[serde(default)]
    pub cached: bool,
    #[serde(default)]
    pub age_ms: u64,
    #[serde(default)]
    pub checks: Vec<CheckResult>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvalidReport(pub Vec<String>);

impl fmt::Display for InvalidReport {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "invalid doctor report: {}", self.0.join("; "))
    }
}

impl std::error::Error for InvalidReport {}

pub fn is_valid_check_id(id: &str) -> bool {
    CHECK_ID_PATTERN.is_match(id)
}

pub fn parse_report(data: &[u8]) -> Result<Report, InvalidReport> {
    let report: Report =
        serde_json::from_slice(data).map_err(|error| InvalidReport(vec![error.to_string()]))?;
    report.validate()?;
    Ok(report)
}

impl Report {
    pub fn validate(&self) -> Result<(), InvalidReport> {
        let mut problems = Vec::new();

        if self.doctor != PROTOCOL_VERSION {
            problems.push(format!(
                "doctor: unsupported protocol version {}",
                self.doctor
            ));
        }
        for (name, value) in [
            ("component", &self.component),
            ("instance", &self.instance),
            ("runId", &self.run_id),
        ] {
            if value.is_empty() {
                problems.push(format!("{name}: required"));
            }
        }
        for (name, value) in [
            ("processStartedAt", &self.process_started_at),
            ("startedAt", &self.started_at),
            ("generatedAt", &self.generated_at),
        ] {
            if !valid_timestamp(value) {
                problems.push(format!("{name}: invalid timestamp {value:?}"));
            }
        }

        for (index, check) in self.checks.iter().enumerate() {
            if !is_valid_check_id(&check.id) {
                problems.push(format!("checks.{index}.id: invalid id {:?}", check.id));
            }
            if let Some(cached_at) = &check.cached_at {
                if !valid_timestamp(cached_at) {
                    problems.push(format!(
                        "checks.{index}.cachedAt: invalid timestamp {cached_at:?}"
                    ));
                }
            }
        }

        if problems.is_empty() {
            Ok(())
        } else {
            Err(InvalidReport(problems))
        }
    }
}

fn valid_timestamp(value: &str) -> bool {
    DateTime::parse_from_rfc3339(value).is_ok()
}

pub(crate) fn format_time(time: DateTime<Utc>) -> String {
    time.to_rfc3339_opts(SecondsFormat::Millis, true)
}
