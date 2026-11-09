use std::sync::Arc;
use std::time::Duration;

use bytes::Bytes;
use futures::StreamExt;
use object_store_backends::{Backend, BackendError, ByteRange, ByteStream, RetryPolicy};
use tracing::warn;

use super::error::{ZipErrorCode, ZipJobError};

/// A source object as HEAD reported it before the archive was planned.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceVersion {
    pub size: u64,
    pub etag: String,
}

#[derive(Debug, Clone)]
pub struct ReconnectPolicy {
    pub max_reconnects: u32,
    pub backoff: RetryPolicy,
    pub idle_timeout: Duration,
}

/// Reads exactly one version of one source object, reconnecting with a range request from the
/// last byte received when the stream fails, stalls or ends early.
///
/// Every (re)connection must report the HEAD ETag and size, otherwise the read fails with
/// `source_changed`. The reader never yields more than the HEAD size: a stream that runs past it
/// fails with `source_changed` before the excess is handed out, and one that keeps ending short
/// fails with `source_changed` once reconnects run out.
pub struct SourceReader {
    backend: Arc<dyn Backend>,
    key: String,
    expected: SourceVersion,
    policy: ReconnectPolicy,
    stream: Option<ByteStream>,
    consumed: u64,
    reconnects: u32,
    finished: bool,
}

enum Interruption {
    Failed(String),
    EndedEarly,
}

enum OpenError {
    Backend(BackendError),
    Changed(String),
}

impl From<BackendError> for OpenError {
    fn from(error: BackendError) -> Self {
        OpenError::Backend(error)
    }
}

impl SourceReader {
    pub fn new(
        backend: Arc<dyn Backend>,
        key: String,
        expected: SourceVersion,
        policy: ReconnectPolicy,
    ) -> Self {
        SourceReader {
            backend,
            key,
            expected,
            policy,
            stream: None,
            consumed: 0,
            reconnects: 0,
            finished: false,
        }
    }

    pub fn size(&self) -> u64 {
        self.expected.size
    }

    pub fn consumed(&self) -> u64 {
        self.consumed
    }

    pub fn reconnects(&self) -> u32 {
        self.reconnects
    }

    /// The next non-empty chunk, or `None` once exactly the HEAD size has been read and the
    /// stream has confirmed it has nothing more.
    pub async fn next_chunk(&mut self) -> Result<Option<Bytes>, ZipJobError> {
        if self.finished {
            return Ok(None);
        }

        loop {
            let stream = match self.stream.as_mut() {
                Some(stream) => stream,
                None => {
                    let stream = self.connect().await?;
                    self.stream.insert(stream)
                }
            };

            let interruption =
                match tokio::time::timeout(self.policy.idle_timeout, stream.next()).await {
                    Err(_) => {
                        Interruption::Failed(format!("no data for {:?}", self.policy.idle_timeout))
                    }
                    Ok(Some(Err(error))) => Interruption::Failed(error.to_string()),
                    Ok(Some(Ok(chunk))) if chunk.is_empty() => continue,
                    Ok(Some(Ok(chunk))) => return self.accept(chunk).map(Some),
                    Ok(None) if self.consumed == self.expected.size => {
                        self.stream = None;
                        self.finished = true;
                        return Ok(None);
                    }
                    Ok(None) => Interruption::EndedEarly,
                };

            self.stream = None;
            self.interrupted(interruption).await?;
        }
    }

    fn accept(&mut self, chunk: Bytes) -> Result<Bytes, ZipJobError> {
        match self
            .consumed
            .checked_add(chunk.len() as u64)
            .filter(|&end| end <= self.expected.size)
        {
            Some(end) => {
                self.consumed = end;
                Ok(chunk)
            }
            None => Err(self.changed(&format!(
                "it returned more than the {} bytes HEAD reported",
                self.expected.size
            ))),
        }
    }

    async fn interrupted(&mut self, interruption: Interruption) -> Result<(), ZipJobError> {
        if self.reconnects >= self.policy.max_reconnects {
            return Err(match interruption {
                Interruption::Failed(reason) => ZipJobError::new(
                    ZipErrorCode::BackendError,
                    format!(
                        "reading {} failed after {} reconnects at byte {} of {}: {}",
                        self.key, self.reconnects, self.consumed, self.expected.size, reason
                    ),
                ),
                Interruption::EndedEarly => self.changed(&format!(
                    "it ended after {} of the {} bytes HEAD reported",
                    self.consumed, self.expected.size
                )),
            });
        }

        self.reconnects += 1;
        let delay = self.policy.backoff.delay(self.reconnects);
        warn!(
            "Reconnecting to {} at byte {} of {} in {:?} (reconnect {} of {})",
            self.key,
            self.consumed,
            self.expected.size,
            delay,
            self.reconnects,
            self.policy.max_reconnects
        );
        tokio::time::sleep(delay).await;
        Ok(())
    }

    async fn connect(&mut self) -> Result<ByteStream, ZipJobError> {
        loop {
            let error = match self.open().await {
                Ok(stream) => return Ok(stream),
                Err(OpenError::Changed(reason)) => return Err(self.changed(&reason)),
                Err(OpenError::Backend(error)) => error,
            };

            match error {
                error if error.is_retryable() => {
                    self.interrupted(Interruption::Failed(error.to_string()))
                        .await?
                }
                BackendError::NotFound(_) => {
                    return Err(ZipJobError::new(
                        ZipErrorCode::SourceNotFound,
                        format!("{} was deleted while it was being archived", self.key),
                    ))
                }
                BackendError::RangeNotSatisfiable { size } => {
                    return Err(self.changed(&format!("it is now {} bytes", size)))
                }
                error => {
                    return Err(ZipJobError::from_backend(
                        &format!("reading {}", self.key),
                        error,
                    ))
                }
            }
        }
    }

    async fn open(&mut self) -> Result<ByteStream, OpenError> {
        let (metadata, start, stream) = if self.consumed == 0 {
            let object = self.backend.get_object(&self.key).await?;
            (object.metadata, 0, object.stream)
        } else {
            let range = ByteRange::From {
                start: self.consumed,
            };
            let part = self.backend.get_object_range(&self.key, range).await?;
            (part.metadata, part.start, part.stream)
        };

        if metadata.etag != self.expected.etag {
            return Err(OpenError::Changed(format!(
                "its ETag is now {:?}, HEAD reported {:?}",
                metadata.etag, self.expected.etag
            )));
        }

        if metadata.size != self.expected.size {
            return Err(OpenError::Changed(format!(
                "it is now {} bytes, HEAD reported {}",
                metadata.size, self.expected.size
            )));
        }

        if start != self.consumed {
            return Err(OpenError::Backend(BackendError::Internal(format!(
                "range read of {} started at byte {} instead of {}",
                self.key, start, self.consumed
            ))));
        }

        Ok(stream)
    }

    fn changed(&self, reason: &str) -> ZipJobError {
        ZipJobError::source_changed(format!(
            "{} changed while it was being archived: {}",
            self.key, reason
        ))
    }
}
