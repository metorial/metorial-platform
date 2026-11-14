use async_trait::async_trait;
use aws_config::meta::region::RegionProviderChain;
use aws_config::BehaviorVersion;
use aws_sdk_s3::config::http::HttpResponse;
use aws_sdk_s3::config::{Region, RequestChecksumCalculation, ResponseChecksumValidation};
use aws_sdk_s3::error::{ProvideErrorMetadata, SdkError};
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::primitives::ByteStream as AwsByteStream;
use aws_sdk_s3::types::{CompletedMultipartUpload, CompletedPart};
use aws_sdk_s3::Client;
use aws_smithy_types::error::display::DisplayErrorContext;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio_util::io::ReaderStream;
use tracing::{debug, info, warn};

use bytes::Bytes;

use crate::backend::{
    copy_through_stream, normalize_etag, Backend, ByteRange, ByteStream, ObjectData,
    ObjectMetadata, ObjectPage, ObjectRangeData, PublicUrlPurpose, SignedUrl, WritePrecondition,
};
use crate::durable::{
    validate_part_list, validate_part_number, validate_part_size, validate_upload_id, DurablePart,
    DurablePartRef, DurableUpload,
};
use crate::error::{is_transient_status, BackendError, BackendResult};
use crate::multipart::{MultipartUpload, PartReceipt, PutOptions, UploadLimits, GIB, MIB, TIB};
use crate::uploader::Uploader;

const S3_LIMITS: UploadLimits = UploadLimits {
    min_part_size: 5 * MIB,
    max_part_size: 5 * GIB,
    max_parts: 10_000,
    part_alignment: 1,
    max_concurrency: u32::MAX,
    max_object_size: 5 * TIB,
};

const MAX_COPY_OBJECT_SIZE: u64 = 5 * GIB;

const TRANSIENT_ERROR_CODES: &[&str] = &[
    "InternalError",
    "RequestTimeout",
    "ServiceUnavailable",
    "SlowDown",
    "Throttling",
    "ThrottlingException",
    "RequestLimitExceeded",
];

pub struct S3Backend {
    create_bucket: bool,
    client: Client,
    signing_client: Client,
    bucket_name: String,
    uploader: Arc<Uploader>,
}

fn is_transient<E: ProvideErrorMetadata>(error: &SdkError<E, HttpResponse>) -> bool {
    match error {
        SdkError::TimeoutError(_) | SdkError::DispatchFailure(_) | SdkError::ResponseError(_) => {
            true
        }
        SdkError::ServiceError(_) => {
            error
                .raw_response()
                .is_some_and(|response| is_transient_status(response.status().as_u16()))
                || error
                    .code()
                    .is_some_and(|code| TRANSIENT_ERROR_CODES.contains(&code))
        }
        _ => false,
    }
}

fn s3_error<E: ProvideErrorMetadata>(
    message: String,
    error: &SdkError<E, HttpResponse>,
) -> BackendError {
    if is_transient(error) {
        BackendError::Retryable(message)
    } else {
        BackendError::Provider(message)
    }
}

fn complete_error<E: ProvideErrorMetadata>(
    key: &str,
    error: &SdkError<E, HttpResponse>,
) -> BackendError {
    let message = format!("Failed to complete upload of '{}': {}", key, error);
    if error.code() == Some("NoSuchUpload") {
        BackendError::NotFound(message)
    } else {
        s3_error(message, error)
    }
}

#[derive(Debug, Clone, Default)]
pub struct S3Options {
    pub region: String,
    /// Endpoint the service talks to, for S3-compatible stores such as MinIO or Ceph.
    pub endpoint: Option<String>,
    /// Endpoint embedded in signed URLs, when clients reach the store under a different address
    /// than the service does. Defaults to `endpoint`.
    pub public_endpoint: Option<String>,
    /// Defaults to true when `endpoint` is set and false otherwise.
    pub force_path_style: Option<bool>,
    /// Create the bucket on startup when it does not exist (self-hosted stores such as SeaweedFS or
    /// MinIO, where the bucket is part of the deployment).
    pub create_bucket: bool,
}

impl S3Backend {
    pub async fn new(bucket_name: String) -> BackendResult<Self> {
        let config = aws_config::defaults(BehaviorVersion::latest()).load().await;
        let client = Self::build_client(&config, None, false);

        info!("Initialized S3 backend with bucket: {}", bucket_name);
        Ok(Self {
            signing_client: client.clone(),
            client,
            bucket_name,
            create_bucket: false,
            uploader: Arc::default(),
        })
    }

    pub async fn new_with_config(
        bucket_name: String,
        region: String,
        endpoint: Option<String>,
    ) -> BackendResult<Self> {
        Self::new_with_options(
            bucket_name,
            S3Options {
                region,
                endpoint,
                ..Default::default()
            },
        )
        .await
    }

