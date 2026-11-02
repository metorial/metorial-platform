use async_trait::async_trait;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::pin::Pin;

use crate::error::BackendResult;

pub type ByteStream = Pin<Box<dyn Stream<Item = Result<Bytes, std::io::Error>> + Send>>;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum PublicUrlPurpose {
    #[default]
    Retrieve,
    Upload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectMetadata {
    pub key: String,
    pub size: u64,
    pub content_type: Option<String>,
    pub etag: String,
    pub last_modified: DateTime<Utc>,
    pub custom_metadata: HashMap<String, String>,
}

pub struct ObjectData {
    pub metadata: ObjectMetadata,
    pub stream: ByteStream,
}

/// A single byte range as sent in an HTTP `Range: bytes=...` header. `end` is inclusive.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ByteRange {
    /// `bytes=start-end`
    Bounded { start: u64, end: u64 },
    /// `bytes=start-`
    From { start: u64 },
    /// `bytes=-length`: the last `length` bytes
    Suffix { length: u64 },
}

impl ByteRange {
    /// Parses a `Range` header value. Returns `None` for anything that is not a single, well-formed
    /// `bytes` range; RFC 9110 says such headers are ignored and the full object is served.
    pub fn parse_header(value: &str) -> Option<ByteRange> {
        let spec = value.trim().strip_prefix("bytes=")?;

        if spec.contains(',') {
            return None;
        }

        let (start, end) = spec.split_once('-')?;
        let (start, end) = (start.trim(), end.trim());

        match (start.is_empty(), end.is_empty()) {
            (true, true) => None,
            (true, false) => Some(ByteRange::Suffix {
                length: end.parse().ok()?,
            }),
            (false, true) => Some(ByteRange::From {
                start: start.parse().ok()?,
            }),
            (false, false) => {
                let (start, end) = (start.parse().ok()?, end.parse().ok()?);
                if end < start {
                    return None;
                }
                Some(ByteRange::Bounded { start, end })
            }
        }
    }

    /// The header value to send to a backend that speaks HTTP ranges natively.
    pub fn to_header(&self) -> String {
        match self {
            ByteRange::Bounded { start, end } => format!("bytes={}-{}", start, end),
            ByteRange::From { start } => format!("bytes={}-", start),
            ByteRange::Suffix { length } => format!("bytes=-{}", length),
        }
    }

    /// Resolves the range against the object size to an absolute, inclusive `(start, end)`.
    /// `None` means the range cannot be satisfied (HTTP 416).
    pub fn resolve(&self, size: u64) -> Option<(u64, u64)> {
        if size == 0 {
            return None;
        }

        match *self {
            ByteRange::Bounded { start, end } => {
                if start >= size {
                    None
                } else {
                    Some((start, end.min(size - 1)))
                }
            }
            ByteRange::From { start } => {
                if start >= size {
                    None
                } else {
                    Some((start, size - 1))
                }
            }
            ByteRange::Suffix { length } => {
                if length == 0 {
                    None
                } else {
                    Some((size.saturating_sub(length), size - 1))
                }
            }
        }
    }
}

/// A part of an object. `metadata` describes the whole object (`size` is the total size);
/// `start` and `end` are the absolute, inclusive bounds of the bytes in `stream`.
pub struct ObjectRangeData {
    pub metadata: ObjectMetadata,
    pub start: u64,
    pub end: u64,
    pub stream: ByteStream,
}

impl ObjectRangeData {
    // An inclusive range always covers at least one byte, so there is no is_empty.
    #[allow(clippy::len_without_is_empty)]
    pub fn len(&self) -> u64 {
        self.end - self.start + 1
    }
}

#[derive(Debug, Clone, Default)]
pub struct ObjectPage {
    pub objects: Vec<ObjectMetadata>,
    pub next_continuation_token: Option<String>,
}

#[async_trait]
pub trait Backend: Send + Sync {
    async fn init(&self) -> BackendResult<()>;

    async fn put_object(
        &self,
        key: &str,
        stream: ByteStream,
        content_type: Option<String>,
        metadata: HashMap<String, String>,
    ) -> BackendResult<ObjectMetadata>;

    async fn get_object(&self, key: &str) -> BackendResult<ObjectData>;

