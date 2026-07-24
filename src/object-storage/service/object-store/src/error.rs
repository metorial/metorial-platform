use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
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
