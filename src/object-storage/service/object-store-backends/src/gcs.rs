use async_trait::async_trait;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use google_cloud_storage::client::{Client, ClientConfig};
use google_cloud_storage::http::objects::delete::DeleteObjectRequest;
use google_cloud_storage::http::objects::download::Range;
use google_cloud_storage::http::objects::get::GetObjectRequest;
use google_cloud_storage::http::objects::list::ListObjectsRequest;
use google_cloud_storage::http::objects::upload::{Media, UploadObjectRequest, UploadType};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use tracing::{debug, info, warn};

use crate::backend::{Backend, ByteStream, ObjectData, ObjectMetadata, PublicUrlPurpose};
use crate::error::{BackendError, BackendResult};

pub struct GcsBackend {
    client: Client,
    bucket_name: String,
}

impl GcsBackend {
    pub async fn new(bucket_name: String) -> BackendResult<Self> {
        let config = ClientConfig::default().with_auth().await.map_err(|e| {
            BackendError::Configuration(format!("Failed to initialize GCS auth: {}", e))
        })?;

        let client = Client::new(config);

        info!("Initialized GCS backend with bucket: {}", bucket_name);
        Ok(Self {
            client,
            bucket_name,
        })
    }

    pub async fn new_with_credentials(
        bucket_name: String,
        credentials_path: String,
    ) -> BackendResult<Self> {
        unsafe { std::env::set_var("GOOGLE_APPLICATION_CREDENTIALS", &credentials_path) };

        let config = ClientConfig::default().with_auth().await.map_err(|e| {
            BackendError::Configuration(format!("Failed to initialize GCS with credentials: {}", e))
        })?;

        let client = Client::new(config);

        info!(
            "Initialized GCS backend with bucket: {} using credentials from: {}",
            bucket_name, credentials_path
        );
        Ok(Self {
            client,
            bucket_name,
        })
    }

    fn calculate_etag(data: &[u8]) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(data);
        hex::encode(hasher.finalize())
    }

    fn gcs_metadata_to_object_metadata(
        name: String,
        size: i64,
        updated: Option<time::OffsetDateTime>,
        md5_hash: Option<String>,
        content_type: Option<String>,
        metadata: HashMap<String, String>,
    ) -> ObjectMetadata {
        let last_modified_utc = updated
            .and_then(|dt| DateTime::from_timestamp(dt.unix_timestamp(), dt.nanosecond()))
            .unwrap_or_else(Utc::now);

        ObjectMetadata {
            key: name.clone(),
            size: size as u64,
            content_type,
            last_modified: last_modified_utc,
            etag: md5_hash.unwrap_or_else(|| {
                use sha2::{Digest, Sha256};
                let mut hasher = Sha256::new();
                hasher.update(name.as_bytes());
                hex::encode(hasher.finalize())
            }),
            custom_metadata: metadata,
        }
    }
}

