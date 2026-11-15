//! Admission of zip job specs. A spec of `max_spec_bytes` takes several times its size in memory
//! and seconds of CPU to parse and validate, so request bodies share one weighted budget from
//! their first byte until the parsed spec is accounted as a queued job, and the CPU work runs
//! off the async runtime.

use std::fmt::Display;
use std::sync::Arc;
use std::time::Duration;

use bytes::Bytes;
use futures::{Stream, StreamExt};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

use super::JobRequestError;
use crate::error::ServiceError;
use crate::zip::{ZipJobError, ZipJobSpec, ZipSettings};

/// Bytes per permit; `acquire_many` takes a `u32`.
const PERMIT_BYTES: u64 = 1024;

pub(crate) struct SpecAdmission {
    permits: Arc<Semaphore>,
    total: u32,
    max_spec_bytes: usize,
    wait: Duration,
}

/// A validated spec with its hash, and the share of the parsing budget its request body took.
pub(crate) struct AdmittedSpec {
    pub spec: ZipJobSpec,
    pub hash: String,
    pub budget: Option<OwnedSemaphorePermit>,
}

impl SpecAdmission {
    pub fn new(settings: &ZipSettings) -> Self {
        let budget = settings.max_parsing_spec_bytes.max(settings.max_spec_bytes) as u64;
        let total = budget
            .div_ceil(PERMIT_BYTES)
            .clamp(1, (u32::MAX as u64).min(Semaphore::MAX_PERMITS as u64))
            as u32;

        SpecAdmission {
            permits: Arc::new(Semaphore::new(total as usize)),
            total,
            max_spec_bytes: settings.max_spec_bytes,
            wait: settings.spec_admission_wait,
        }
    }

    /// Reads a spec from a request body, taking budget for its `Content-Length` up front, or
    /// for the bytes read so far when the length is unknown, then parses and validates it.
    pub async fn read<S, E>(
        &self,
        content_length: Option<u64>,
        body: S,
        settings: &ZipSettings,
    ) -> Result<AdmittedSpec, JobRequestError>
    where
        S: Stream<Item = Result<Bytes, E>>,
        E: Display,
    {
        let too_large = || JobRequestError::SpecTooLarge(self.max_spec_bytes);
        let expected = content_length.unwrap_or(0);
        if expected > self.max_spec_bytes as u64 {
            return Err(too_large());
        }

        let mut budget = self.reserve(None, expected).await?;
        let mut data = Vec::with_capacity(expected as usize);
        let mut body = std::pin::pin!(body);
        while let Some(chunk) = body.next().await {
            let chunk = chunk.map_err(|error| {
                JobRequestError::InvalidRequest(format!(
                    "failed to read the request body: {}",
                    error
                ))
            })?;
            let read = data.len() + chunk.len();
            if read > self.max_spec_bytes {
                return Err(too_large());
            }
            budget = self.reserve(budget, read as u64).await?;
            data.extend_from_slice(&chunk);
        }

        parse(data, budget, settings.clone()).await
    }

    async fn reserve(
        &self,
        held: Option<OwnedSemaphorePermit>,
        bytes: u64,
    ) -> Result<Option<OwnedSemaphorePermit>, JobRequestError> {
        let needed = bytes.div_ceil(PERMIT_BYTES).min(self.total as u64) as u32;
        let have = held
            .as_ref()
            .map_or(0, |permit| permit.num_permits() as u32);
        if needed <= have {
            return Ok(held);
        }

        let more = tokio::time::timeout(
            self.wait,
            self.permits.clone().acquire_many_owned(needed - have),
        )
        .await
        .map_err(|_| JobRequestError::TooManySpecs(self.wait))?
        .map_err(|_| ServiceError::Internal("the spec admission budget was closed".to_string()))?;

        Ok(Some(match held {
            Some(mut held) => {
                held.merge(more);
                held
            }
            None => more,
        }))
    }
}

/// Validates a spec that is already in memory and computes its hash, off the async runtime.
pub(crate) async fn check(
    spec: ZipJobSpec,
    settings: ZipSettings,
) -> Result<AdmittedSpec, JobRequestError> {
    blocking(move || validated(spec, &settings, None)).await
}

async fn parse(
    data: Vec<u8>,
    budget: Option<OwnedSemaphorePermit>,
    settings: ZipSettings,
) -> Result<AdmittedSpec, JobRequestError> {
    blocking(move || {
        let spec: ZipJobSpec = serde_json::from_slice(&data).map_err(|error| {
            JobRequestError::InvalidSpec(ZipJobError::invalid_spec(error.to_string()))
        })?;
        drop(data);
        validated(spec, &settings, budget)
    })
    .await
}

fn validated(
    spec: ZipJobSpec,
    settings: &ZipSettings,
    budget: Option<OwnedSemaphorePermit>,
) -> Result<AdmittedSpec, JobRequestError> {
    spec.validate(settings)
        .map_err(JobRequestError::InvalidSpec)?;
    let hash = spec.spec_hash();
    Ok(AdmittedSpec { spec, hash, budget })
}

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, JobRequestError> + Send + 'static,
) -> Result<T, JobRequestError> {
    tokio::task::spawn_blocking(work)
        .await
        .unwrap_or_else(|error| {
            Err(ServiceError::Internal(format!("zip job spec task failed: {}", error)).into())
        })
}
