use std::error::Error;

use aws_smithy_types::error::metadata::ProvideErrorMetadata;

use crate::errors::{describe_error_with_code, CodedError, ErrorInfo};

/// Wraps an AWS SDK error so the error code survives being returned from a check as a boxed error.
pub fn coded<E>(error: E) -> CodedError
where
    E: ProvideErrorMetadata + Error + Send + Sync + 'static,
{
    let code = error.code().unwrap_or_default().to_string();
    CodedError::new(code, error)
}

pub fn describe_aws_error<E>(error: &E) -> ErrorInfo
where
    E: ProvideErrorMetadata + Error + 'static,
{
    describe_error_with_code(error, error.code())
}
