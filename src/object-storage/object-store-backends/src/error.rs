use thiserror::Error;

#[derive(Error, Debug)]
pub enum BackendError {
    #[error("Object not found: {0}")]
    NotFound(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Range not satisfiable for object of {size} bytes")]
    RangeNotSatisfiable { size: u64 },

    #[error("Precondition failed for object: {0}")]
    PreconditionFailed(String),

    #[error("Provider error: {0}")]
    Provider(String),

    /// A transient provider failure (5xx, throttling, timeouts, dropped connections) that may
    /// succeed when the same request is sent again.
    #[error("Retryable provider error: {0}")]
    Retryable(String),

    #[error("Object too large: {0}")]
    TooLarge(String),

    /// Content that turned out longer or shorter than the size it was declared or known to have.
    #[error("Size mismatch: {0}")]
    SizeMismatch(String),

    #[error("Conflicting write: {0}")]
    Conflict(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl BackendError {
    pub fn is_retryable(&self) -> bool {
        matches!(self, BackendError::Retryable(_))
    }
}

pub type BackendResult<T> = Result<T, BackendError>;

pub(crate) fn is_transient_status(status: u16) -> bool {
    status >= 500 || status == 429 || status == 408
}