    pub async fn new_with_options(bucket_name: String, options: S3Options) -> BackendResult<Self> {
        let region_provider = RegionProviderChain::first_try(Region::new(options.region.clone()));

        let config = aws_config::defaults(BehaviorVersion::latest())
            .region(region_provider)
            .load()
            .await;

        let custom_endpoint = options.endpoint.is_some();
        let force_path_style = options.force_path_style.unwrap_or(custom_endpoint);

        let client = Self::build_client(&config, options.endpoint.as_deref(), force_path_style);

        let signing_client = match options.public_endpoint.as_deref() {
            Some(public_endpoint) => {
                Self::build_client(&config, Some(public_endpoint), force_path_style)
            }
            None => client.clone(),
        };

        if let Some(endpoint) = &options.endpoint {
            info!(
                "Using custom S3 endpoint: {} (public: {:?}, path style: {}) for bucket: {}",
                endpoint, options.public_endpoint, force_path_style, bucket_name
            );
        }

        info!("Initialized S3 backend with bucket: {}", bucket_name);
        Ok(Self {
            client,
            signing_client,
            bucket_name,
            create_bucket: options.create_bucket,
            uploader: Arc::default(),
        })
    }

    pub fn with_uploader(mut self, uploader: Arc<Uploader>) -> Self {
        self.uploader = uploader;
        self
    }

    // Checksums are only sent when an operation requires them. The SDK default adds CRC32 to every
    // request, which MinIO and Ceph releases without trailing-checksum support reject, and which
    // ends up in presigned PUT URLs as a header the uploader cannot satisfy.
    fn build_client(
        config: &aws_config::SdkConfig,
        endpoint: Option<&str>,
        force_path_style: bool,
    ) -> Client {
        let mut builder = aws_sdk_s3::config::Builder::from(config)
            .request_checksum_calculation(RequestChecksumCalculation::WhenRequired)
            .response_checksum_validation(ResponseChecksumValidation::WhenRequired)
            .force_path_style(force_path_style);

        if let Some(endpoint) = endpoint {
            builder = builder.endpoint_url(endpoint);
        }

        Client::from_conf(builder.build())
    }

    fn s3_metadata_to_object_metadata(
        key: String,
        size: i64,
        last_modified: Option<DateTime<Utc>>,
        etag: Option<String>,
        content_type: Option<String>,
        metadata: HashMap<String, String>,
    ) -> ObjectMetadata {
        ObjectMetadata {
            key: key.clone(),
            size: size as u64,
            content_type,
            etag: etag.map(|etag| normalize_etag(&etag)).unwrap_or_else(|| {
                use sha2::{Digest, Sha256};
                let mut hasher = Sha256::new();
                hasher.update(key.as_bytes());
                hex::encode(hasher.finalize())
            }),
            last_modified: last_modified.unwrap_or_else(Utc::now),
            custom_metadata: metadata,
        }
    }
}

struct S3MultipartUpload {
    client: Client,
    bucket_name: String,
    key: String,
    upload_id: String,
    content_type: Option<String>,
    custom_metadata: HashMap<String, String>,
}

impl S3MultipartUpload {
    async fn current_etag(&self) -> BackendResult<String> {
        let output = self
            .client
            .head_object()
            .bucket(&self.bucket_name)
            .key(&self.key)
            .send()
            .await
            .map_err(|e| {
                s3_error(
                    format!("Failed to read the etag of '{}': {}", self.key, e),
                    &e,
                )
            })?;

        output.e_tag().map(normalize_etag).ok_or_else(|| {
            BackendError::Provider(format!("S3 returned no etag for '{}'", self.key))
        })
    }
}

#[async_trait]
impl MultipartUpload for S3MultipartUpload {
    async fn upload_part(
        &self,
        number: u32,
        offset: u64,
        data: Bytes,
    ) -> BackendResult<PartReceipt> {
        let size = data.len() as u64;

        let output = self
            .client
            .upload_part()
            .bucket(&self.bucket_name)
            .key(&self.key)
            .upload_id(&self.upload_id)
            .part_number(number as i32)
            .content_length(size as i64)
            .body(AwsByteStream::from(data))
            .send()
            .await
            .map_err(|e| {
                warn!(
                    "Failed to upload part {} of {} to S3: {:?}",
                    number, self.key, e
                );
                s3_error(
                    format!("Failed to upload part {} of '{}': {}", number, self.key, e),
                    &e,
                )
            })?;

        Ok(PartReceipt {
            number,
            offset,
            size,
            etag: output.e_tag().map(|s| s.to_string()),
        })
    }

