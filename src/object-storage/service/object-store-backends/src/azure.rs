use async_trait::async_trait;
use azure_core::auth::Secret;
use azure_storage::prelude::*;
use azure_storage_blobs::prelude::*;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use tracing::{debug, info, warn};

use crate::backend::{Backend, ByteStream, ObjectData, ObjectMetadata, PublicUrlPurpose};
use crate::error::{BackendError, BackendResult};

pub struct AzureBackend {
    client: ContainerClient,
    container_name: String,
    account: String,
    #[allow(dead_code)]
    access_key: String,
}

impl AzureBackend {
    pub fn new(account: String, access_key: String, container_name: String) -> BackendResult<Self> {
        let storage_credentials =
            StorageCredentials::access_key(account.clone(), Secret::new(access_key.clone()));

        let client = ClientBuilder::new(account.clone(), storage_credentials)
            .container_client(&container_name);

        info!(
            "Initialized Azure Blob Storage backend with container: {}",
            container_name
        );

        Ok(Self {
            client,
            container_name,
            account,
            access_key,
        })
    }

    pub fn new_from_connection_string(
        connection_string: String,
        container_name: String,
    ) -> BackendResult<Self> {
        let mut account_name = String::new();
        let mut access_key = String::new();

        for part in connection_string.split(';') {
            if let Some(value) = part.strip_prefix("AccountName=") {
                account_name = value.to_string();
            } else if let Some(value) = part.strip_prefix("AccountKey=") {
                access_key = value.to_string();
            }
        }

        if account_name.is_empty() || access_key.is_empty() {
            return Err(BackendError::Configuration(
                "AccountName or AccountKey not found in connection string".to_string(),
            ));
        }

        let storage_credentials =
            StorageCredentials::access_key(account_name.clone(), Secret::new(access_key.clone()));

        let client = ClientBuilder::new(account_name.clone(), storage_credentials)
            .container_client(&container_name);

        info!(
            "Initialized Azure Blob Storage backend with container: {} from connection string",
            container_name
        );

        Ok(Self {
            client,
            container_name,
            account: account_name,
            access_key,
        })
    }

