use async_trait::async_trait;
use azure_core::auth::{Secret, TokenCredential};
use azure_core::error::ErrorKind;
use azure_core::request_options::IfMatchCondition;
use azure_core::Url;
use azure_storage::prelude::*;
use azure_storage::shared_access_signature::service_sas::BlobSasPermissions;
use azure_storage::CloudLocation;
use azure_storage_blobs::blob::operations::GetBlobResponse;
use azure_storage_blobs::blob::BlobProperties;
use azure_storage_blobs::prelude::*;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use time::OffsetDateTime;
use tracing::{debug, info, warn};

use crate::backend::{
    normalize_etag, Backend, ByteRange, ByteStream, ObjectData, ObjectMetadata, ObjectPage,
    ObjectRangeData, PublicUrlPurpose, SignedUrl, WritePrecondition,
};
use crate::error::{is_transient_status, BackendError, BackendResult};
use crate::multipart::{MultipartUpload, PartReceipt, PutOptions, UploadLimits, MIB};
use crate::uploader::Uploader;

const COPY_POLL_INTERVAL: Duration = Duration::from_millis(250);
const COPY_POLL_ATTEMPTS: usize = 240;

const AZURE_LIMITS: UploadLimits = UploadLimits {
    min_part_size: 1,
    max_part_size: 4000 * MIB,
    max_parts: 50_000,
    part_alignment: 1,
    max_concurrency: u32::MAX,
    max_object_size: 50_000 * 4000 * MIB,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AzureAuth {
    AccessKey(String),
    /// Environment (including AKS workload identity), managed identity and the Azure CLI, in that order.
    Default,
    WorkloadIdentity,
    ManagedIdentity,
}

#[derive(Debug, Clone)]
pub struct AzureOptions {
    pub account: String,
    pub auth: AzureAuth,
    /// Blob service URL including the account path for emulators and private endpoints.
    pub endpoint: Option<String>,
    /// Blob service URL put into signed URLs when clients reach storage on another address.
    pub public_endpoint: Option<String>,
}

impl AzureOptions {
    pub fn new(account: impl Into<String>, auth: AzureAuth) -> Self {
        Self {
            account: account.into(),
            auth,
            endpoint: None,
            public_endpoint: None,
        }
    }

    pub fn from_connection_string(connection_string: &str) -> BackendResult<Self> {
        let mut account = None;
        let mut access_key = None;
        let mut endpoint = None;

        for part in connection_string.split(';') {
            let Some((name, value)) = part.split_once('=') else {
                continue;
            };

            match name.trim() {
                "AccountName" => account = Some(value.trim().to_string()),
                "AccountKey" => access_key = Some(value.trim().to_string()),
                "BlobEndpoint" => endpoint = Some(value.trim().trim_end_matches('/').to_string()),
                _ => {}
            }
        }

        let (Some(account), Some(access_key)) = (account, access_key) else {
            return Err(BackendError::Configuration(
                "AccountName or AccountKey not found in connection string".to_string(),
            ));
        };

        Ok(Self {
            account,
            auth: AzureAuth::AccessKey(access_key),
            endpoint,
            public_endpoint: None,
        })
    }
}

pub struct AzureBackend {
    client: ContainerClient,
    signing_client: ContainerClient,
    container_name: String,
    uses_account_key: bool,
    uploader: Arc<Uploader>,
}

fn status_of(error: &azure_core::Error) -> Option<u16> {
    match error.kind() {
        ErrorKind::HttpResponse { status, .. } => Some(u16::from(*status)),
        _ => None,
    }
}

fn is_not_found(error: &azure_core::Error) -> bool {
    status_of(error) == Some(404)
}

fn is_precondition_failure(error: &azure_core::Error) -> bool {
    matches!(status_of(error), Some(409) | Some(412))
}

fn is_transient(error: &azure_core::Error) -> bool {
    match error.kind() {
        ErrorKind::HttpResponse { status, .. } => is_transient_status(u16::from(*status)),
        ErrorKind::Io => true,
        _ => false,
    }
}

// Committing a block list (or writing the blob any other way) discards every uncommitted block
// of that blob, including those staged by a concurrent upload to the same name.
fn is_invalid_block_list(error: &azure_core::Error) -> bool {
    matches!(
        error.kind(),
        ErrorKind::HttpResponse { error_code: Some(code), .. } if code == "InvalidBlockList"
    )
}

fn provider_error(action: &str, key: &str, error: azure_core::Error) -> BackendError {
    let message = format!("Failed to {} '{}': {}", action, key, error);
    if is_transient(&error) {
        BackendError::Retryable(message)
    } else {
        BackendError::Provider(message)
    }
}

fn to_metadata(custom_metadata: &HashMap<String, String>) -> azure_core::request_options::Metadata {
    let mut metadata = azure_core::request_options::Metadata::new();
    for (k, v) in custom_metadata.iter() {
        metadata.insert(k.clone(), v.clone());
    }
    metadata
}

fn to_io_error(error: azure_core::Error) -> std::io::Error {
    std::io::Error::other(error.to_string())
}

fn to_utc(time: OffsetDateTime) -> DateTime<Utc> {
    DateTime::from_timestamp(time.unix_timestamp(), time.nanosecond()).unwrap_or_else(Utc::now)
}

fn base_url_of(endpoint: &str, account: &str) -> CloudLocation {
    CloudLocation::Custom {
        account: account.to_string(),
        uri: endpoint.trim_end_matches('/').to_string(),
    }
}

impl AzureBackend {
    pub fn new(account: String, access_key: String, container_name: String) -> BackendResult<Self> {
        Self::new_with_options(
            AzureOptions::new(account, AzureAuth::AccessKey(access_key)),
            container_name,
        )
    }

    pub fn new_from_connection_string(
        connection_string: String,
        container_name: String,
    ) -> BackendResult<Self> {
        Self::new_with_options(
            AzureOptions::from_connection_string(&connection_string)?,
            container_name,
        )
    }

    pub fn new_with_options(options: AzureOptions, container_name: String) -> BackendResult<Self> {
        let uses_account_key = matches!(options.auth, AzureAuth::AccessKey(_));
        let credentials = Self::credentials(&options)?;

        let location = match &options.endpoint {
            Some(endpoint) => base_url_of(endpoint, &options.account),
            None => CloudLocation::Public {
                account: options.account.clone(),
            },
        };

        let client = ClientBuilder::with_location(location, credentials.clone())
            .container_client(&container_name);

        let signing_client = match &options.public_endpoint {
            Some(public) => ClientBuilder::with_location(
                base_url_of(public, &options.account),
                credentials.clone(),
            )
            .container_client(&container_name),
            None => client.clone(),
        };

        info!(
            "Initialized Azure Blob Storage backend with container: {} ({})",
            container_name,
            if uses_account_key {
                "account key"
            } else {
                "token credential"
            }
        );

        Ok(Self {
            client,
            signing_client,
            container_name,
            uses_account_key,
            uploader: Arc::default(),
        })
    }

    pub fn with_uploader(mut self, uploader: Arc<Uploader>) -> Self {
        self.uploader = uploader;
        self
    }

    fn credentials(options: &AzureOptions) -> BackendResult<StorageCredentials> {
        let credential_error = |e: azure_core::Error| {
            BackendError::Configuration(format!("Cannot create Azure credential: {}", e))
        };

        let token_credential: Arc<dyn TokenCredential> = match &options.auth {
            AzureAuth::AccessKey(key) => {
                return Ok(StorageCredentials::access_key(
                    options.account.clone(),
                    Secret::new(key.clone()),
                ));
            }
            AzureAuth::Default => {
                azure_identity::create_default_credential().map_err(credential_error)?
            }
            AzureAuth::WorkloadIdentity => Arc::new(
                azure_identity::WorkloadIdentityCredential::create(
                    azure_identity::TokenCredentialOptions::default(),
                )
                .map_err(credential_error)?,
            ),
            AzureAuth::ManagedIdentity => Arc::new(
                azure_identity::VirtualMachineManagedIdentityCredential::new(
                    azure_identity::TokenCredentialOptions::default(),
                ),
            ),
        };

        Ok(StorageCredentials::token_credential(token_credential))
    }

    fn to_object_metadata(
        key: String,
        properties: &BlobProperties,
        metadata: Option<HashMap<String, String>>,
    ) -> ObjectMetadata {
        ObjectMetadata {
            key,
            size: properties.content_length,
            content_type: Some(properties.content_type.clone()),
            last_modified: to_utc(properties.last_modified),
            etag: normalize_etag(properties.etag.as_ref()),
            custom_metadata: metadata.unwrap_or_default(),
        }
    }

    async fn head_with_raw_etag(&self, key: &str) -> BackendResult<(ObjectMetadata, String)> {
        match self.client.blob_client(key).get_properties().await {
            Ok(response) => {
                let raw_etag = response.blob.properties.etag.to_string();
                let metadata = Self::to_object_metadata(
                    key.to_string(),
                    &response.blob.properties,
                    response.blob.metadata,
                );
                Ok((metadata, raw_etag))
            }
            Err(e) if is_not_found(&e) => Err(BackendError::NotFound(key.to_string())),
            Err(e) => {
                warn!("Failed to get blob properties from Azure: {}: {:?}", key, e);
                Err(provider_error("get metadata for", key, e))
            }
        }
    }

    fn blob_stream(
        key: &str,
        pages: azure_core::Pageable<GetBlobResponse, azure_core::Error>,
    ) -> ByteStream {
        let key = key.to_string();

        Box::pin(pages.then(move |page| {
            let key = key.clone();
            async move {
                match page {
                    Ok(response) => response.data.collect().await.map_err(to_io_error),
                    Err(e) => {
                        warn!("Failed to read blob from Azure: {}: {:?}", key, e);
                        Err(to_io_error(e))
                    }
                }
            }
        }))
    }

    async fn put_block_blob(
        &self,
        key: &str,
        data: Bytes,
        content_type: Option<String>,
        custom_metadata: HashMap<String, String>,
        condition: Option<IfMatchCondition>,
    ) -> BackendResult<ObjectMetadata> {
        let size = data.len() as u64;

        let mut request = self
            .client
            .blob_client(key)
            .put_block_blob(data)
            .metadata(to_metadata(&custom_metadata));

        if let Some(ct) = content_type.as_ref() {
            request = request.content_type(ct.clone());
        }

        if let Some(condition) = condition {
            request = request.if_match(condition);
        }

        match request.await {
            Ok(response) => {
                debug!("Uploaded blob to Azure: {} ({} bytes)", key, size);
                Ok(ObjectMetadata {
                    key: key.to_string(),
                    size,
                    content_type,
                    last_modified: to_utc(response.last_modified),
                    etag: normalize_etag(&response.etag),
                    custom_metadata,
                })
            }
            Err(e) if is_precondition_failure(&e) => {
                Err(BackendError::PreconditionFailed(key.to_string()))
            }
            Err(e) => {
                warn!("Failed to upload blob to Azure: {}: {:?}", key, e);
                Err(provider_error("upload blob", key, e))
            }
        }
    }

    async fn sas_query(
        &self,
        key: &str,
        expiration_secs: u64,
        permissions: BlobSasPermissions,
    ) -> BackendResult<Url> {
        let blob_client = self.signing_client.blob_client(key);
        let expiry = OffsetDateTime::now_utc() + time::Duration::seconds(expiration_secs as i64);

        let sas_error =
            |e: azure_core::Error| BackendError::Provider(format!("Failed to sign URL: {}", e));

        if self.uses_account_key {
            let signature = blob_client
                .shared_access_signature(permissions, expiry)
                .await
                .map_err(sas_error)?;

            return blob_client
                .generate_signed_blob_url(&signature)
                .map_err(sas_error);
        }

        // The SAS lifetime of a user delegation signature is the lifetime of its key.
        let delegation_key = self
            .client
            .service_client()
            .get_user_deligation_key(
                OffsetDateTime::now_utc() - time::Duration::minutes(5),
                expiry,
            )
            .await
            .map_err(sas_error)?
            .user_deligation_key;

        let signature = blob_client
            .user_delegation_shared_access_signature(permissions, &delegation_key)
            .await
            .map_err(sas_error)?;

        blob_client
            .generate_signed_blob_url(&signature)
            .map_err(sas_error)
    }
}

/// Blocks are staged under ids unique to this upload, so concurrent uploads to the same blob
/// can't overwrite each other's uncommitted blocks.
struct AzureBlockUpload {
    blob: BlobClient,
    key: String,
    upload_id: String,
    content_type: Option<String>,
    custom_metadata: HashMap<String, String>,
}

impl AzureBlockUpload {
    // Every id in a block list must have the same length.
    fn block_id(&self, number: u32) -> String {
        format!("{}-{:010}", self.upload_id, number)
    }
}

#[async_trait]
impl MultipartUpload for AzureBlockUpload {
    async fn upload_part(
        &self,
        number: u32,
        offset: u64,
        data: Bytes,
    ) -> BackendResult<PartReceipt> {
        let size = data.len() as u64;
        let block_id = self.block_id(number);

        self.blob.put_block(block_id, data).await.map_err(|e| {
            warn!("Failed to stage block {} of {}: {:?}", number, self.key, e);
            provider_error(&format!("stage block {} of", number), &self.key, e)
        })?;

        Ok(PartReceipt {
            number,
            offset,
            size,
            etag: None,
        })
    }

    async fn complete(&self, parts: Vec<PartReceipt>) -> BackendResult<ObjectMetadata> {
        let size = parts.iter().map(|part| part.size).sum();

        let block_list = BlockList {
            blocks: parts
                .iter()
                .map(|part| BlobBlockType::new_latest(self.block_id(part.number)))
                .collect(),
        };

        let mut request = self
            .blob
            .put_block_list(block_list)
            .metadata(to_metadata(&self.custom_metadata));

        if let Some(ct) = self.content_type.as_ref() {
            request = request.content_type(ct.clone());
        }

        let response = request.await.map_err(|e| {
            warn!(
                "Failed to commit blocks for Azure blob {}: {:?}",
                self.key, e
            );
            if is_invalid_block_list(&e) {
                return BackendError::Conflict(format!(
                    "another write to '{}' committed first and discarded this upload's blocks",
                    self.key
                ));
            }
            provider_error("commit blocks for blob", &self.key, e)
        })?;

        debug!(
            "Uploaded blob to Azure in {} blocks: {} ({} bytes)",
            parts.len(),
            self.key,
            size
        );

        Ok(ObjectMetadata {
            key: self.key.clone(),
            size,
            content_type: self.content_type.clone(),
            last_modified: to_utc(response.last_modified),
            etag: normalize_etag(&response.etag),
            custom_metadata: self.custom_metadata.clone(),
        })
    }

    // Uncommitted blocks are never visible; Azure discards them on the blob's next commit or
    // after a week.
    async fn abort(&self) {}
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

    fn uploader(&self) -> &Uploader {
        &self.uploader
    }

    fn upload_limits(&self) -> UploadLimits {
        AZURE_LIMITS
    }

    async fn put_single(
        &self,
        key: &str,
        data: Bytes,
        opts: &PutOptions,
    ) -> BackendResult<ObjectMetadata> {
        self.put_block_blob(
            key,
            data,
            opts.content_type.clone(),
            opts.metadata.clone(),
            None,
        )
        .await
    }

    async fn start_multipart(
        &self,
        key: &str,
        opts: &PutOptions,
    ) -> BackendResult<Arc<dyn MultipartUpload>> {
        Ok(Arc::new(AzureBlockUpload {
            blob: self.client.blob_client(key),
            key: key.to_string(),
            upload_id: uuid::Uuid::new_v4().simple().to_string(),
            content_type: opts.content_type.clone(),
            custom_metadata: opts.metadata.clone(),
        }))
    }

    async fn put_object_if(
        &self,
        key: &str,
        data: Bytes,
        content_type: Option<String>,
        precondition: WritePrecondition,
    ) -> BackendResult<ObjectMetadata> {
        let condition = match precondition {
            WritePrecondition::IfAbsent => IfMatchCondition::NotMatch("*".to_string()),
            WritePrecondition::IfMatch(etag) => IfMatchCondition::Match(format!("\"{}\"", etag)),
        };

        self.put_block_blob(key, data, content_type, HashMap::new(), Some(condition))
            .await
    }

    async fn get_object(&self, key: &str) -> BackendResult<ObjectData> {
        let (metadata, raw_etag) = self.head_with_raw_etag(key).await?;

        if metadata.size == 0 {
            return Ok(ObjectData {
                metadata,
                stream: Box::pin(futures::stream::empty()),
            });
        }

        let pages = self
            .client
            .blob_client(key)
            .get()
            .if_match(IfMatchCondition::Match(raw_etag))
            .into_stream();

        debug!(
            "Streaming blob from Azure: {} ({} bytes)",
            key, metadata.size
        );

        Ok(ObjectData {
            metadata,
            stream: Self::blob_stream(key, pages),
        })
    }

    async fn get_object_range(
        &self,
        key: &str,
        range: ByteRange,
    ) -> BackendResult<ObjectRangeData> {
        let (metadata, raw_etag) = self.head_with_raw_etag(key).await?;
        let (start, end) =
            range
                .resolve(metadata.size)
                .ok_or(BackendError::RangeNotSatisfiable {
                    size: metadata.size,
                })?;

        let pages = self
            .client
            .blob_client(key)
            .get()
            .range(start..end + 1)
            .if_match(IfMatchCondition::Match(raw_etag))
            .into_stream();

        debug!("Streaming range {}-{} of Azure blob: {}", start, end, key);

        Ok(ObjectRangeData {
            metadata,
            start,
            end,
            stream: Self::blob_stream(key, pages),
        })
    }

    async fn head_object(&self, key: &str) -> BackendResult<ObjectMetadata> {
        Ok(self.head_with_raw_etag(key).await?.0)
    }

    async fn delete_object(&self, key: &str) -> BackendResult<()> {
        match self.client.blob_client(key).delete().await {
            Ok(_) => {
                debug!("Deleted blob from Azure: {}", key);
                Ok(())
            }
            Err(e) if is_not_found(&e) => Ok(()),
            Err(e) => {
                warn!("Failed to delete blob from Azure: {}: {:?}", key, e);
                Err(provider_error("delete blob", key, e))
            }
        }
    }

    async fn copy_object(&self, source_key: &str, dest_key: &str) -> BackendResult<ObjectMetadata> {
        let source_url = self
            .client
            .blob_client(source_key)
            .url()
            .map_err(|e| provider_error("resolve copy source", source_key, e))?;

        let dest = self.client.blob_client(dest_key);

        match dest.copy(source_url).await {
            Ok(_) => {}
            Err(e) if is_not_found(&e) => {
                return Err(BackendError::NotFound(source_key.to_string()))
            }
            Err(e) => {
                warn!(
                    "Failed to copy Azure blob {} to {}: {:?}",
                    source_key, dest_key, e
                );
                return Err(provider_error("copy blob", source_key, e));
            }
        }

        for _ in 0..COPY_POLL_ATTEMPTS {
            let response = dest
                .get_properties()
                .await
                .map_err(|e| provider_error("check copy of", dest_key, e))?;

            let status = response
                .blob
                .properties
                .copy_status
                .as_ref()
                .map(|s| format!("{:?}", s).to_lowercase());

            match status.as_deref() {
                None | Some("success") => {
                    return Ok(Self::to_object_metadata(
                        dest_key.to_string(),
                        &response.blob.properties,
                        response.blob.metadata,
                    ));
                }
                Some("pending") => tokio::time::sleep(COPY_POLL_INTERVAL).await,
                Some(other) => {
                    return Err(BackendError::Provider(format!(
                        "Copy of '{}' to '{}' ended with status {}",
                        source_key, dest_key, other
                    )));
                }
            }
        }

        Err(BackendError::Provider(format!(
            "Copy of '{}' to '{}' did not complete in time",
            source_key, dest_key
        )))
    }

    async fn list_objects(
        &self,
        prefix: Option<&str>,
        max_keys: Option<usize>,
        continuation_token: Option<&str>,
    ) -> BackendResult<ObjectPage> {
        let mut request = self.client.list_blobs();

        if let Some(p) = prefix {
            request = request.prefix(p.to_string());
        }

        if let Some(max) = max_keys {
            if let Some(max_nz) = std::num::NonZeroU32::new(max as u32) {
                request = request.max_results(max_nz);
            }
        }

        if let Some(token) = continuation_token {
            request = request.marker(azure_core::prelude::NextMarker::from(token.to_string()));
        }

        match request.into_stream().next().await {
            Some(Ok(response)) => {
                let next_continuation_token = response
                    .next_marker
                    .as_ref()
                    .map(|marker| marker.as_str().to_string());

                let objects: Vec<ObjectMetadata> = response
                    .blobs
                    .items
                    .into_iter()
                    .filter_map(|item| {
                        use azure_storage_blobs::container::operations::BlobItem;
                        if let BlobItem::Blob(blob) = item {
                            Some(Self::to_object_metadata(
                                blob.name,
                                &blob.properties,
                                blob.metadata,
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

                Ok(ObjectPage {
                    objects,
                    next_continuation_token,
                })
            }
            Some(Err(e)) if is_not_found(&e) => Err(BackendError::NotFound(format!(
                "container:{}",
                self.container_name
            ))),
            Some(Err(e)) => {
                warn!("Failed to list blobs from Azure: {:?}", e);
                Err(provider_error("list blobs in", &self.container_name, e))
            }
            None => Ok(ObjectPage::default()),
        }
    }

    async fn get_public_url(
        &self,
        key: &str,
        expiration_secs: u64,
        purpose: PublicUrlPurpose,
    ) -> BackendResult<SignedUrl> {
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

        let url = self.sas_query(key, expiration_secs, permissions).await?;
        let mut signed = SignedUrl::new(url.to_string());

        if matches!(purpose, PublicUrlPurpose::Upload) {
            signed = signed.with_header("x-ms-blob-type", "BlockBlob");
        }

        debug!(
            "Generated SAS {:?} URL for Azure blob: {} (expires in {} seconds)",
            purpose, key, expiration_secs
        );

        Ok(signed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &str = "Zm9vYmFyZm9vYmFyZm9vYmFy";

    fn backend(public_endpoint: Option<&str>) -> AzureBackend {
        let mut options = AzureOptions::new("devstore", AzureAuth::AccessKey(KEY.to_string()));
        options.endpoint = Some("http://azurite:10000/devstore".to_string());
        options.public_endpoint = public_endpoint.map(|e| e.to_string());
        AzureBackend::new_with_options(options, "files".to_string()).unwrap()
    }

    #[test]
    fn parses_connection_strings() {
        let options = AzureOptions::from_connection_string(
            "DefaultEndpointsProtocol=http;AccountName=devstore;AccountKey=a2V5PT0=;BlobEndpoint=http://127.0.0.1:10000/devstore/;",
        )
        .unwrap();

        assert_eq!(options.account, "devstore");
        assert_eq!(options.auth, AzureAuth::AccessKey("a2V5PT0=".to_string()));
        assert_eq!(
            options.endpoint.as_deref(),
            Some("http://127.0.0.1:10000/devstore")
        );
    }

    #[test]
    fn rejects_connection_strings_without_credentials() {
        assert!(AzureOptions::from_connection_string("AccountName=devstore").is_err());
    }

    #[tokio::test]
    async fn signs_downloads_for_the_internal_endpoint() {
        let signed = backend(None)
            .get_public_url("a/b c.txt", 300, PublicUrlPurpose::Retrieve)
            .await
            .unwrap();

        assert!(signed
            .url
            .starts_with("http://azurite:10000/devstore/files/a/b%20c.txt?"));
        assert!(signed.url.contains("sig="));
        assert!(signed.url.contains("sp=r"));
        assert!(signed.headers.is_empty());
    }

    #[tokio::test]
    async fn signs_uploads_with_the_blob_type_header() {
        let signed = backend(Some("https://storage.example.com/devstore"))
            .get_public_url("file.bin", 300, PublicUrlPurpose::Upload)
            .await
            .unwrap();

        assert!(signed
            .url
            .starts_with("https://storage.example.com/devstore/files/file.bin?"));
        assert!(signed.url.contains("sp=cw"));
        assert_eq!(
            signed.headers.get("x-ms-blob-type").map(String::as_str),
            Some("BlockBlob")
        );
    }

    #[test]
    fn maps_status_codes() {
        let precondition = azure_core::Error::new(
            ErrorKind::HttpResponse {
                status: azure_core::StatusCode::PreconditionFailed,
                error_code: None,
            },
            "failed",
        );
        let missing = azure_core::Error::new(
            ErrorKind::HttpResponse {
                status: azure_core::StatusCode::NotFound,
                error_code: None,
            },
            "missing",
        );

        assert!(is_precondition_failure(&precondition));
        assert!(!is_not_found(&precondition));
        assert!(is_not_found(&missing));
    }
}
