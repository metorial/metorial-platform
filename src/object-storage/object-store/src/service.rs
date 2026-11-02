use bytes::Bytes;
use object_store_backends::error::BackendError;
use object_store_backends::{
    Backend, ByteRange, ByteStream, ObjectData, ObjectMetadata, ObjectPage, ObjectRangeData,
    PublicUrlPurpose,
};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info};

use crate::error::{ServiceError, ServiceResult};
use crate::metadata::{Bucket, MetadataStore};

#[derive(Debug, Clone)]
pub struct DeleteObjectResult {
    pub key: String,
    pub deleted: bool,
    pub error: Option<String>,
}

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

        if !self.is_bucket_empty(name).await? {
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

    pub async fn get_object_range(
        &self,
        bucket: &str,
        key: &str,
        range: ByteRange,
    ) -> ServiceResult<ObjectRangeData> {
        self.metadata.get_bucket(bucket).await?;

        validate_object_key(key)?;

        let full_key = format!("{}/{}", bucket, key);

        let part = self.backend.get_object_range(&full_key, range).await?;

        debug!("Got object range: {}/{} {:?}", bucket, key, range);
        Ok(part)
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

    async fn is_bucket_empty(&self, bucket: &str) -> ServiceResult<bool> {
        let mut token: Option<String> = None;

        loop {
            let page = self
                .list_objects(bucket, None, Some(16), token.as_deref())
                .await?;

            if !page.objects.is_empty() {
                return Ok(false);
            }

            match page.next_continuation_token {
                Some(next) => token = Some(next),
                None => return Ok(true),
            }
        }
    }

    pub async fn list_objects(
        &self,
        bucket: &str,
        prefix: Option<&str>,
        max_keys: Option<usize>,
        continuation_token: Option<&str>,
    ) -> ServiceResult<ObjectPage> {
        self.metadata.get_bucket(bucket).await?;

        let full_prefix = bucket_scoped_prefix(bucket, prefix);

        let page = self
            .backend
            .list_objects(Some(&full_prefix), max_keys, continuation_token)
            .await?;

        let bucket_prefix = format!("{}/", bucket);
        let objects: Vec<ObjectMetadata> = page
            .objects
            .into_iter()
            .filter(|obj| !obj.key.ends_with("/.bucket"))
            .map(|mut obj| {
                if let Some(stripped) = obj.key.strip_prefix(&bucket_prefix) {
                    obj.key = stripped.to_string();
                }
                obj
            })
            .collect();

        debug!("Listed {} objects in bucket: {}", objects.len(), bucket);
        Ok(ObjectPage {
            objects,
            next_continuation_token: page.next_continuation_token,
        })
    }

    pub async fn delete_objects(
        &self,
        bucket: &str,
        keys: &[String],
    ) -> ServiceResult<Vec<DeleteObjectResult>> {
        self.metadata.get_bucket(bucket).await?;

        let mut validation_errors: HashMap<usize, String> = HashMap::new();
        let mut full_keys: Vec<String> = Vec::new();
        let mut full_key_indices: Vec<usize> = Vec::new();

        for (index, key) in keys.iter().enumerate() {
            match validate_deletable_object_key(key) {
                Ok(()) => {
                    full_keys.push(format!("{}/{}", bucket, key));
                    full_key_indices.push(index);
                }
                Err(e) => {
                    validation_errors.insert(index, e.to_string());
                }
            }
        }

        let mut backend_results = if full_keys.is_empty() {
            Vec::new()
        } else {
            self.backend.delete_objects(&full_keys).await?
        };

        let mut by_index: HashMap<usize, Option<String>> = HashMap::new();
        for (position, result) in backend_results.drain(..).enumerate() {
            let index = full_key_indices[position];
            let error = match result {
                Ok(()) | Err(BackendError::NotFound(_)) => None,
                Err(e) => Some(e.to_string()),
            };
            by_index.insert(index, error);
        }

        let results = keys
            .iter()
            .enumerate()
            .map(|(index, key)| match validation_errors.remove(&index) {
                Some(error) => DeleteObjectResult {
                    key: key.clone(),
                    deleted: false,
                    error: Some(error),
                },
                None => match by_index.remove(&index).flatten() {
                    Some(error) => DeleteObjectResult {
                        key: key.clone(),
                        deleted: false,
                        error: Some(error),
                    },
                    None => DeleteObjectResult {
                        key: key.clone(),
                        deleted: true,
                        error: None,
                    },
                },
            })
            .collect::<Vec<_>>();

        info!(
            "Deleted {}/{} objects in bucket: {}",
            results.iter().filter(|r| r.deleted).count(),
            results.len(),
            bucket
        );

        Ok(results)
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

    pub async fn copy_object(
        &self,
        source_bucket: &str,
        source_key: &str,
        dest_bucket: &str,
        dest_key: &str,
    ) -> ServiceResult<ObjectMetadata> {
        self.metadata.get_bucket(source_bucket).await?;
        self.metadata.get_bucket(dest_bucket).await?;

        validate_object_key(source_key)?;
        // Writing over a bucket marker would strand the destination bucket.
        validate_deletable_object_key(dest_key)?;

        let full_source_key = format!("{}/{}", source_bucket, source_key);
        let full_dest_key = format!("{}/{}", dest_bucket, dest_key);

        let mut obj_metadata = self
            .backend
            .copy_object(&full_source_key, &full_dest_key)
            .await?;

        obj_metadata.key = dest_key.to_string();

        debug!(
            "Copied object: {}/{} -> {}/{}",
            source_bucket, source_key, dest_bucket, dest_key
        );
        Ok(obj_metadata)
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

fn bucket_scoped_prefix(bucket: &str, prefix: Option<&str>) -> String {
    match prefix.map(|p| p.trim_start_matches('/')) {
        Some(p) if !p.is_empty() => format!("{}/{}", bucket, p),
        _ => format!("{}/", bucket),
    }
}

fn validate_deletable_object_key(key: &str) -> ServiceResult<()> {
    validate_object_key(key)?;

    if key == ".bucket" || key.ends_with("/.bucket") {
        return Err(ServiceError::InvalidObjectKey(
            ".bucket is a reserved name".to_string(),
        ));
    }

    Ok(())
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
