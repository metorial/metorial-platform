use async_trait::async_trait;
use bytes::Bytes;
use std::collections::HashMap;

use crate::backend::ObjectMetadata;
use crate::error::BackendResult;

pub const KIB: u64 = 1024;
pub const MIB: u64 = 1024 * KIB;
pub const GIB: u64 = 1024 * MIB;
pub const TIB: u64 = 1024 * GIB;

/// What a backend's multipart primitives accept. Every non-final part is at least
/// `min_part_size` and a multiple of `part_alignment`; no part exceeds `max_part_size`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct UploadLimits {
    pub min_part_size: u64,
    pub max_part_size: u64,
    pub max_parts: u32,
    pub part_alignment: u64,
    pub max_concurrency: u32,
    pub max_object_size: u64,
}

impl UploadLimits {
    pub const UNBOUNDED: UploadLimits = UploadLimits {
        min_part_size: 1,
        max_part_size: u64::MAX,
        max_parts: u32::MAX,
        part_alignment: 1,
        max_concurrency: u32::MAX,
        max_object_size: u64::MAX,
    };
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PartReceipt {
    /// 1-based and contiguous in stream order.
    pub number: u32,
    pub offset: u64,
    pub size: u64,
    pub etag: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct PutOptions {
    pub content_type: Option<String>,
    pub metadata: HashMap<String, String>,
    /// Expected object size, e.g. a request's Content-Length or an upper-bound estimate. Only
    /// used to size parts; the actual stream length may differ in either direction.
    pub size_hint: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct UploadedObject {
    /// `size` is the number of bytes read from the stream; `etag` is the backend's.
    pub metadata: ObjectMetadata,
    /// Hex SHA-256 of the full stream.
    pub sha256: String,
}

/// An upload started with `Backend::start_multipart`. The driver calls `upload_part` (possibly
/// concurrently, up to `UploadLimits::max_concurrency`, and again for a part after a retryable
/// failure), then `complete`. `abort` is called instead, or after a failed `complete`, when the
/// upload fails or is cancelled.
#[async_trait]
pub trait MultipartUpload: Send + Sync {
    async fn upload_part(
        &self,
        number: u32,
        offset: u64,
        data: Bytes,
    ) -> BackendResult<PartReceipt>;

    /// `parts` are sorted by number and cover the object without gaps. Fails with `NotFound` when
    /// the backend no longer knows the upload, as after an earlier attempt that completed it.
    async fn complete(&self, parts: Vec<PartReceipt>) -> BackendResult<ObjectMetadata>;

    async fn abort(&self);
}