#[async_trait]
impl Backend for GcsBackend {
    async fn init(&self) -> BackendResult<()> {
        match self
            .client
            .list_objects(&ListObjectsRequest {
                bucket: self.bucket_name.clone(),
                max_results: Some(1),
                ..Default::default()
            })
            .await
        {
            Ok(_) => {
                info!("GCS bucket {} is accessible", self.bucket_name);
                Ok(())
            }
            Err(e) => {
                warn!("Failed to access GCS bucket {}: {:?}", self.bucket_name, e);
                Err(BackendError::Configuration(format!(
                    "Cannot access GCS bucket '{}': {}",
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
        let key_owned = key.to_string();

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

        let upload_type = UploadType::Simple(Media::new(key_owned.clone()));
        let request = UploadObjectRequest {
            bucket: self.bucket_name.clone(),
            ..Default::default()
        };

        match self
            .client
            .upload_object(&request, data, &upload_type)
            .await
        {
            Ok(object) => {
                debug!("Uploaded object to GCS: {} ({} bytes)", key, size);
                Ok(Self::gcs_metadata_to_object_metadata(
                    object.name,
                    object.size,
                    object.updated,
                    object.md5_hash,
                    content_type,
                    custom_metadata,
                ))
            }
            Err(e) => {
                warn!("Failed to upload object to GCS: {}: {:?}", key, e);
                Err(BackendError::Provider(format!(
                    "Failed to upload object '{}': {}",
                    key, e
                )))
            }
        }
    }

    async fn get_object(&self, key: &str) -> BackendResult<ObjectData> {
        let request = GetObjectRequest {
            bucket: self.bucket_name.clone(),
            object: key.to_string(),
            ..Default::default()
        };

        match self
            .client
            .download_object(&request, &Range::default())
            .await
        {
            Ok(data) => {
                let size = data.len();
                debug!("Retrieved object from GCS: {} ({} bytes)", key, size);

                // Get metadata
                let metadata = match self.head_object(key).await {
                    Ok(meta) => meta,
                    Err(_) => ObjectMetadata {
                        key: key.to_string(),
                        size: size as u64,
                        content_type: None,
                        last_modified: Utc::now(),
                        etag: Self::calculate_etag(&data),
                        custom_metadata: HashMap::new(),
                    },
                };

                // Convert data to stream
                let stream: ByteStream =
                    Box::pin(futures::stream::once(async move { Ok(Bytes::from(data)) }));

                Ok(ObjectData { metadata, stream })
            }
            Err(e) => {
                let error_msg = format!("{:?}", e);
                if error_msg.contains("404") || error_msg.contains("NotFound") {
                    Err(BackendError::NotFound(key.to_string()))
                } else {
                    warn!("Failed to get object from GCS: {}: {:?}", key, e);
                    Err(BackendError::Provider(format!(
                        "Failed to get object '{}': {}",
                        key, e
                    )))
                }
            }
        }
    }

    async fn head_object(&self, key: &str) -> BackendResult<ObjectMetadata> {
        let request = GetObjectRequest {
            bucket: self.bucket_name.clone(),
            object: key.to_string(),
            ..Default::default()
        };

        match self.client.get_object(&request).await {
            Ok(object) => Ok(Self::gcs_metadata_to_object_metadata(
                object.name,
                object.size,
                object.updated,
                object.md5_hash,
                object.content_type,
                object.metadata.unwrap_or_default(),
            )),
            Err(e) => {
                let error_msg = format!("{:?}", e);
                if error_msg.contains("404") || error_msg.contains("NotFound") {
                    Err(BackendError::NotFound(key.to_string()))
                } else {
                    warn!("Failed to get metadata from GCS: {}: {:?}", key, e);
                    Err(BackendError::Provider(format!(
                        "Failed to get metadata for '{}': {}",
                        key, e
                    )))
                }
            }
        }
    }

    async fn delete_object(&self, key: &str) -> BackendResult<()> {
        let request = DeleteObjectRequest {
            bucket: self.bucket_name.clone(),
            object: key.to_string(),
            ..Default::default()
        };

        match self.client.delete_object(&request).await {
            Ok(_) => {
                debug!("Deleted object from GCS: {}", key);
                Ok(())
            }
            Err(e) => {
                warn!("Failed to delete object from GCS: {}: {:?}", key, e);
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
        let mut request = ListObjectsRequest {
            bucket: self.bucket_name.clone(),
            ..Default::default()
        };

        if let Some(p) = prefix {
            request.prefix = Some(p.to_string());
        }

        if let Some(max) = max_keys {
            request.max_results = Some(max as i32);
        }

        match self.client.list_objects(&request).await {
            Ok(response) => {
                let objects: Vec<ObjectMetadata> = response
                    .items
                    .unwrap_or_default()
                    .into_iter()
                    .map(|obj| {
                        Self::gcs_metadata_to_object_metadata(
                            obj.name,
                            obj.size,
                            obj.updated,
                            obj.md5_hash,
                            obj.content_type,
                            obj.metadata.unwrap_or_default(),
                        )
                    })
                    .collect();

                debug!(
                    "Listed {} objects from GCS with prefix: {:?}",
                    objects.len(),
                    prefix
                );

                Ok(objects)
            }
            Err(e) => {
                let error_msg = format!("{:?}", e);
                if error_msg.contains("404") {
                    Err(BackendError::NotFound(format!(
                        "bucket:{}",
                        self.bucket_name
                    )))
                } else {
                    warn!("Failed to list objects from GCS: {:?}", e);
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
        let expiration = std::time::Duration::from_secs(expiration_secs);

        use google_cloud_storage::sign::{SignedURLMethod, SignedURLOptions};

        let method = match purpose {
            PublicUrlPurpose::Retrieve => SignedURLMethod::GET,
            PublicUrlPurpose::Upload => SignedURLMethod::PUT,
        };

        let url_options = SignedURLOptions {
            method,
            expires: expiration,
            ..Default::default()
        };

        let url_for = self
            .client
            .signed_url(
                &self.bucket_name,
                key,
                None, // headers
                None, // sign_by
                url_options,
            )
            .await
            .map_err(|e| {
                warn!(
                    "Failed to generate signed {:?} URL for GCS object: {}: {:?}",
                    purpose, key, e
                );
                BackendError::Provider(format!(
                    "Failed to generate signed {:?} URL for '{}': {}",
                    purpose, key, e
                ))
            })?;

        debug!(
            "Generated signed {:?} URL for GCS object: {} (expires in {} seconds)",
            purpose, key, expiration_secs
        );
        Ok(url_for)
    }
}
