use async_trait::async_trait;
use aws_config::meta::region::RegionProviderChain;
use aws_config::BehaviorVersion;
use aws_sdk_s3::config::Region;
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::primitives::ByteStream as AwsByteStream;
use aws_sdk_s3::Client;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use std::collections::HashMap;
use std::time::Duration;
use tokio_util::io::ReaderStream;
use tracing::{debug, info, warn};

use crate::backend::{Backend, ByteStream, ObjectData, ObjectMetadata, PublicUrlPurpose};
use crate::error::{BackendError, BackendResult};

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
        mut stream: ByteStream,
        content_type: Option<String>,
        custom_metadata: HashMap<String, String>,
    ) -> BackendResult<ObjectMetadata> {
        use sha2::{Digest, Sha256};

        // Collect stream into bytes while computing hash
        let mut hasher = Sha256::new();
        let mut data = Vec::new();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result
                .map_err(|e| BackendError::Provider(format!("Failed to read stream: {}", e)))?;

            hasher.update(&chunk);
            data.extend_from_slice(&chunk);
        }

        let size = data.len();
        let etag = hex::encode(hasher.finalize());

        // Convert to AWS ByteStream
        let body = AwsByteStream::from(data);

        let mut request = self
            .client
            .put_object()
            .bucket(&self.bucket_name)
            .key(key)
            .body(body);

        if let Some(ct) = content_type.as_ref() {
            request = request.content_type(ct);
        }

        for (k, v) in custom_metadata.iter() {
            request = request.metadata(k.clone(), v.clone());
        }

        match request.send().await {
            Ok(output) => {
                debug!("Uploaded object to S3: {} ({} bytes)", key, size);
                Ok(ObjectMetadata {
                    key: key.to_string(),
                    size: size as u64,
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

                // Convert AWS ByteStream to our ByteStream via AsyncRead
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

    async fn list_objects(
        &self,
        prefix: Option<&str>,
        max_keys: Option<usize>,
    ) -> BackendResult<Vec<ObjectMetadata>> {
        let mut request = self.client.list_objects_v2().bucket(&self.bucket_name);

        if let Some(p) = prefix {
            request = request.prefix(p);
        }

        if let Some(max) = max_keys {
            request = request.max_keys(max as i32);
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

                Ok(objects)
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