    /// Reads only `range` of the object, natively on the backend; the rest is never transferred.
    /// Fails with `BackendError::RangeNotSatisfiable` when the range lies outside the object.
    async fn get_object_range(&self, key: &str, range: ByteRange)
        -> BackendResult<ObjectRangeData>;

    async fn head_object(&self, key: &str) -> BackendResult<ObjectMetadata>;

    async fn delete_object(&self, key: &str) -> BackendResult<()>;

    async fn delete_objects(&self, keys: &[String]) -> BackendResult<Vec<BackendResult<()>>> {
        let mut results = Vec::with_capacity(keys.len());
        for key in keys {
            results.push(self.delete_object(key).await);
        }
        Ok(results)
    }

    async fn copy_object(&self, source_key: &str, dest_key: &str) -> BackendResult<ObjectMetadata> {
        let source = self.get_object(source_key).await?;

        self.put_object(
            dest_key,
            source.stream,
            source.metadata.content_type,
            source.metadata.custom_metadata,
        )
        .await
    }

    async fn list_objects(
        &self,
        prefix: Option<&str>,
        max_keys: Option<usize>,
        continuation_token: Option<&str>,
    ) -> BackendResult<ObjectPage>;

    async fn list_all_objects(&self, prefix: Option<&str>) -> BackendResult<Vec<ObjectMetadata>> {
        let mut all = Vec::new();
        let mut token: Option<String> = None;

        loop {
            let page = self.list_objects(prefix, None, token.as_deref()).await?;
            all.extend(page.objects);

            match page.next_continuation_token {
                Some(next) => token = Some(next),
                None => return Ok(all),
            }
        }
    }

    async fn object_exists(&self, key: &str) -> BackendResult<bool> {
        match self.head_object(key).await {
            Ok(_) => Ok(true),
            Err(crate::error::BackendError::NotFound(_)) => Ok(false),
            Err(e) => Err(e),
        }
    }

    async fn get_public_url(
        &self,
        key: &str,
        expiration_secs: u64,
        purpose: PublicUrlPurpose,
    ) -> BackendResult<String>;
}

pub fn compute_etag(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::ByteRange;

    #[test]
    fn parses_single_ranges() {
        assert_eq!(
            ByteRange::parse_header("bytes=0-99"),
            Some(ByteRange::Bounded { start: 0, end: 99 })
        );
        assert_eq!(
            ByteRange::parse_header("bytes=100-"),
            Some(ByteRange::From { start: 100 })
        );
        assert_eq!(
            ByteRange::parse_header("bytes=-50"),
            Some(ByteRange::Suffix { length: 50 })
        );
    }

    #[test]
    fn ignores_unsupported_or_malformed_headers() {
        for value in [
            "",
            "bytes=",
            "bytes=-",
            "bytes=5-2",
            "bytes=a-b",
            "bytes=0-1,5-6",
            "items=0-1",
            "0-1",
        ] {
            assert_eq!(ByteRange::parse_header(value), None, "{value}");
        }
    }

    #[test]
    fn resolves_against_the_object_size() {
        assert_eq!(
            ByteRange::Bounded { start: 0, end: 9 }.resolve(100),
            Some((0, 9))
        );
        assert_eq!(
            ByteRange::Bounded {
                start: 90,
                end: 500
            }
            .resolve(100),
            Some((90, 99))
        );
        assert_eq!(
            ByteRange::Bounded {
                start: 100,
                end: 200
            }
            .resolve(100),
            None
        );
        assert_eq!(ByteRange::From { start: 40 }.resolve(100), Some((40, 99)));
        assert_eq!(ByteRange::From { start: 100 }.resolve(100), None);
        assert_eq!(
            ByteRange::Suffix { length: 10 }.resolve(100),
            Some((90, 99))
        );
        assert_eq!(
            ByteRange::Suffix { length: 500 }.resolve(100),
            Some((0, 99))
        );
        assert_eq!(ByteRange::Suffix { length: 0 }.resolve(100), None);
        assert_eq!(ByteRange::Bounded { start: 0, end: 0 }.resolve(0), None);
    }

    #[test]
    fn formats_the_backend_header() {
        assert_eq!(
            ByteRange::Bounded { start: 1, end: 2 }.to_header(),
            "bytes=1-2"
        );
        assert_eq!(ByteRange::From { start: 3 }.to_header(), "bytes=3-");
        assert_eq!(ByteRange::Suffix { length: 4 }.to_header(), "bytes=-4");
    }
}