    async fn complete(&self, parts: Vec<PartReceipt>) -> BackendResult<ObjectMetadata> {
        let size = parts.iter().map(|part| part.size).sum();

        let completed = CompletedMultipartUpload::builder()
            .set_parts(Some(
                parts
                    .iter()
                    .map(|part| {
                        CompletedPart::builder()
                            .set_e_tag(part.etag.clone())
                            .part_number(part.number as i32)
                            .build()
                    })
                    .collect(),
            ))
            .build();

        let output = self
            .client
            .complete_multipart_upload()
            .bucket(&self.bucket_name)
            .key(&self.key)
            .upload_id(&self.upload_id)
            .multipart_upload(completed)
            .send()
            .await
            .map_err(|e| {
                warn!(
                    "Failed to complete multipart upload to S3: {}: {:?}",
                    self.key, e
                );
                complete_error(&self.key, &e)
            })?;

        let etag = match output.e_tag() {
            Some(etag) => normalize_etag(etag),
            None => self.current_etag().await?,
        };

        debug!(
            "Uploaded object to S3 in {} parts: {} ({} bytes)",
            parts.len(),
            self.key,
            size
        );

        Ok(ObjectMetadata {
            key: self.key.clone(),
            size,
            content_type: self.content_type.clone(),
            last_modified: Utc::now(),
            etag,
            custom_metadata: self.custom_metadata.clone(),
        })
    }

    async fn abort(&self) {
        if let Err(e) = self
            .client
            .abort_multipart_upload()
            .bucket(&self.bucket_name)
            .key(&self.key)
            .upload_id(&self.upload_id)
            .send()
            .await
        {
            warn!("Failed to abort multipart upload for {}: {:?}", self.key, e);
        }
    }
}

#[async_trait]
impl Backend for S3Backend {
    async fn init(&self) -> BackendResult<()> {
        match self
            .client
            .head_bucket()
            .bucket(&self.bucket_name)
            .send()
            .await
        {
            Ok(_) => {
                info!("S3 bucket {} is accessible", self.bucket_name);
                Ok(())
            }
            Err(e)
                if self.create_bucket && e.as_service_error().is_some_and(|e| e.is_not_found()) =>
            {
                match self
                    .client
                    .create_bucket()
                    .bucket(&self.bucket_name)
                    .send()
                    .await
                {
                    Ok(_) => info!("Created S3 bucket {}", self.bucket_name),
                    Err(e)
                        if e.as_service_error()
                            .is_some_and(|e| e.is_bucket_already_owned_by_you()) =>
                    {
                        info!("S3 bucket {} was created concurrently", self.bucket_name);
                    }
                    Err(e) => {
                        return Err(BackendError::Configuration(format!(
                            "Cannot create S3 bucket '{}': {}",
                            self.bucket_name,
                            DisplayErrorContext(&e)
                        )));
                    }
                }
                Ok(())
            }
            Err(e) => {
                warn!("Failed to access S3 bucket {}: {:?}", self.bucket_name, e);
                Err(BackendError::Configuration(format!(
                    "Cannot access S3 bucket '{}': {}",
                    self.bucket_name, e
                )))
            }
        }
    }

    fn uploader(&self) -> &Uploader {
        &self.uploader
    }

    fn upload_limits(&self) -> UploadLimits {
        S3_LIMITS
    }

    async fn put_single(
        &self,
        key: &str,
        data: Bytes,
        opts: &PutOptions,
    ) -> BackendResult<ObjectMetadata> {
        let size = data.len() as u64;
        let fallback_etag = crate::backend::compute_etag(&data);

        let mut request = self
            .client
            .put_object()
            .bucket(&self.bucket_name)
            .key(key)
            .body(AwsByteStream::from(data));

        if let Some(ct) = opts.content_type.as_ref() {
            request = request.content_type(ct);
        }

        for (k, v) in opts.metadata.iter() {
            request = request.metadata(k.clone(), v.clone());
        }

        match request.send().await {
            Ok(output) => {
                debug!("Uploaded object to S3: {} ({} bytes)", key, size);
                Ok(ObjectMetadata {
                    key: key.to_string(),
                    size,
                    content_type: opts.content_type.clone(),
                    last_modified: Utc::now(),
                    etag: output.e_tag().map(normalize_etag).unwrap_or(fallback_etag),
                    custom_metadata: opts.metadata.clone(),
                })
            }
            Err(e) => {
                warn!("Failed to upload object to S3: {}: {:?}", key, e);
                Err(s3_error(
                    format!("Failed to upload object '{}': {}", key, e),
                    &e,
                ))
            }
        }
    }

