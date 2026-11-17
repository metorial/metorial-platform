//! Rust implementation of the doctor protocol described in `../spec/README.md`.

mod check;
mod doctor;
mod errors;
mod redact;
mod report;

pub mod probes;

#[cfg(feature = "aws")]
pub mod aws;

#[cfg(feature = "axum")]
pub mod axum;

pub use check::{Check, CheckContext, CheckError, Outcome};
pub use doctor::{
    Doctor, HttpResponse, Options, RegisterError, RunError, DEFAULT_CACHE_TTL, DEFAULT_CONCURRENCY,
    DEFAULT_FRESH_MIN_INTERVAL, DEFAULT_RUN_BUDGET, DEFAULT_TIMEOUT,
};
pub use errors::{
    classify_code, describe_error, describe_error_with_code, CodedError, ErrorInfo, ErrorKind,
    HttpStatusError, ERROR_CODE_KINDS, HTTP_STATUS_KINDS,
};
pub use redact::{is_secret_key, redact, redact_details, redact_string};
pub use report::{
    is_valid_check_id, parse_report, Category, CheckResult, InvalidReport, Report, Resolution,
    Severity, Status, PROTOCOL_VERSION,
};
