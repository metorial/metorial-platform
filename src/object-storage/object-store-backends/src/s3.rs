use async_trait::async_trait;
use aws_config::meta::region::RegionProviderChain;
use aws_config::BehaviorVersion;
use aws_sdk_s3::config::Region;
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::primitives::ByteStream as AwsByteStream;
use aws_sdk_s3::types::{CompletedMultipartUpload, CompletedPart};
use aws_sdk_s3::Client;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use std::collections::HashMap;
use std::time::Duration;
use tokio_util::io::ReaderStream;
use tracing::{debug, info, warn};

use crate::backend::{
    Backend, ByteRange, ByteStream, ObjectData, ObjectMetadata, ObjectPage, ObjectRangeData,
    PublicUrlPurpose,
};
use crate::error::{BackendError, BackendResult};
use crate::upload::{
    ChunkedUpload, MAX_MULTIPART_PARTS, MULTIPART_PART_SIZE, SINGLE_REQUEST_THRESHOLD,
};

pub struct S3Backend {
    client: Client,
    bucket_name: String,
}

impl S3Backend {
    pub async fn new(bucket_name: String) -> BackendResult<Self> {
        let config = aws_config::defaults(BehaviorVersion::latest()).load().await;
        let client = Client::new(&config);

        info!("Initialized S3 backend with bucket: {}", bucket_name);
        Ok(Self {
            client,
            bucket_name,
        })
    }