    async fn start_multipart(
        &self,
        key: &str,
        opts: &PutOptions,
    ) -> BackendResult<Arc<dyn MultipartUpload>> {
        let mut create = self
            .client
            .create_multipart_upload()
            .bucket(&self.bucket_name)
            .key(key);

        if let Some(ct) = opts.content_type.as_ref() {
            create = create.content_type(ct);
        }

        for (k, v) in opts.metadata.iter() {
            create = create.metadata(k.clone(), v.clone());
        }

        // S3 keeps, and bills for, an upload whose id nobody received. So the request runs to the
        // end on its own task, and the upload is aborted if the caller is gone by then.
        let client = self.client.clone();
        let bucket_name = self.bucket_name.clone();
        let key = key.to_string();
        let content_type = opts.content_type.clone();
        let custom_metadata = opts.metadata.clone();
        let (sender, receiver) = tokio::sync::oneshot::channel();

        tokio::spawn(async move {
            let started = match create.send().await {
                Ok(created) => match created.upload_id() {
                    Some(upload_id) => Ok(S3MultipartUpload {
                        client,
                        bucket_name,
                        key,
                        upload_id: upload_id.to_string(),
                        content_type,
                        custom_metadata,
                    }),
                    None => Err(BackendError::Provider(format!(
                        "S3 returned no upload id for '{}'",
                        key
                    ))),
                },
                Err(e) => {
                    warn!("Failed to start multipart upload to S3: {}: {:?}", key, e);
                    Err(s3_error(
                        format!("Failed to start upload of '{}': {}", key, e),
                        &e,
                    ))
                }
            };

            if let Err(Ok(abandoned)) = sender.send(started) {
                debug!(
                    "Aborting multipart upload {} of {}, started after its caller gave up",
                    abandoned.upload_id, abandoned.key
                );
                abandoned.abort().await;
            }
        });

        let upload = receiver.await.map_err(|_| {
            BackendError::Internal("starting a multipart upload panicked".to_string())
        })??;
        Ok(Arc::new(upload))
    }

    async fn put_object_if(
        &self,
        key: &str,
        data: Bytes,
        content_type: Option<String>,
        precondition: WritePrecondition,
    ) -> BackendResult<ObjectMetadata> {
        let size = data.len() as u64;
        let fallback_etag = crate::backend::compute_etag(&data);

        let mut request = self
            .client
            .put_object()
            .bucket(&self.bucket_name)
            .key(key)
            .body(AwsByteStream::from(data));

        if let Some(ct) = content_type.as_ref() {
            request = request.content_type(ct);
        }

        request = match &precondition {
            WritePrecondition::IfAbsent => request.if_none_match("*"),
            WritePrecondition::IfMatch(etag) => request.if_match(format!("\"{}\"", etag)),
        };

        match request.send().await {
            Ok(output) => Ok(ObjectMetadata {
                key: key.to_string(),
                size,
                content_type,
                last_modified: Utc::now(),
                etag: output.e_tag().map(normalize_etag).unwrap_or(fallback_etag),
                custom_metadata: HashMap::new(),
            }),
            Err(e) => {
                let status = e.raw_response().map(|r| r.status().as_u16());

                // 409 is ConditionalRequestConflict: a concurrent conditional write to the key.
                if matches!(status, Some(412) | Some(409)) {
                    Err(BackendError::PreconditionFailed(key.to_string()))
                } else {
                    warn!("Failed conditional upload to S3: {}: {:?}", key, e);
                    Err(s3_error(
                        format!("Failed to upload object '{}': {}", key, e),
                        &e,
                    ))
                }
            }
        }
    }

