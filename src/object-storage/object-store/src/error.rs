use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use std::io;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("Backend error: {0}")]
    Backend(#[from] object_store_backends::BackendError),

    #[error("Bucket not found: {0}")]
    BucketNotFound(String),

    #[error("Bucket already exists: {0}")]
    BucketAlreadyExists(String),

    #[error("Object not found: {0}")]
    ObjectNotFound(String),

    #[error("Invalid bucket name: {0}")]
    InvalidBucketName(String),

    #[error("Invalid object key: {0}")]
    InvalidObjectKey(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Lock acquisition error: {0}")]
    LockAcquisition(String),
}

/// Marks an I/O error as the client's request body failing (a dropped connection, a malformed or
/// stalled body) rather than storage, so it is answered with a 4xx instead of a 500.
#[derive(Debug)]
pub struct RequestBodyError(Box<dyn std::error::Error + Send + Sync>);

impl RequestBodyError {
    pub fn io(
        kind: io::ErrorKind,
        error: impl Into<Box<dyn std::error::Error + Send + Sync>>,
    ) -> io::Error {
        io::Error::new(kind, RequestBodyError(error.into()))
    }

    /// Keeps the kind, and the mark, of an I/O error inside the body error, however many layers
    /// of `axum::Error` the body wrapped it in.
    pub fn from_body(error: axum::Error) -> io::Error {
        let mut inner = error.into_inner();
        loop {
            inner = match inner.downcast::<axum::Error>() {
                Ok(error) => error.into_inner(),
                Err(inner) => break Self::from_boxed(inner),
            };
        }
    }

    fn from_boxed(error: Box<dyn std::error::Error + Send + Sync>) -> io::Error {
        match error.downcast::<io::Error>() {
            Ok(error) if Self::is(&error) => *error,
            Ok(error) => Self::io(error.kind(), error),
            Err(error) => Self::io(io::ErrorKind::Other, error),
        }
    }

    pub fn is(error: &io::Error) -> bool {
        error
            .get_ref()
            .is_some_and(|inner| inner.is::<RequestBodyError>())
    }
}

impl std::fmt::Display for RequestBodyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "request body failed: {}", self.0)
    }
}

impl std::error::Error for RequestBodyError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        Some(&*self.0)
    }
}

impl From<serde_json::Error> for ServiceError {
    fn from(err: serde_json::Error) -> Self {
        ServiceError::Internal(format!("JSON error: {}", err))
    }
}

impl IntoResponse for ServiceError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            ServiceError::BucketNotFound(_) | ServiceError::ObjectNotFound(_) => {
                (StatusCode::NOT_FOUND, self.to_string())
            }
            ServiceError::BucketAlreadyExists(_) => (StatusCode::CONFLICT, self.to_string()),
            ServiceError::InvalidBucketName(_) | ServiceError::InvalidObjectKey(_) => {
                (StatusCode::BAD_REQUEST, self.to_string())
            }
            ServiceError::Backend(object_store_backends::BackendError::NotFound(key)) => {
                (StatusCode::NOT_FOUND, format!("Object not found: {}", key))
            }
            ServiceError::Backend(object_store_backends::BackendError::Retryable(_)) => {
                (StatusCode::SERVICE_UNAVAILABLE, self.to_string())
            }
            ServiceError::Backend(object_store_backends::BackendError::TooLarge(_)) => {
                (StatusCode::PAYLOAD_TOO_LARGE, self.to_string())
            }
            ServiceError::Backend(object_store_backends::BackendError::Conflict(_)) => {
                (StatusCode::CONFLICT, self.to_string())
            }
            ServiceError::Backend(object_store_backends::BackendError::SizeMismatch(_))
            | ServiceError::Backend(object_store_backends::BackendError::InvalidRequest(_)) => {
                (StatusCode::BAD_REQUEST, self.to_string())
            }
            ServiceError::Backend(object_store_backends::BackendError::PreconditionFailed(_)) => {
                (StatusCode::PRECONDITION_FAILED, self.to_string())
            }
            ServiceError::Backend(object_store_backends::BackendError::Unsupported(_)) => {
                (StatusCode::NOT_IMPLEMENTED, self.to_string())
            }
            ServiceError::Backend(object_store_backends::BackendError::Io(ref error))
                if RequestBodyError::is(error) =>
            {
                let status = match error.kind() {
                    io::ErrorKind::TimedOut => StatusCode::REQUEST_TIMEOUT,
                    _ => StatusCode::BAD_REQUEST,
                };
                (status, error.to_string())
            }
            ServiceError::Backend(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
        };

        let body = Json(json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}

pub type ServiceResult<T> = Result<T, ServiceError>;

#[cfg(test)]
mod tests {
    use super::*;
    use object_store_backends::BackendError;

    fn status_of(error: BackendError) -> StatusCode {
        ServiceError::Backend(error).into_response().status()
    }

    #[test]
    fn maps_backend_errors_to_statuses() {
        assert_eq!(
            status_of(BackendError::Retryable("slow down".to_string())),
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(
            status_of(BackendError::TooLarge("5 TiB".to_string())),
            StatusCode::PAYLOAD_TOO_LARGE
        );
        assert_eq!(
            status_of(BackendError::Conflict("superseded".to_string())),
            StatusCode::CONFLICT
        );
        assert_eq!(
            status_of(BackendError::NotFound("a".to_string())),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            status_of(BackendError::SizeMismatch("3 bytes, not 4".to_string())),
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            status_of(BackendError::Provider("denied".to_string())),
            StatusCode::INTERNAL_SERVER_ERROR
        );
    }

    #[test]
    fn blames_the_client_only_for_its_own_request_body() {
        assert_eq!(
            status_of(BackendError::Io(RequestBodyError::io(
                io::ErrorKind::ConnectionReset,
                "client went away"
            ))),
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            status_of(BackendError::Io(RequestBodyError::io(
                io::ErrorKind::TimedOut,
                "stalled"
            ))),
            StatusCode::REQUEST_TIMEOUT
        );
        assert_eq!(
            status_of(BackendError::Io(io::Error::new(
                io::ErrorKind::ConnectionReset,
                "storage went away"
            ))),
            StatusCode::INTERNAL_SERVER_ERROR
        );
        assert_eq!(
            status_of(BackendError::Io(io::Error::other("disk full"))),
            StatusCode::INTERNAL_SERVER_ERROR
        );
    }

    #[test]
    fn keeps_the_mark_through_a_body_error() {
        let marked = RequestBodyError::io(io::ErrorKind::TimedOut, "stalled");
        let through_body = RequestBodyError::from_body(axum::Error::new(axum::Error::new(marked)));
        assert!(RequestBodyError::is(&through_body));
        assert_eq!(through_body.kind(), io::ErrorKind::TimedOut);

        let plain = RequestBodyError::from_body(axum::Error::new(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            "incomplete body",
        )));
        assert!(RequestBodyError::is(&plain));
        assert_eq!(plain.kind(), io::ErrorKind::UnexpectedEof);

        let opaque = RequestBodyError::from_body(axum::Error::new("hyper says no"));
        assert!(RequestBodyError::is(&opaque));
        assert_eq!(opaque.kind(), io::ErrorKind::Other);
    }
}