    pub async fn new_with_config(
        bucket_name: String,
        region: String,
        endpoint: Option<String>,
    ) -> BackendResult<Self> {
        let region_provider = RegionProviderChain::first_try(Region::new(region));

        let mut config_loader =
            aws_config::defaults(BehaviorVersion::latest()).region(region_provider);

        if let Some(endpoint_url) = endpoint {
            config_loader = config_loader.endpoint_url(&endpoint_url);
            info!(
                "Using custom S3 endpoint: {} for bucket: {}",
                endpoint_url, bucket_name
            );
        }

        let config = config_loader.load().await;
        let client = Client::new(&config);

        info!("Initialized S3 backend with bucket: {}", bucket_name);
        Ok(Self {
            client,
            bucket_name,
        })
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
            etag: etag.unwrap_or_else(|| {
                use sha2::{Digest, Sha256};
                let mut hasher = Sha256::new();
                hasher.update(key.as_bytes());
                hex::encode(hasher.finalize())
            }),
            last_modified: last_modified.unwrap_or_else(Utc::now),
            custom_metadata: metadata,
        }
    }

    async fn put_object_multipart(
        &self,
        key: &str,
        mut upload: ChunkedUpload,
        content_type: Option<String>,
        custom_metadata: HashMap<String, String>,
    ) -> BackendResult<ObjectMetadata> {
        let mut create = self
            .client
            .create_multipart_upload()
            .bucket(&self.bucket_name)
            .key(key);

        if let Some(ct) = content_type.as_ref() {
            create = create.content_type(ct);
        }

        for (k, v) in custom_metadata.iter() {
            create = create.metadata(k.clone(), v.clone());
        }

        let created = create.send().await.map_err(|e| {
            warn!("Failed to start multipart upload to S3: {}: {:?}", key, e);
            BackendError::Provider(format!("Failed to start upload of '{}': {}", key, e))
        })?;

        let upload_id = created.upload_id().ok_or_else(|| {
            BackendError::Provider(format!("S3 returned no upload id for '{}'", key))
        })?;

        let parts = match self.upload_parts(key, upload_id, &mut upload).await {
            Ok(parts) => parts,
            Err(e) => {
                self.abort_multipart_upload(key, upload_id).await;
                return Err(e);
            }
        };

        let completed = CompletedMultipartUpload::builder()
            .set_parts(Some(parts))
            .build();

        match self
            .client
            .complete_multipart_upload()
            .bucket(&self.bucket_name)
            .key(key)
            .upload_id(upload_id)
            .multipart_upload(completed)
            .send()
            .await
        {
            Ok(output) => {
                let size = upload.total_size();
                debug!("Uploaded object to S3 in parts: {} ({} bytes)", key, size);

                Ok(ObjectMetadata {
                    key: key.to_string(),
                    size,
                    content_type,
                    last_modified: Utc::now(),
                    etag: output
                        .e_tag()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| upload.etag()),
                    custom_metadata,
                })
            }
            Err(e) => {
                self.abort_multipart_upload(key, upload_id).await;
                warn!(
                    "Failed to complete multipart upload to S3: {}: {:?}",
                    key, e
                );
                Err(BackendError::Provider(format!(
                    "Failed to complete upload of '{}': {}",
                    key, e
                )))
            }
        }
    }

    async fn upload_parts(
        &self,
        key: &str,
        upload_id: &str,
        upload: &mut ChunkedUpload,
    ) -> BackendResult<Vec<CompletedPart>> {
        let mut parts: Vec<CompletedPart> = Vec::new();

        loop {
            let part = upload.next_part(MULTIPART_PART_SIZE).await?;
            if part.is_empty() {
                return Ok(parts);
            }

            if parts.len() >= MAX_MULTIPART_PARTS {
                return Err(BackendError::Provider(format!(
                    "Object '{}' is larger than the {} byte upload limit",
                    key,
                    MAX_MULTIPART_PARTS * MULTIPART_PART_SIZE
                )));
            }

            // Part numbers are 1-based and have to be contiguous.
            let part_number = parts.len() as i32 + 1;

            let output = self
                .client
                .upload_part()
                .bucket(&self.bucket_name)
                .key(key)
                .upload_id(upload_id)
                .part_number(part_number)
                .body(AwsByteStream::from(part))
                .send()
                .await
                .map_err(|e| {
                    warn!(
                        "Failed to upload part {} of {} to S3: {:?}",
                        part_number, key, e
                    );
                    BackendError::Provider(format!(
                        "Failed to upload part {} of '{}': {}",
                        part_number, key, e
                    ))
                })?;

            parts.push(
                CompletedPart::builder()
                    .set_e_tag(output.e_tag().map(|s| s.to_string()))
                    .part_number(part_number)
                    .build(),
            );
        }
    }

    async fn abort_multipart_upload(&self, key: &str, upload_id: &str) {
        if let Err(e) = self
            .client
            .abort_multipart_upload()
            .bucket(&self.bucket_name)
            .key(key)
            .upload_id(upload_id)
            .send()
            .await
        {
            warn!("Failed to abort multipart upload for {}: {:?}", key, e);
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
            Err(e) => {
                warn!("Failed to access S3 bucket {}: {:?}", self.bucket_name, e);
                Err(BackendError::Configuration(format!(
                    "Cannot access S3 bucket '{}': {}",
                    self.bucket_name, e
                )))
            }
        }
    }

    async fn put_object(
        &self,
        key: &str,
        stream: ByteStream,
        content_type: Option<String>,
        custom_metadata: HashMap<String, String>,
    ) -> BackendResult<ObjectMetadata> {
        let mut upload = ChunkedUpload::new(stream);

        if upload.fits_within(SINGLE_REQUEST_THRESHOLD).await? {
            let data = upload.take_buffered();
            let size = data.len() as u64;
            let etag = upload.etag();

            let mut request = self
                .client
                .put_object()
                .bucket(&self.bucket_name)
                .key(key)
                .body(AwsByteStream::from(data));

            if let Some(ct) = content_type.as_ref() {
                request = request.content_type(ct);
            }

            for (k, v) in custom_metadata.iter() {
                request = request.metadata(k.clone(), v.clone());
            }

            return match request.send().await {
                Ok(output) => {
                    debug!("Uploaded object to S3: {} ({} bytes)", key, size);
                    Ok(ObjectMetadata {
                        key: key.to_string(),
                        size,
                        content_type,
                        last_modified: Utc::now(),
                        etag: output.e_tag().map(|s| s.to_string()).unwrap_or(etag),
                        custom_metadata,
                    })
                }
                Err(e) => {
                    warn!("Failed to upload object to S3: {}: {:?}", key, e);
                    Err(BackendError::Provider(format!(
                        "Failed to upload object '{}': {}",
                        key, e
                    )))
                }
            };
        }

        self.put_object_multipart(key, upload, content_type, custom_metadata)
            .await
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
                    Err(BackendError::Provider(format!(
                        "Failed to get object '{}': {}",
                        key, e
                    )))
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
                    Err(BackendError::Provider(format!(
                        "Failed to get object range '{}': {}",
                        key, e
                    )))
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
                    Err(BackendError::Provider(format!(
                        "Failed to get metadata for '{}': {}",
                        key, e
                    )))
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
                Err(BackendError::Provider(format!(
                    "Failed to delete object '{}': {}",
                    key, e
                )))
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
                    BackendError::Provider(format!("Failed to delete objects: {}", e))
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
                    Err(BackendError::Provider(format!(
                        "Failed to copy object '{}' to '{}': {}",
                        source_key, dest_key, e
                    )))
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
                    Err(BackendError::Provider(format!(
                        "Failed to list objects: {}",
                        e
                    )))
                }
            }
        }
    }

    async fn get_public_url(
        &self,
        key: &str,
        expiration_secs: u64,
        purpose: PublicUrlPurpose,
    ) -> BackendResult<String> {
        let presigning_config = PresigningConfig::expires_in(Duration::from_secs(expiration_secs))
            .map_err(|e| {
                BackendError::Provider(format!("Failed to create presigning config: {}", e))
            })?;

        let presigned_request = match purpose {
            PublicUrlPurpose::Retrieve => self
                .client
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
                .client
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
        Ok(presigned_request.uri().to_string())
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
    use super::{encode_copy_source, parse_content_range};

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