    async fn get_object(&self, key: &str) -> BackendResult<ObjectData> {
        match self
            .client
            .get_object()
            .bucket(&self.bucket_name)
            .key(key)
            .send()
            .await
        {
            Ok(output) => {
                let content_type = output.content_type().map(|s| s.to_string());
                let etag = output.e_tag().map(|s| s.to_string());
                let size = output.content_length().unwrap_or(0) as u64;

                let metadata_map = output
                    .metadata()
                    .map(|m| m.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
                    .unwrap_or_default();

                let last_modified = output
                    .last_modified()
                    .and_then(|dt| DateTime::parse_from_rfc3339(&dt.to_string()).ok())
                    .map(|dt| dt.with_timezone(&Utc));

                debug!("Retrieved object from S3: {} ({} bytes)", key, size);

                let async_read = output.body.into_async_read();
                let stream: ByteStream = Box::pin(
                    ReaderStream::new(async_read)
                        .map(|result| result.map_err(std::io::Error::other)),
                );

                Ok(ObjectData {
                    metadata: Self::s3_metadata_to_object_metadata(
                        key.to_string(),
                        size as i64,
                        last_modified,
                        etag,
                        content_type,
                        metadata_map,
                    ),
                    stream,
                })
            }
            Err(e) => {
                let error_msg = format!("{:?}", e);
                if error_msg.contains("NoSuchKey") || error_msg.contains("NotFound") {
                    Err(BackendError::NotFound(key.to_string()))
                } else {
                    warn!("Failed to get object from S3: {}: {:?}", key, e);
                    Err(s3_error(
                        format!("Failed to get object '{}': {}", key, e),
                        &e,
                    ))
                }
            }
        }
    }

    async fn get_object_range(
        &self,
        key: &str,
        range: ByteRange,
    ) -> BackendResult<ObjectRangeData> {
        match self
            .client
            .get_object()
            .bucket(&self.bucket_name)
            .key(key)
            .range(range.to_header())
            .send()
            .await
        {
            Ok(output) => {
                let content_type = output.content_type().map(|s| s.to_string());
                let etag = output.e_tag().map(|s| s.to_string());
                let part_length = output.content_length().unwrap_or(0) as u64;

                // `Content-Range: bytes <start>-<end>/<total>`
                let (start, end, total) = output
                    .content_range()
                    .and_then(parse_content_range)
                    .ok_or_else(|| {
                        BackendError::Provider(format!(
                            "S3 returned no valid Content-Range for ranged read of '{}'",
                            key
                        ))
                    })?;

                if end - start + 1 != part_length {
                    return Err(BackendError::Provider(format!(
                        "S3 range length mismatch for '{}': {}-{} vs {} bytes",
                        key, start, end, part_length
                    )));
                }

                let metadata_map = output
                    .metadata()
                    .map(|m| m.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
                    .unwrap_or_default();

                let last_modified = output
                    .last_modified()
                    .and_then(|dt| DateTime::parse_from_rfc3339(&dt.to_string()).ok())
                    .map(|dt| dt.with_timezone(&Utc));

                debug!(
                    "Retrieved range {}-{} of S3 object: {} ({} bytes of {})",
                    start, end, key, part_length, total
                );

                let async_read = output.body.into_async_read();
                let stream: ByteStream = Box::pin(
                    ReaderStream::new(async_read)
                        .map(|result| result.map_err(std::io::Error::other)),
                );

                Ok(ObjectRangeData {
                    metadata: Self::s3_metadata_to_object_metadata(
                        key.to_string(),
                        total as i64,
                        last_modified,
                        etag,
                        content_type,
                        metadata_map,
                    ),
                    start,
                    end,
                    stream,
                })
            }
            Err(e) => {
                let error_msg = format!("{:?}", e);
                if error_msg.contains("NoSuchKey") || error_msg.contains("NotFound") {
                    Err(BackendError::NotFound(key.to_string()))
                } else if error_msg.contains("InvalidRange") {
                    let size = self.head_object(key).await?.size;
                    Err(BackendError::RangeNotSatisfiable { size })
                } else {
                    warn!("Failed to get object range from S3: {}: {:?}", key, e);
                    Err(s3_error(
                        format!("Failed to get object range '{}': {}", key, e),
                        &e,
                    ))
                }
            }
        }
    }

    async fn head_object(&self, key: &str) -> BackendResult<ObjectMetadata> {
        match self
            .client
            .head_object()
            .bucket(&self.bucket_name)
            .key(key)
            .send()
            .await
        {
            Ok(output) => {
                let size = output.content_length().unwrap_or(0);
                let content_type = output.content_type().map(|s| s.to_string());
                let etag = output.e_tag().map(|s| s.to_string());

                let metadata = output
                    .metadata()
                    .map(|m| m.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
                    .unwrap_or_default();

                let last_modified = output
                    .last_modified()
                    .and_then(|dt| DateTime::parse_from_rfc3339(&dt.to_string()).ok())
                    .map(|dt| dt.with_timezone(&Utc));

                Ok(Self::s3_metadata_to_object_metadata(
                    key.to_string(),
                    size,
                    last_modified,
                    etag,
                    content_type,
                    metadata,
                ))
            }
            Err(e) => {
                let error_msg = format!("{:?}", e);
                if error_msg.contains("NotFound") {
                    Err(BackendError::NotFound(key.to_string()))
                } else {
                    Err(s3_error(
                        format!("Failed to get metadata for '{}': {}", key, e),
                        &e,
                    ))
                }
            }
        }
    }

    async fn delete_object(&self, key: &str) -> BackendResult<()> {
        match self
            .client
            .delete_object()
            .bucket(&self.bucket_name)
            .key(key)
            .send()
            .await
        {
            Ok(_) => {
                debug!("Deleted object from S3: {}", key);
                Ok(())
            }
            Err(e) => {
                warn!("Failed to delete object from S3: {}: {:?}", key, e);
                Err(s3_error(
                    format!("Failed to delete object '{}': {}", key, e),
                    &e,
                ))
            }
        }
    }

    async fn delete_objects(&self, keys: &[String]) -> BackendResult<Vec<BackendResult<()>>> {
        use aws_sdk_s3::types::{Delete, ObjectIdentifier};

        let mut results: Vec<BackendResult<()>> = Vec::with_capacity(keys.len());

        for chunk in keys.chunks(1000) {
            let mut identifiers = Vec::with_capacity(chunk.len());
            for key in chunk {
                match ObjectIdentifier::builder().key(key).build() {
                    Ok(identifier) => identifiers.push(identifier),
                    Err(e) => {
                        return Err(BackendError::Provider(format!(
                            "Failed to build delete request for '{}': {}",
                            key, e
                        )))
                    }
                }
            }

            let delete = Delete::builder()
                .set_objects(Some(identifiers))
                .quiet(false)
                .build()
                .map_err(|e| {
                    BackendError::Provider(format!("Failed to build delete request: {}", e))
                })?;

            let output = self
                .client
                .delete_objects()
                .bucket(&self.bucket_name)
                .delete(delete)
                .send()
                .await
                .map_err(|e| {
                    warn!("Failed to batch delete objects from S3: {:?}", e);
                    s3_error(format!("Failed to delete objects: {}", e), &e)
                })?;

            let mut failures: HashMap<&str, String> = HashMap::new();
            for error in output.errors() {
                if let Some(key) = error.key() {
                    failures.insert(
                        key,
                        format!(
                            "{}: {}",
                            error.code().unwrap_or("Unknown"),
                            error.message().unwrap_or("delete failed")
                        ),
                    );
                }
            }

            for key in chunk {
                match failures.get(key.as_str()) {
                    Some(message) => results.push(Err(BackendError::Provider(format!(
                        "Failed to delete object '{}': {}",
                        key, message
                    )))),
                    None => results.push(Ok(())),
                }
            }
        }

        debug!("Batch deleted {} objects from S3", keys.len());
        Ok(results)
    }

    async fn copy_object(&self, source_key: &str, dest_key: &str) -> BackendResult<ObjectMetadata> {
        if self.head_object(source_key).await?.size > MAX_COPY_OBJECT_SIZE {
            return copy_through_stream(self, source_key, dest_key).await;
        }

        let copy_source = encode_copy_source(&format!("{}/{}", self.bucket_name, source_key));

        match self
            .client
            .copy_object()
            .bucket(&self.bucket_name)
            .copy_source(&copy_source)
            .key(dest_key)
            .send()
            .await
        {
            Ok(_) => {
                debug!("Copied S3 object {} to {}", source_key, dest_key);
                self.head_object(dest_key).await
            }
            Err(e) => {
                let error_msg = format!("{:?}", e);
                if error_msg.contains("NoSuchKey") || error_msg.contains("NotFound") {
                    Err(BackendError::NotFound(source_key.to_string()))
                } else {
                    Err(s3_error(
                        format!(
                            "Failed to copy object '{}' to '{}': {}",
                            source_key, dest_key, e
                        ),
                        &e,
                    ))
                }
            }
        }
    }

    async fn list_objects(
        &self,
        prefix: Option<&str>,
        max_keys: Option<usize>,
        continuation_token: Option<&str>,
    ) -> BackendResult<ObjectPage> {
        let mut request = self.client.list_objects_v2().bucket(&self.bucket_name);

        if let Some(p) = prefix {
            request = request.prefix(p);
        }

        if let Some(max) = max_keys {
            request = request.max_keys(max as i32);
        }

        if let Some(token) = continuation_token {
            request = request.continuation_token(token);
        }

        match request.send().await {
            Ok(output) => {
                let objects = output
                    .contents()
                    .iter()
                    .filter_map(|obj| {
                        let key = obj.key()?.to_string();
                        let size = obj.size().unwrap_or(0);
                        let etag = obj.e_tag().map(|s| s.to_string());

                        let last_modified = obj
                            .last_modified()
                            .and_then(|dt| DateTime::parse_from_rfc3339(&dt.to_string()).ok())
                            .map(|dt| dt.with_timezone(&Utc));

                        Some(Self::s3_metadata_to_object_metadata(
                            key,
                            size,
                            last_modified,
                            etag,
                            None,
                            HashMap::new(),
                        ))
                    })
                    .collect();

                debug!(
                    "Listed {} objects from S3 with prefix: {:?}",
                    output.key_count().unwrap_or(0),
                    prefix
                );

                let next_continuation_token = if output.is_truncated().unwrap_or(false) {
                    output.next_continuation_token().map(|t| t.to_string())
                } else {
                    None
                };

                Ok(ObjectPage {
                    objects,
                    next_continuation_token,
                })
            }
            Err(e) => {
                let error_msg = format!("{:?}", e);
                if error_msg.contains("NoSuchBucket") {
                    Err(BackendError::NotFound(format!(
                        "bucket:{}",
                        self.bucket_name
                    )))
                } else {
                    warn!("Failed to list objects from S3: {:?}", e);
                    Err(s3_error(format!("Failed to list objects: {}", e), &e))
                }
            }
        }
    }

    async fn get_public_url(
        &self,
        key: &str,
        expiration_secs: u64,
        purpose: PublicUrlPurpose,
    ) -> BackendResult<SignedUrl> {
        let presigning_config = PresigningConfig::expires_in(Duration::from_secs(expiration_secs))
            .map_err(|e| {
                BackendError::Provider(format!("Failed to create presigning config: {}", e))
            })?;

        let presigned_request = match purpose {
            PublicUrlPurpose::Retrieve => self
                .signing_client
                .get_object()
                .bucket(&self.bucket_name)
                .key(key)
                .presigned(presigning_config)
                .await
                .map_err(|e| {
                    warn!(
                        "Failed to generate presigned GET URL for S3 object: {}: {:?}",
                        key, e
                    );
                    BackendError::Provider(format!(
                        "Failed to generate presigned GET URL for '{}': {}",
                        key, e
                    ))
                })?,
            PublicUrlPurpose::Upload => self
                .signing_client
                .put_object()
                .bucket(&self.bucket_name)
                .key(key)
                .presigned(presigning_config)
                .await
                .map_err(|e| {
                    warn!(
                        "Failed to generate presigned PUT URL for S3 object: {}: {:?}",
                        key, e
                    );
                    BackendError::Provider(format!(
                        "Failed to generate presigned PUT URL for '{}': {}",
                        key, e
                    ))
                })?,
        };

        debug!(
            "Generated presigned {:?} URL for S3 object: {} (expires in {} seconds)",
            purpose, key, expiration_secs
        );

        let mut signed = SignedUrl::new(presigned_request.uri().to_string());
        for (name, value) in presigned_request.headers() {
            signed.headers.insert(name.to_string(), value.to_string());
        }

        Ok(signed)
    }

    fn backend_name(&self) -> &'static str {
        "s3"
    }

    async fn start_durable_multipart(&self, key: &str, opts: &PutOptions) -> BackendResult<String> {
        let mut create = self
            .client
            .create_multipart_upload()
            .bucket(&self.bucket_name)
            .key(key);

        if let Some(ct) = opts.content_type.as_ref() {
            create = create.content_type(ct);
        }
        for (k, v) in opts.metadata.iter() {
            create = create.metadata(k.clone(), v.clone());
        }

        let created = create.send().await.map_err(|e| {
            s3_error(format!("Failed to start upload of '{}': {}", key, e), &e)
        })?;

        created.upload_id().map(str::to_string).ok_or_else(|| {
            BackendError::Provider(format!("S3 returned no upload id for '{}'", key))
        })
    }

    async fn upload_durable_part(
        &self,
        key: &str,
        upload_id: &str,
        number: u32,
        data: Bytes,
    ) -> BackendResult<DurablePart> {
        validate_part_number(number)?;
        validate_part_size(data.len() as u64)?;
        validate_upload_id(upload_id)?;
        let size = data.len() as u64;

        let output = self
            .client
            .upload_part()
            .bucket(&self.bucket_name)
            .key(key)
            .upload_id(upload_id)
            .part_number(number as i32)
            .content_length(size as i64)
            .body(AwsByteStream::from(data))
            .send()
            .await
            .map_err(|e| {
                let message = format!("Failed to upload part {} of '{}': {}", number, key, e);
                if e.code() == Some("NoSuchUpload") {
                    BackendError::NotFound(message)
                } else {
                    s3_error(message, &e)
                }
            })?;

        let etag = output.e_tag().map(normalize_etag).ok_or_else(|| {
            BackendError::Provider(format!("S3 returned no etag for part {} of '{}'", number, key))
        })?;

        Ok(DurablePart { number, size, etag })
    }

    async fn complete_durable_multipart(
        &self,
        key: &str,
        upload_id: &str,
        parts: &[DurablePartRef],
    ) -> BackendResult<ObjectMetadata> {
        validate_part_list(parts)?;
        validate_upload_id(upload_id)?;

        let completed = CompletedMultipartUpload::builder()
            .set_parts(Some(
                parts
                    .iter()
                    .map(|part| {
                        CompletedPart::builder()
                            .e_tag(format!("\"{}\"", part.etag))
                            .part_number(part.number as i32)
                            .build()
                    })
                    .collect(),
            ))
            .build();

        self.client
            .complete_multipart_upload()
            .bucket(&self.bucket_name)
            .key(key)
            .upload_id(upload_id)
            .multipart_upload(completed)
            .send()
            .await
            .map_err(|e| match e.code() {
                Some("InvalidPart") | Some("InvalidPartOrder") | Some("EntityTooSmall") => {
                    BackendError::InvalidRequest(format!(
                        "Failed to complete upload of '{}': {}",
                        key,
                        DisplayErrorContext(&e)
                    ))
                }
                _ => complete_error(key, &e),
            })?;

        self.head_object(key).await
    }

    async fn abort_durable_multipart(&self, key: &str, upload_id: &str) -> BackendResult<()> {
        validate_upload_id(upload_id)?;

        match self
            .client
            .abort_multipart_upload()
            .bucket(&self.bucket_name)
            .key(key)
            .upload_id(upload_id)
            .send()
            .await
        {
            Ok(_) => Ok(()),
            Err(e) if e.code() == Some("NoSuchUpload") => Ok(()),
            Err(e) => Err(s3_error(
                format!("Failed to abort upload of '{}': {}", key, e),
                &e,
            )),
        }
    }

    async fn list_durable_multiparts(&self, prefix: &str) -> BackendResult<Vec<DurableUpload>> {
        let mut uploads = Vec::new();
        let mut key_marker: Option<String> = None;
        let mut upload_id_marker: Option<String> = None;

        loop {
            let output = self
                .client
                .list_multipart_uploads()
                .bucket(&self.bucket_name)
                .prefix(prefix)
                .set_key_marker(key_marker.clone())
                .set_upload_id_marker(upload_id_marker.clone())
                .send()
                .await
                .map_err(|e| s3_error(format!("Failed to list uploads: {}", e), &e))?;

            for upload in output.uploads() {
                let (Some(key), Some(upload_id)) = (upload.key(), upload.upload_id()) else {
                    continue;
                };
                uploads.push(DurableUpload {
                    key: key.to_string(),
                    upload_id: upload_id.to_string(),
                    initiated: upload.initiated().and_then(|time| {
                        DateTime::<Utc>::from_timestamp(time.secs(), time.subsec_nanos())
                    }),
                });
            }

            if output.is_truncated() != Some(true) {
                return Ok(uploads);
            }
            key_marker = output.next_key_marker().map(str::to_string);
            upload_id_marker = output.next_upload_id_marker().map(str::to_string);
            if key_marker.is_none() && upload_id_marker.is_none() {
                return Ok(uploads);
            }
        }
    }
}

/// S3 requires `x-amz-copy-source` to be URL-encoded, but the slashes separating
/// the bucket from the key have to stay literal.
fn encode_copy_source(source: &str) -> String {
    let mut encoded = String::with_capacity(source.len());

    for byte in source.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                encoded.push(byte as char)
            }
            _ => encoded.push_str(&format!("%{:02X}", byte)),
        }
    }

    encoded
}

