use std::collections::HashMap;
use std::fmt;
use std::future::Future;
use std::sync::Arc;
use std::time::Duration;

use futures::future::BoxFuture;
use futures::FutureExt;
use serde_json::{Map, Value};

use crate::report::{Category, CheckResult, Resolution, Severity, Status};

pub type CheckError = Box<dyn std::error::Error + Send + Sync + 'static>;

type RunFn = dyn Fn(CheckContext) -> BoxFuture<'static, Result<Outcome, CheckError>> + Send + Sync;

#[derive(Debug, Clone, PartialEq)]
pub struct Outcome {
    pub status: Status,
    pub message: String,
    pub resolution: Option<Resolution>,
    pub details: Option<Map<String, Value>>,
}

impl Outcome {
    pub fn new(status: Status, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
            resolution: None,
            details: None,
        }
    }

    pub fn pass(message: impl Into<String>) -> Self {
        Self::new(Status::Pass, message)
    }

    pub fn warn(message: impl Into<String>) -> Self {
        Self::new(Status::Warn, message)
    }

    pub fn fail(message: impl Into<String>) -> Self {
        Self::new(Status::Fail, message)
    }

    pub fn skip(reason: impl Into<String>) -> Self {
        Self::new(Status::Skip, reason)
    }

    pub fn with_resolution(mut self, resolution: Resolution) -> Self {
        self.resolution = Some(resolution);
        self
    }

    /// Non-object values are stored under `value`, since details are always an object.
    pub fn with_details(mut self, details: Value) -> Self {
        self.details = Some(match details {
            Value::Object(map) => map,
            other => Map::from_iter([("value".to_string(), other)]),
        });
        self
    }
}

#[derive(Debug, Clone, Default)]
pub struct CheckContext {
    pub(crate) dependencies: Arc<HashMap<String, CheckResult>>,
}

impl CheckContext {
    /// The result of a check listed in `depends_on`.
    pub fn dependency(&self, id: &str) -> Option<&CheckResult> {
        self.dependencies.get(id)
    }
}

#[derive(Clone)]
pub struct Check {
    pub id: String,
    pub title: String,
    pub category: Category,
    pub severity: Severity,
    pub target: Option<String>,
    pub timeout: Option<Duration>,
    pub min_interval: Option<Duration>,
    pub depends_on: Vec<String>,
    pub resolution: Option<Resolution>,
    pub(crate) run: Arc<RunFn>,
}

impl Check {
    /// `run` resolves to the check's outcome; an `Err` marks it as `error` and is classified with
    /// `describe_error`.
    pub fn new<F, Fut>(
        id: impl Into<String>,
        title: impl Into<String>,
        category: Category,
        severity: Severity,
        run: F,
    ) -> Self
    where
        F: Fn(CheckContext) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<Outcome, CheckError>> + Send + 'static,
    {
        Self {
            id: id.into(),
            title: title.into(),
            category,
            severity,
            target: None,
            timeout: None,
            min_interval: None,
            depends_on: Vec::new(),
            resolution: None,
            run: Arc::new(move |ctx| run(ctx).boxed()),
        }
    }

    pub fn target(mut self, target: impl Into<String>) -> Self {
        self.target = Some(target.into());
        self
    }

    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    pub fn min_interval(mut self, interval: Duration) -> Self {
        self.min_interval = Some(interval);
        self
    }

    pub fn depends_on<I, S>(mut self, ids: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.depends_on.extend(ids.into_iter().map(Into::into));
        self
    }

    pub fn resolution(mut self, resolution: Resolution) -> Self {
        self.resolution = Some(resolution);
        self
    }
}

impl fmt::Debug for Check {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Check")
            .field("id", &self.id)
            .field("category", &self.category)
            .field("severity", &self.severity)
            .field("depends_on", &self.depends_on)
            .finish_non_exhaustive()
    }
}
