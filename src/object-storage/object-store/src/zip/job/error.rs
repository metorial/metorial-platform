use std::time::Duration;

use axum::http::header::RETRY_AFTER;
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use thiserror::Error;

use crate::error::ServiceError;
use crate::zip::ZipJobError;

/// Why a job request was refused. A job that fails is not an error: it is returned with
/// `state: failed`.
#[derive(Debug, Error)]
pub enum JobRequestError {
    #[error("invalid job id: {0}")]
    InvalidJobId(String),

    #[error("invalid zip job spec: {}", .0.message)]
    InvalidSpec(ZipJobError),

    #[error("invalid request: {0}")]
    InvalidRequest(String),

    #[error("the spec is larger than {0} bytes")]
    SpecTooLarge(usize),

    #[error("zip job not found: {0}")]
    NotFound(String),

    #[error("zip job {0} already exists with a different spec")]
    SpecConflict(String),

    #[error(
        "zip job id {id:?} collides with the existing job {existing:?} on this storage backend, \
         which does not tell them apart"
    )]
    IdCollision { id: String, existing: String },

    #[error("this instance already has {0} zip jobs queued or running")]
    TooManyJobs(usize),

    #[error(
        "this instance already has {active} zip job entries queued or running; \
         {requested} more would exceed its limit of {limit}"
    )]
    TooManyEntries {
        active: usize,
        requested: usize,
        limit: usize,
    },

    #[error("this instance is already reading as many zip job specs as it can; waited {0:?}")]
    TooManySpecs(Duration),

    #[error("the instance is shutting down")]
    ShuttingDown,

    #[error("zip job {0} is being changed concurrently")]
    Contended(String),

    #[error(transparent)]
    Service(#[from] ServiceError),
}

pub(crate) const RETRY_AFTER_QUEUE_FULL: Duration = Duration::from_secs(5);
const RETRY_AFTER_UNAVAILABLE: Duration = Duration::from_secs(1);

impl JobRequestError {
    pub fn code(&self) -> &'static str {
        match self {
            JobRequestError::InvalidJobId(_) => "invalid_job_id",
            JobRequestError::InvalidSpec(error) => error.code.as_str(),
            JobRequestError::InvalidRequest(_) => "invalid_request",
            JobRequestError::SpecTooLarge(_) => "spec_too_large",
            JobRequestError::NotFound(_) => "job_not_found",
            JobRequestError::SpecConflict(_) => "spec_conflict",
            JobRequestError::IdCollision { .. } => "job_id_conflict",
            JobRequestError::TooManyJobs(_)
            | JobRequestError::TooManyEntries { .. }
            | JobRequestError::TooManySpecs(_) => "too_many_jobs",
            JobRequestError::ShuttingDown => "shutting_down",
            JobRequestError::Contended(_) => "contended",
            JobRequestError::Service(_) => "internal",
        }
    }

    fn status(&self) -> StatusCode {
        match self {
            JobRequestError::InvalidJobId(_)
            | JobRequestError::InvalidSpec(_)
            | JobRequestError::InvalidRequest(_) => StatusCode::BAD_REQUEST,
            JobRequestError::SpecTooLarge(_) => StatusCode::PAYLOAD_TOO_LARGE,
            JobRequestError::NotFound(_) => StatusCode::NOT_FOUND,
            JobRequestError::SpecConflict(_) | JobRequestError::IdCollision { .. } => {
                StatusCode::CONFLICT
            }
            JobRequestError::TooManyJobs(_)
            | JobRequestError::TooManyEntries { .. }
            | JobRequestError::TooManySpecs(_) => StatusCode::TOO_MANY_REQUESTS,
            JobRequestError::ShuttingDown | JobRequestError::Contended(_) => {
                StatusCode::SERVICE_UNAVAILABLE
            }
            JobRequestError::Service(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn retry_after(&self) -> Option<Duration> {
        match self {
            JobRequestError::TooManyJobs(_) | JobRequestError::TooManyEntries { .. } => {
                Some(RETRY_AFTER_QUEUE_FULL)
            }
            JobRequestError::TooManySpecs(_)
            | JobRequestError::ShuttingDown
            | JobRequestError::Contended(_) => Some(RETRY_AFTER_UNAVAILABLE),
            _ => None,
        }
    }
}

impl IntoResponse for JobRequestError {
    fn into_response(self) -> Response {
        if let JobRequestError::Service(error) = self {
            return error.into_response();
        }

        let status = self.status();
        let retry_after = self.retry_after();
        let body = Json(json!({
            "error": self.to_string(),
            "code": self.code(),
        }));

        let mut response = (status, body).into_response();
        if let Some(retry_after) = retry_after {
            response
                .headers_mut()
                .insert(RETRY_AFTER, HeaderValue::from(retry_after.as_secs().max(1)));
        }
        response
    }
}
