use bytes::Bytes;
use object_store_backends::{Backend, ByteStream, ObjectData, ObjectMetadata, PublicUrlPurpose};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info};

use crate::error::{ServiceError, ServiceResult};
use crate::metadata::{Bucket, MetadataStore};

pub struct ObjectStoreService {
    backend: Arc<dyn Backend>,
    metadata: Arc<MetadataStore>,
}

impl ObjectStoreService {
    pub fn new(backend: Arc<dyn Backend>, metadata: Arc<MetadataStore>) -> Self {
        Self { backend, metadata }
    }

    pub async fn init(&self) -> ServiceResult<()> {
        self.backend.init().await?;
        info!("Object store service initialized");
        Ok(())
    }

    pub async fn create_bucket(&self, name: &str) -> ServiceResult<Bucket> {
        let bucket = self.metadata.create_bucket(name).await?;

        let bucket_marker = format!("{}/.bucket", name);

        // Create empty stream for bucket marker
        let stream: ByteStream = Box::pin(futures::stream::once(async { Ok(Bytes::new()) }));

        self.backend
            .put_object(&bucket_marker, stream, None, HashMap::new())
            .await?;

        info!("Created bucket: {}", name);
        Ok(bucket)
    }

    pub async fn upsert_bucket(&self, name: &str) -> ServiceResult<Bucket> {
        // Try to get existing bucket first
        if let Ok(bucket) = self.metadata.get_bucket(name).await {
            debug!("Bucket {} already exists, returning existing", name);
            return Ok(bucket);
        }

        // Bucket doesn't exist, create it
        self.create_bucket(name).await
    }

    pub async fn list_buckets(&self) -> ServiceResult<Vec<Bucket>> {
        self.metadata.list_buckets().await
    }

    pub async fn get_bucket_by_id(&self, id: &str) -> ServiceResult<Bucket> {
        self.metadata.get_bucket_by_id(id).await
    }

    pub async fn delete_bucket(&self, name: &str) -> ServiceResult<()> {
        self.metadata.get_bucket(name).await?;

        // List all objects in the bucket to see if it's empty
        let objects = self.list_objects(name, None, None).await?;
        if !objects.is_empty() {
            return Err(ServiceError::Internal(format!(
                "Bucket {} is not empty",
                name
            )));
        }

        // Delete the bucket marker
        let bucket_marker = format!("{}/.bucket", name);
        let _ = self.backend.delete_object(&bucket_marker).await;

        // Delete from metadata
        self.metadata.delete_bucket(name).await?;

        info!("Deleted bucket: {}", name);
        Ok(())
    }

    pub async fn put_object(
        &self,
        bucket: &str,
        key: &str,
        stream: ByteStream,
        content_type: Option<String>,
        metadata: HashMap<String, String>,
    ) -> ServiceResult<ObjectMetadata> {
        self.metadata.get_bucket(bucket).await?;

        validate_object_key(key)?;

        let full_key = format!("{}/{}", bucket, key);

        let obj_metadata = self
            .backend
            .put_object(&full_key, stream, content_type, metadata)
            .await?;

        debug!("Put object: {}/{}", bucket, key);
        Ok(obj_metadata)
    }

    pub async fn get_object(&self, bucket: &str, key: &str) -> ServiceResult<ObjectData> {
        self.metadata.get_bucket(bucket).await?;

        validate_object_key(key)?;

        let full_key = format!("{}/{}", bucket, key);

        let obj_data = self.backend.get_object(&full_key).await?;

        debug!("Got object: {}/{}", bucket, key);
        Ok(obj_data)
    }

    pub async fn head_object(&self, bucket: &str, key: &str) -> ServiceResult<ObjectMetadata> {
        self.metadata.get_bucket(bucket).await?;

        validate_object_key(key)?;

        let full_key = format!("{}/{}", bucket, key);

        let metadata = self.backend.head_object(&full_key).await?;

        debug!("Got object metadata: {}/{}", bucket, key);
        Ok(metadata)
    }

    pub async fn delete_object(&self, bucket: &str, key: &str) -> ServiceResult<()> {
        self.metadata.get_bucket(bucket).await?;

        validate_object_key(key)?;

        let full_key = format!("{}/{}", bucket, key);

        self.backend.delete_object(&full_key).await?;

        info!("Deleted object: {}/{}", bucket, key);
        Ok(())
    }

    pub async fn list_objects(
        &self,
        bucket: &str,
        prefix: Option<&str>,
        max_keys: Option<usize>,
    ) -> ServiceResult<Vec<ObjectMetadata>> {
        self.metadata.get_bucket(bucket).await?;

        let full_prefix = if let Some(p) = prefix {
            format!("{}/{}", bucket, p)
        } else {
            format!("{}/", bucket)
        };

        let objects = self
            .backend
            .list_objects(Some(&full_prefix), max_keys)
            .await?;

        let bucket_prefix = format!("{}/", bucket);
        let filtered: Vec<ObjectMetadata> = objects
            .into_iter()
            .filter(|obj| !obj.key.ends_with("/.bucket"))
            .map(|mut obj| {
                if let Some(stripped) = obj.key.strip_prefix(&bucket_prefix) {
                    obj.key = stripped.to_string();
                }
                obj
            })
            .collect();

        debug!("Listed {} objects in bucket: {}", filtered.len(), bucket);
        Ok(filtered)
    }

    pub async fn object_exists(&self, bucket: &str, key: &str) -> ServiceResult<bool> {
        self.metadata.get_bucket(bucket).await?;

        validate_object_key(key)?;

        let full_key = format!("{}/{}", bucket, key);

        let exists = self.backend.object_exists(&full_key).await?;

        Ok(exists)
    }

    pub fn metadata(&self) -> Arc<MetadataStore> {
        self.metadata.clone()
    }

    pub async fn get_public_url(
        &self,
        bucket: &str,
        key: &str,
        expiration_secs: u64,
        purpose: PublicUrlPurpose,
    ) -> ServiceResult<String> {
        self.metadata.get_bucket(bucket).await?;

        validate_object_key(key)?;

        let full_key = format!("{}/{}", bucket, key);

        let url = self
            .backend
            .get_public_url(&full_key, expiration_secs, purpose)
            .await?;

        Ok(url)
    }
}

fn validate_object_key(key: &str) -> ServiceResult<()> {
    if key.is_empty() {
        return Err(ServiceError::InvalidObjectKey(
            "Key cannot be empty".to_string(),
        ));
    }

    if key.contains("..") || key.starts_with('/') {
        return Err(ServiceError::InvalidObjectKey(format!(
            "Invalid key: {}",
            key
        )));
    }

    if key == ".bucket" {
        return Err(ServiceError::InvalidObjectKey(
            ".bucket is a reserved name".to_string(),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_object_key() {
        assert!(validate_object_key("valid/key.txt").is_ok());
        assert!(validate_object_key("another-valid-key").is_ok());
        assert!(validate_object_key("").is_err());
        assert!(validate_object_key("../etc/passwd").is_err());
        assert!(validate_object_key("/etc/passwd").is_err());
        assert!(validate_object_key(".bucket").is_err());
    }
}
