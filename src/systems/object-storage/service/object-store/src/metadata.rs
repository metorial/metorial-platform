use bytes::Bytes;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use object_store_backends::{Backend, BackendError};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::error::{ServiceError, ServiceResult};

const BUCKETS_PREFIX: &str = ".metadata/buckets";
const LOCKS_PREFIX: &str = ".metadata/locks";
const CACHE_TTL_SECONDS: i64 = 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bucket {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Lock {
    resource: String,
    owner: String,
    acquired_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
struct BucketCache {
    buckets: HashMap<String, Bucket>,
    last_refresh: DateTime<Utc>,
}

impl BucketCache {
    fn new() -> Self {
        Self {
            buckets: HashMap::new(),
            last_refresh: Utc::now() - chrono::Duration::seconds(CACHE_TTL_SECONDS + 1),
        }
    }

    fn is_expired(&self) -> bool {
        let age = Utc::now() - self.last_refresh;
        age.num_seconds() > CACHE_TTL_SECONDS
    }

    fn update(&mut self, buckets: Vec<Bucket>) {
        self.buckets.clear();
        for bucket in buckets {
            self.buckets.insert(bucket.name.clone(), bucket);
        }
        self.last_refresh = Utc::now();
    }

    fn get(&self, name: &str) -> Option<&Bucket> {
        self.buckets.get(name)
    }

    fn insert(&mut self, bucket: Bucket) {
        self.buckets.insert(bucket.name.clone(), bucket);
    }

    fn remove(&mut self, name: &str) -> Option<Bucket> {
        self.buckets.remove(name)
    }

    fn all_buckets(&self) -> Vec<Bucket> {
        self.buckets.values().cloned().collect()
    }
}

pub struct MetadataStore {
    backend: Arc<dyn Backend>,
    cache: Arc<RwLock<BucketCache>>,
}

impl MetadataStore {
    pub async fn new(backend: Arc<dyn Backend>) -> ServiceResult<Self> {
        let store = Self {
            backend,
            cache: Arc::new(RwLock::new(BucketCache::new())),
        };

        store.refresh_cache().await?;

        info!("Initialized metadata store (folder-based with caching)");
        Ok(store)
    }

    fn bucket_key(name: &str) -> String {
        format!("{}/{}.json", BUCKETS_PREFIX, name)
    }

    fn generate_bucket_id(name: &str) -> String {
        let mut hasher = DefaultHasher::new();
        name.hash(&mut hasher);
        let hash = hasher.finish();

        format!("bucket-{:016x}", hash)
    }

    async fn load_buckets_from_backend(&self) -> ServiceResult<Vec<Bucket>> {
        match self.backend.list_objects(Some(BUCKETS_PREFIX), None).await {
            Ok(objects) => {
                let mut buckets = Vec::new();
                let mut errors = 0;

                for obj in objects {
                    match self.backend.get_object(&obj.key).await {
                        Ok(mut obj_data) => {
                            // Collect stream to bytes
                            let mut data = Vec::new();
                            while let Some(chunk) = obj_data.stream.next().await {
                                if let Ok(bytes) = chunk {
                                    data.extend_from_slice(&bytes);
                                }
                            }

                            match serde_json::from_slice::<Bucket>(&data) {
                                Ok(bucket) => buckets.push(bucket),
                                Err(e) => {
                                    warn!("Failed to parse bucket {}: {}", obj.key, e);
                                    errors += 1;
                                }
                            }
                        }
                        Err(e) => {
                            warn!("Failed to read bucket object {}: {:?}", obj.key, e);
                            errors += 1;
                        }
                    }
                }

                if errors > 0 {
                    warn!("Loaded {} buckets with {} errors", buckets.len(), errors);
                }

                if errors > 0 && buckets.is_empty() {
                    return Err(ServiceError::Internal(format!(
                        "Failed to load any buckets ({} errors)",
                        errors
                    )));
                }

                Ok(buckets)
            }
            Err(BackendError::NotFound(_)) => {
                // No buckets yet
                Ok(Vec::new())
            }
            Err(e) => Err(ServiceError::Backend(e)),
        }
    }

    async fn refresh_cache(&self) -> ServiceResult<()> {
        let buckets = self.load_buckets_from_backend().await?;
        let mut cache = self.cache.write().await;
        cache.update(buckets);
        debug!("Refreshed bucket cache ({} buckets)", cache.buckets.len());
        Ok(())
    }

    async fn ensure_cache_fresh(&self) -> ServiceResult<()> {
        let cache = self.cache.read().await;
        if cache.is_expired() {
            drop(cache); // Release read lock
            self.refresh_cache().await?;
        }
        Ok(())
    }

    async fn load_bucket_from_backend(&self, name: &str) -> ServiceResult<Option<Bucket>> {
        let key = Self::bucket_key(name);
        match self.backend.get_object(&key).await {
            Ok(mut obj_data) => {
                // Collect stream to bytes
                let mut data = Vec::new();
                while let Some(chunk) = obj_data.stream.next().await {
                    let chunk = chunk.map_err(|e| ServiceError::Internal(e.to_string()))?;
                    data.extend_from_slice(&chunk);
                }

                let bucket: Bucket = serde_json::from_slice(&data)?;
                Ok(Some(bucket))
            }
            Err(BackendError::NotFound(_)) => Ok(None),
            Err(e) => Err(ServiceError::Backend(e)),
        }
    }

    async fn save_bucket(&self, bucket: &Bucket) -> ServiceResult<()> {
        let key = Self::bucket_key(&bucket.name);
        let data = serde_json::to_vec(bucket)?;

        // Convert Vec<u8> to stream
        let stream: object_store_backends::ByteStream =
            Box::pin(futures::stream::once(async move { Ok(Bytes::from(data)) }));

        self.backend
            .put_object(
                &key,
                stream,
                Some("application/json".to_string()),
                HashMap::new(),
            )
            .await?;

        Ok(())
    }

    async fn delete_bucket_object(&self, name: &str) -> ServiceResult<()> {
        let key = Self::bucket_key(name);
        self.backend.delete_object(&key).await?;
        Ok(())
    }

    pub async fn create_bucket(&self, name: &str) -> ServiceResult<Bucket> {
        if !is_valid_bucket_name(name) {
            return Err(ServiceError::InvalidBucketName(format!(
                "Invalid bucket name: {}",
                name
            )));
        }

        let bucket = Bucket {
            id: Self::generate_bucket_id(name),
            name: name.to_string(),
            created_at: Utc::now().to_rfc3339(),
        };

        {
            let cache = self.cache.read().await;
            if cache.get(name).is_some() {
                return Err(ServiceError::BucketAlreadyExists(name.to_string()));
            }
        }

        if let Some(_existing) = self.load_bucket_from_backend(name).await? {
            let mut cache = self.cache.write().await;
            if let Some(existing) = self.load_bucket_from_backend(name).await? {
                cache.insert(existing);
            }

            return Err(ServiceError::BucketAlreadyExists(name.to_string()));
        }

        self.save_bucket(&bucket).await?;

        {
            let mut cache = self.cache.write().await;
            cache.insert(bucket.clone());
        }

        info!("Bucket created: {} (id: {})", name, bucket.id);
        Ok(bucket)
    }

    pub async fn get_bucket(&self, name: &str) -> ServiceResult<Bucket> {
        // Try cache first
        {
            let cache = self.cache.read().await;
            if let Some(bucket) = cache.get(name) {
                return Ok(bucket.clone());
            }
        }

        // Not in cache - try direct backend lookup
        debug!("Bucket {} not in cache, checking backend", name);
        if let Some(bucket) = self.load_bucket_from_backend(name).await? {
            // Update cache with discovered bucket
            let mut cache = self.cache.write().await;
            cache.insert(bucket.clone());
            return Ok(bucket);
        }

        // Still not found - refresh entire cache and try again
        debug!("Bucket {} not found, refreshing cache", name);
        self.refresh_cache().await?;

        let cache = self.cache.read().await;
        cache
            .get(name)
            .cloned()
            .ok_or_else(|| ServiceError::BucketNotFound(name.to_string()))
    }

    pub async fn get_bucket_by_id(&self, id: &str) -> ServiceResult<Bucket> {
        // Ensure cache is fresh
        self.ensure_cache_fresh().await?;

        // Search cache for bucket by ID
        {
            let cache = self.cache.read().await;
            for bucket in cache.all_buckets() {
                if bucket.id == id {
                    return Ok(bucket);
                }
            }
        }

        // Not found in cache - refresh and try again
        self.refresh_cache().await?;

        let cache = self.cache.read().await;
        for bucket in cache.all_buckets() {
            if bucket.id == id {
                return Ok(bucket);
            }
        }

        Err(ServiceError::BucketNotFound(format!("id: {}", id)))
    }

    pub async fn list_buckets(&self) -> ServiceResult<Vec<Bucket>> {
        self.ensure_cache_fresh().await?;

        let cache = self.cache.read().await;
        let mut buckets = cache.all_buckets();
        buckets.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(buckets)
    }

    pub async fn delete_bucket(&self, name: &str) -> ServiceResult<()> {
        self.get_bucket(name).await?;

        self.delete_bucket_object(name).await?;

        {
            let mut cache = self.cache.write().await;
            cache.remove(name);
        }

        info!("Bucket deleted: {}", name);
        Ok(())
    }

    pub async fn force_refresh(&self) -> ServiceResult<()> {
        self.refresh_cache().await
    }

    pub async fn try_acquire_lock(
        &self,
        resource: &str,
        owner: &str,
        ttl_seconds: i64,
    ) -> ServiceResult<bool> {
        let lock_key = format!("{}/{}", LOCKS_PREFIX, resource);
        let now = Utc::now();
        let expires_at = now + chrono::Duration::seconds(ttl_seconds);

        match self.backend.get_object(&lock_key).await {
            Ok(mut obj_data) => {
                // Collect stream to bytes
                let mut data = Vec::new();
                while let Some(chunk) = obj_data.stream.next().await {
                    let chunk = chunk.map_err(|e| ServiceError::Internal(e.to_string()))?;
                    data.extend_from_slice(&chunk);
                }

                let existing_lock: Lock = serde_json::from_slice(&data)?;

                if existing_lock.expires_at > now {
                    debug!("Lock {} is held by {}", resource, existing_lock.owner);
                    return Ok(false);
                }

                debug!("Lock {} expired, acquiring", resource);
            }
            Err(BackendError::NotFound(_)) => {
                // No lock exists
                debug!("No lock found for {}, acquiring", resource);
            }
            Err(e) => return Err(ServiceError::Backend(e)),
        }

        let lock = Lock {
            resource: resource.to_string(),
            owner: owner.to_string(),
            acquired_at: now,
            expires_at,
        };

        let data = serde_json::to_vec(&lock)?;
        // Convert Vec<u8> to stream
        let stream: object_store_backends::ByteStream =
            Box::pin(futures::stream::once(async move { Ok(Bytes::from(data)) }));

        self.backend
            .put_object(
                &lock_key,
                stream,
                Some("application/json".to_string()),
                HashMap::new(),
            )
            .await?;

        debug!("Lock acquired for resource: {}", resource);
        Ok(true)
    }

    pub async fn release_lock(&self, resource: &str, owner: &str) -> ServiceResult<()> {
        let lock_key = format!("{}/{}", LOCKS_PREFIX, resource);

        match self.backend.get_object(&lock_key).await {
            Ok(mut obj_data) => {
                // Collect stream to bytes
                let mut data = Vec::new();
                while let Some(chunk) = obj_data.stream.next().await {
                    let chunk = chunk.map_err(|e| ServiceError::Internal(e.to_string()))?;
                    data.extend_from_slice(&chunk);
                }

                let existing_lock: Lock = serde_json::from_slice(&data)?;
                if existing_lock.owner != owner {
                    return Err(ServiceError::LockAcquisition(format!(
                        "Cannot release lock owned by {}",
                        existing_lock.owner
                    )));
                }
            }
            Err(BackendError::NotFound(_)) => {
                // Lock doesn't exist, nothing to release
                return Ok(());
            }
            Err(e) => return Err(ServiceError::Backend(e)),
        }

        self.backend.delete_object(&lock_key).await?;
        debug!("Lock released for resource: {}", resource);
        Ok(())
    }

    pub async fn cleanup_expired_locks(&self) -> ServiceResult<u64> {
        let now = Utc::now();
        let mut cleaned = 0u64;

        match self.backend.list_objects(Some(LOCKS_PREFIX), None).await {
            Ok(objects) => {
                for obj in objects {
                    // Try to read lock and check expiration
                    if let Ok(mut obj_data) = self.backend.get_object(&obj.key).await {
                        // Collect stream to bytes
                        let mut data = Vec::new();
                        while let Some(chunk) = obj_data.stream.next().await {
                            if let Ok(bytes) = chunk {
                                data.extend_from_slice(&bytes);
                            }
                        }

                        if let Ok(lock) = serde_json::from_slice::<Lock>(&data) {
                            if lock.expires_at < now {
                                // Lock expired, delete it
                                if self.backend.delete_object(&obj.key).await.is_ok() {
                                    cleaned += 1;
                                    debug!("Cleaned up expired lock: {}", lock.resource);
                                }
                            }
                        }
                    }
                }
            }
            Err(BackendError::NotFound(_)) => {
                // No locks directory yet
            }
            Err(e) => return Err(ServiceError::Backend(e)),
        }

        if cleaned > 0 {
            info!("Cleaned up {} expired locks", cleaned);
        }

        Ok(cleaned)
    }
}

fn is_valid_bucket_name(name: &str) -> bool {
    if name.len() < 3 || name.len() > 63 {
        return false;
    }

    let bytes = name.as_bytes();
    let first = bytes[0];
    let last = bytes[bytes.len() - 1];

    if !first.is_ascii_lowercase() && !first.is_ascii_digit() {
        return false;
    }

    if !last.is_ascii_lowercase() && !last.is_ascii_digit() {
        return false;
    }

    name.chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_bucket_names() {
        assert!(is_valid_bucket_name("my-bucket"));
        assert!(is_valid_bucket_name("bucket123"));
        assert!(is_valid_bucket_name("abc"));
        assert!(is_valid_bucket_name("my-bucket-123"));
    }

    #[test]
    fn test_invalid_bucket_names() {
        assert!(!is_valid_bucket_name("ab")); // Too short
        assert!(!is_valid_bucket_name("My-Bucket")); // Uppercase
        assert!(!is_valid_bucket_name("-bucket")); // Starts with hyphen
        assert!(!is_valid_bucket_name("bucket-")); // Ends with hyphen
        assert!(!is_valid_bucket_name("bucket_name")); // Underscore
    }

    #[test]
    fn test_deterministic_bucket_id() {
        let id1 = MetadataStore::generate_bucket_id("my-bucket");
        let id2 = MetadataStore::generate_bucket_id("my-bucket");
        assert_eq!(id1, id2, "Same bucket name should generate same ID");

        let id3 = MetadataStore::generate_bucket_id("other-bucket");
        assert_ne!(
            id1, id3,
            "Different bucket names should generate different IDs"
        );
    }
}