fn parse_content_range(value: &str) -> Option<(u64, u64, u64)> {
    let rest = value.trim().strip_prefix("bytes ")?;
    let (range, total) = rest.split_once('/')?;
    let (start, end) = range.split_once('-')?;

    Some((start.parse().ok()?, end.parse().ok()?, total.parse().ok()?))
}

#[cfg(test)]
mod tests {
    use super::{complete_error, encode_copy_source, parse_content_range, s3_error};
    use crate::error::BackendError;
    use aws_sdk_s3::config::http::HttpResponse;
    use aws_sdk_s3::error::{ErrorMetadata, SdkError};
    use aws_sdk_s3::operation::complete_multipart_upload::CompleteMultipartUploadError;
    use aws_sdk_s3::primitives::SdkBody;

    fn service_error(
        status: u16,
        code: &str,
    ) -> SdkError<CompleteMultipartUploadError, HttpResponse> {
        SdkError::service_error(
            CompleteMultipartUploadError::generic(ErrorMetadata::builder().code(code).build()),
            HttpResponse::new(status.try_into().unwrap(), SdkBody::empty()),
        )
    }

    fn retryable(status: u16, code: &str) -> bool {
        s3_error(String::new(), &service_error(status, code)).is_retryable()
    }

    #[test]
    fn retries_only_transient_errors() {
        assert!(retryable(503, "SlowDown"));
        assert!(retryable(500, "InternalError"));
        assert!(retryable(400, "RequestTimeout"));
        assert!(retryable(429, "Throttling"));
        assert!(!retryable(403, "RequestTimeTooSkewed"));
        assert!(!retryable(403, "AccessDenied"));
        assert!(!retryable(400, "InvalidPart"));
    }

    #[test]
    fn reports_a_vanished_upload_as_not_found() {
        assert!(matches!(
            complete_error("k", &service_error(404, "NoSuchUpload")),
            BackendError::NotFound(_)
        ));
        assert!(matches!(
            complete_error("k", &service_error(400, "InvalidPart")),
            BackendError::Provider(_)
        ));
        assert!(complete_error("k", &service_error(503, "SlowDown")).is_retryable());
    }

    #[test]
    fn keeps_path_separators_literal() {
        assert_eq!(
            encode_copy_source("physical/bkt_1/skills/demo/SKILL.md"),
            "physical/bkt_1/skills/demo/SKILL.md"
        );
    }

    #[test]
    fn parses_content_range() {
        assert_eq!(
            parse_content_range("bytes 0-4095/12345"),
            Some((0, 4095, 12345))
        );
        assert_eq!(parse_content_range("bytes */12345"), None);
        assert_eq!(parse_content_range("items 0-1/2"), None);
    }

    #[test]
    fn encodes_characters_that_would_break_the_header() {
        assert_eq!(
            encode_copy_source("physical/bkt 1/a+b%c.txt"),
            "physical/bkt%201/a%2Bb%25c.txt"
        );
    }
}