    fn calculate_etag(data: &[u8]) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(data);
        hex::encode(hasher.finalize())
    }

    fn azure_metadata_to_object_metadata(
        name: String,
        size: u64,
        last_modified: time::OffsetDateTime,
        etag: Option<String>,
        content_type: Option<String>,
        metadata: HashMap<String, String>,
    ) -> ObjectMetadata {
        let last_modified_utc =
            DateTime::from_timestamp(last_modified.unix_timestamp(), last_modified.nanosecond())
                .unwrap_or_else(Utc::now);

        ObjectMetadata {
            key: name.clone(),
            size,
            content_type,
            last_modified: last_modified_utc,
            etag: etag.unwrap_or_else(|| {
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
impl Backend for AzureBackend {
    async fn init(&self) -> BackendResult<()> {
        match self.client.get_properties().await {
            Ok(_) => {
                info!("Azure container {} is accessible", self.container_name);
                Ok(())
            }
            Err(e) => {
                warn!(
                    "Failed to access Azure container {}: {:?}",
                    self.container_name, e
                );
                Err(BackendError::Configuration(format!(
                    "Cannot access Azure container '{}': {}",
                    self.container_name, e
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
        let blob_client = self.client.blob_client(key);

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

        let mut request = blob_client.put_block_blob(data);

        if let Some(ct) = content_type.as_ref() {
            request = request.content_type(ct.clone());
        }

        let mut metadata_obj = azure_core::request_options::Metadata::new();
        for (k, v) in custom_metadata.iter() {
            metadata_obj.insert(k.clone(), v.clone());
        }
        request = request.metadata(metadata_obj);

        match request.await {
            Ok(_) => {
                debug!("Uploaded blob to Azure: {} ({} bytes)", key, size);
                Ok(ObjectMetadata {
                    key: key.to_string(),
                    size: size as u64,
                    content_type,
                    last_modified: Utc::now(),
                    etag,
                    custom_metadata,
                })
            }
            Err(e) => {
                warn!("Failed to upload blob to Azure: {}: {:?}", key, e);
                Err(BackendError::Provider(format!(
                    "Failed to upload blob '{}': {}",
                    key, e
                )))
            }
        }
    }

    async fn get_object(&self, key: &str) -> BackendResult<ObjectData> {
        let blob_client = self.client.blob_client(key);

        match blob_client.get_content().await {
            Ok(data) => {
                let size = data.len();
                debug!("Retrieved blob from Azure: {} ({} bytes)", key, size);

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
                if error_msg.contains("404")
                    || error_msg.contains("NotFound")
                    || error_msg.contains("BlobNotFound")
                {
                    Err(BackendError::NotFound(key.to_string()))
                } else {
                    warn!("Failed to get blob from Azure: {}: {:?}", key, e);
                    Err(BackendError::Provider(format!(
                        "Failed to get blob '{}': {}",
                        key, e
                    )))
                }
            }
        }
    }

    async fn head_object(&self, key: &str) -> BackendResult<ObjectMetadata> {
        let blob_client = self.client.blob_client(key);

        match blob_client.get_properties().await {
            Ok(properties) => {
                let metadata_map: HashMap<String, String> =
                    properties.blob.metadata.clone().unwrap_or_default();

                let etag_str = format!("{:?}", properties.blob.properties.etag);

                Ok(Self::azure_metadata_to_object_metadata(
                    key.to_string(),
                    properties.blob.properties.content_length,
                    properties.blob.properties.last_modified,
                    Some(etag_str),
                    Some(properties.blob.properties.content_type),
                    metadata_map,
                ))
            }
            Err(e) => {
                let error_msg = format!("{:?}", e);
                if error_msg.contains("404")
                    || error_msg.contains("NotFound")
                    || error_msg.contains("BlobNotFound")
                {
                    Err(BackendError::NotFound(key.to_string()))
                } else {
                    warn!("Failed to get blob properties from Azure: {}: {:?}", key, e);
                    Err(BackendError::Provider(format!(
                        "Failed to get metadata for '{}': {}",
                        key, e
                    )))
                }
            }
        }
    }

    async fn delete_object(&self, key: &str) -> BackendResult<()> {
        let blob_client = self.client.blob_client(key);

        match blob_client.delete().await {
            Ok(_) => {
                debug!("Deleted blob from Azure: {}", key);
                Ok(())
            }
            Err(e) => {
                warn!("Failed to delete blob from Azure: {}: {:?}", key, e);
                Err(BackendError::Provider(format!(
                    "Failed to delete blob '{}': {}",
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
        let mut request = self.client.list_blobs();

        if let Some(p) = prefix {
            request = request.prefix(p.to_string());
        }

        if let Some(max) = max_keys {
            if let Some(max_nz) = std::num::NonZeroU32::new(max as u32) {
                request = request.max_results(max_nz);
            }
        }

        match request.into_stream().next().await {
            Some(Ok(response)) => {
                let objects: Vec<ObjectMetadata> = response
                    .blobs
                    .items
                    .into_iter()
                    .filter_map(|item| {
                        use azure_storage_blobs::container::operations::BlobItem;
                        if let BlobItem::Blob(blob) = item {
                            let metadata_map: HashMap<String, String> =
                                blob.metadata.clone().unwrap_or_default();

                            let etag_str = format!("{:?}", blob.properties.etag);

                            Some(Self::azure_metadata_to_object_metadata(
                                blob.name,
                                blob.properties.content_length,
                                blob.properties.last_modified,
                                Some(etag_str),
                                Some(blob.properties.content_type),
                                metadata_map,
                            ))
                        } else {
                            None
                        }
                    })
                    .collect();

                debug!(
                    "Listed {} blobs from Azure with prefix: {:?}",
                    objects.len(),
                    prefix
                );

                Ok(objects)
            }
            Some(Err(e)) => {
                let error_msg = format!("{:?}", e);
                if error_msg.contains("404") || error_msg.contains("ContainerNotFound") {
                    Err(BackendError::NotFound(format!(
                        "container:{}",
                        self.container_name
                    )))
                } else {
                    warn!("Failed to list blobs from Azure: {:?}", e);
                    Err(BackendError::Provider(format!(
                        "Failed to list blobs: {}",
                        e
                    )))
                }
            }
            None => Ok(Vec::new()),
        }
    }

    async fn get_public_url(
        &self,
        key: &str,
        expiration_secs: u64,
        purpose: PublicUrlPurpose,
    ) -> BackendResult<String> {
        use azure_storage::shared_access_signature::service_sas::BlobSasPermissions;
        use time::{Duration, OffsetDateTime};

        let expiry = OffsetDateTime::now_utc() + Duration::seconds(expiration_secs as i64);

        let permissions = match purpose {
            PublicUrlPurpose::Retrieve => BlobSasPermissions {
                read: true,
                ..Default::default()
            },
            PublicUrlPurpose::Upload => BlobSasPermissions {
                write: true,
                create: true,
                ..Default::default()
            },
        };

        let sas = self
            .client
            .shared_access_signature(permissions, expiry)
            .await
            .map_err(|e| BackendError::Provider(format!("Failed to generate SAS token: {}", e)))?;

        let token = sas
            .token()
            .map_err(|e| BackendError::Provider(format!("Failed to extract SAS token: {}", e)))?;

        let url = format!(
            "https://{}.blob.core.windows.net/{}/{}?{}",
            self.account, self.container_name, key, token
        );

        debug!(
            "Generated SAS {:?} URL for Azure blob: {} (expires in {} seconds)",
            purpose, key, expiration_secs
        );

        Ok(url)
    }
}
