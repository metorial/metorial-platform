use std::fmt;

use object_store_backends::BackendError;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::path::PathError;
use super::writer::ZipError;
use crate::error::ServiceError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ZipErrorCode {
    /// The spec itself is unusable: no entries, too many, bad keys or levels, a destination
    /// that is also a source or under a reserved prefix, or a destination bucket that is missing.
    InvalidSpec,
    SourceNotFound,
    /// A source differs from what HEAD reported, or from the caller's `size`.
    SourceChanged,
    /// A source's CRC-32 differs from the caller's `crc32`.
    CrcMismatch,
    InvalidPath,
    DuplicatePath,
    TooLarge,
    BackendError,
    LeaseExpired,
    Interrupted,
    Internal,
    Canceled,
}

impl ZipErrorCode {
    /// Whether the same spec can succeed on a later attempt.
    pub fn is_retryable(self) -> bool {
        matches!(
            self,
            ZipErrorCode::LeaseExpired
                | ZipErrorCode::Interrupted
                | ZipErrorCode::Internal
                | ZipErrorCode::BackendError
        )
    }

    pub fn as_str(self) -> &'static str {
        match self {
            ZipErrorCode::InvalidSpec => "invalid_spec",
            ZipErrorCode::SourceNotFound => "source_not_found",
            ZipErrorCode::SourceChanged => "source_changed",
            ZipErrorCode::CrcMismatch => "crc_mismatch",
            ZipErrorCode::InvalidPath => "invalid_path",
            ZipErrorCode::DuplicatePath => "duplicate_path",
            ZipErrorCode::TooLarge => "too_large",
            ZipErrorCode::BackendError => "backend_error",
            ZipErrorCode::LeaseExpired => "lease_expired",
            ZipErrorCode::Interrupted => "interrupted",
            ZipErrorCode::Internal => "internal",
            ZipErrorCode::Canceled => "canceled",
        }
    }
}

impl fmt::Display for ZipErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Why a zip archive could not be built; serialized as the job's `error`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Error)]
#[serde(rename_all = "camelCase")]
#[error("{code}: {message}")]
pub struct ZipJobError {
    pub code: ZipErrorCode,
    pub message: String,
    pub retryable: bool,
}

impl ZipJobError {
    pub fn new(code: ZipErrorCode, message: impl Into<String>) -> Self {
        ZipJobError {
            code,
            message: message.into(),
            retryable: code.is_retryable(),
        }
    }

    pub fn invalid_spec(message: impl Into<String>) -> Self {
        Self::new(ZipErrorCode::InvalidSpec, message)
    }

    pub fn source_changed(message: impl Into<String>) -> Self {
        Self::new(ZipErrorCode::SourceChanged, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ZipErrorCode::Internal, message)
    }

    pub fn canceled() -> Self {
        Self::new(ZipErrorCode::Canceled, "the job was canceled")
    }

    /// Maps a failed backend call made while working on `context` (a source or the destination).
    pub fn from_backend(context: &str, error: BackendError) -> Self {
        let code = match &error {
            BackendError::NotFound(_) => ZipErrorCode::SourceNotFound,
            BackendError::RangeNotSatisfiable { .. } | BackendError::SizeMismatch(_) => {
                ZipErrorCode::SourceChanged
            }
            BackendError::TooLarge(_) => ZipErrorCode::TooLarge,
            BackendError::InvalidPath(_) => ZipErrorCode::InvalidSpec,
            BackendError::Serialization(_)
            | BackendError::Configuration(_)
            | BackendError::Internal(_) => ZipErrorCode::Internal,
            BackendError::Io(_)
            | BackendError::Provider(_)
            | BackendError::Retryable(_)
            | BackendError::PreconditionFailed(_)
            | BackendError::Conflict(_) => ZipErrorCode::BackendError,
        };

        Self::new(code, format!("{}: {}", context, error))
    }

    pub fn from_service(context: &str, error: ServiceError) -> Self {
        match error {
            ServiceError::Backend(error) => Self::from_backend(context, error),
            ServiceError::BucketNotFound(_) | ServiceError::ObjectNotFound(_) => Self::new(
                ZipErrorCode::SourceNotFound,
                format!("{}: {}", context, error),
            ),
            ServiceError::InvalidBucketName(_) | ServiceError::InvalidObjectKey(_) => {
                Self::invalid_spec(format!("{}: {}", context, error))
            }
            _ => Self::internal(format!("{}: {}", context, error)),
        }
    }

    pub fn from_path(error: PathError) -> Self {
        let code = if error.reason.is_conflict() {
            ZipErrorCode::DuplicatePath
        } else {
            ZipErrorCode::InvalidPath
        };
        Self::new(code, error.to_string())
    }

    pub fn from_writer(error: ZipError) -> Self {
        if error.is_data_mismatch() {
            return Self::source_changed(error.to_string());
        }

        match error {
            ZipError::InvalidPath(error) => Self::from_path(error),
            ZipError::ArchiveTooLarge => Self::new(ZipErrorCode::TooLarge, error.to_string()),
            error => Self::internal(error.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_transient_codes_are_retryable() {
        let retryable = [
            ZipErrorCode::LeaseExpired,
            ZipErrorCode::Interrupted,
            ZipErrorCode::Internal,
            ZipErrorCode::BackendError,
        ];

        for code in [
            ZipErrorCode::InvalidSpec,
            ZipErrorCode::SourceNotFound,
            ZipErrorCode::SourceChanged,
            ZipErrorCode::CrcMismatch,
            ZipErrorCode::InvalidPath,
            ZipErrorCode::DuplicatePath,
            ZipErrorCode::TooLarge,
            ZipErrorCode::Canceled,
        ] {
            assert!(!code.is_retryable(), "{code}");
        }
        for code in retryable {
            assert!(code.is_retryable(), "{code}");
            assert!(ZipJobError::new(code, "x").retryable);
        }
    }

    #[test]
    fn serializes_like_the_job_api() {
        let error = ZipJobError::new(ZipErrorCode::SourceNotFound, "gone");
        assert_eq!(
            serde_json::to_value(&error).unwrap(),
            serde_json::json!({ "code": "source_not_found", "message": "gone", "retryable": false })
        );

        for code in [ZipErrorCode::InvalidSpec, ZipErrorCode::BackendError] {
            assert_eq!(
                serde_json::to_value(code).unwrap(),
                serde_json::Value::String(code.as_str().to_string())
            );
        }
    }

    #[test]
    fn maps_backend_errors() {
        let code = |error| ZipJobError::from_backend("src", error).code;

        assert_eq!(
            code(BackendError::NotFound("k".into())),
            ZipErrorCode::SourceNotFound
        );
        assert_eq!(
            code(BackendError::Retryable("503".into())),
            ZipErrorCode::BackendError
        );
        assert_eq!(
            code(BackendError::Provider("403".into())),
            ZipErrorCode::BackendError
        );
        assert_eq!(
            code(BackendError::TooLarge("5 TiB".into())),
            ZipErrorCode::TooLarge
        );
        assert_eq!(
            code(BackendError::RangeNotSatisfiable { size: 1 }),
            ZipErrorCode::SourceChanged
        );
        assert_eq!(
            code(BackendError::Internal("bug".into())),
            ZipErrorCode::Internal
        );
        assert!(ZipJobError::from_backend("src", BackendError::Provider("x".into())).retryable);
    }
}
