use async_trait::async_trait;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use google_cloud_storage::client::google_cloud_auth::credentials::CredentialsFile;
use google_cloud_storage::client::{Client, ClientConfig};
use google_cloud_storage::http::objects::copy::CopyObjectRequest;
use google_cloud_storage::http::objects::delete::DeleteObjectRequest;
use google_cloud_storage::http::objects::download::Range;
use google_cloud_storage::http::objects::get::GetObjectRequest;
use google_cloud_storage::http::objects::list::ListObjectsRequest;
use google_cloud_storage::http::objects::upload::{UploadObjectRequest, UploadType};
use google_cloud_storage::http::objects::Object;
use google_cloud_storage::http::Error as GcsError;
use google_cloud_storage::sign::{SignBy, SignedURLMethod, SignedURLOptions, URLStyle};
use reqwest::header::{HeaderMap, CONTENT_LENGTH, CONTENT_RANGE, RANGE};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::backend::{
    Backend, ByteRange, ByteStream, ObjectData, ObjectMetadata, ObjectPage, ObjectRangeData,
    PublicUrlPurpose, SignedUrl, WritePrecondition,
};
use crate::error::{is_transient_status, BackendError, BackendResult};
use crate::multipart::{MultipartUpload, PartReceipt, PutOptions, UploadLimits, KIB, TIB};
use crate::uploader::Uploader;

// A resumable session only persists whole multiples of 256 KiB from a chunk that doesn't finish
// the upload, so every chunk but the last is aligned to it.
const GCS_CHUNK_ALIGNMENT: u64 = 256 * KIB;

const GCS_LIMITS: UploadLimits = UploadLimits {
    min_part_size: GCS_CHUNK_ALIGNMENT,
    max_part_size: 5 * TIB,
    max_parts: u32::MAX,
    part_alignment: GCS_CHUNK_ALIGNMENT,
    max_concurrency: 1,
    max_object_size: 5 * TIB,
};

const SESSION_CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
const SESSION_REQUEST_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const MAX_CHUNK_ROUNDS: usize = 8;

pub struct GcsBackend {
    client: Client,
    bucket_name: String,
    signing_style: SigningStyle,
    sessions: reqwest::Client,
    uploader: Arc<Uploader>,
}

#[derive(Debug, Clone, Default)]
pub struct GcsOptions {
    /// API endpoint the service talks to, for GCS-compatible servers such as fake-gcs-server.
    /// Requests are unauthenticated when set.
    pub endpoint: Option<String>,
    /// Endpoint embedded in signed URLs, when clients reach the store under a different address
    /// than the service does. Defaults to `endpoint`, then to storage.googleapis.com.
    pub public_endpoint: Option<String>,
    /// Service account key file. Without it, Application Default Credentials are used, which is
    /// the keyless path on GKE and Compute Engine: signing then goes through the IAM
    /// `signBlob` API and the service account needs `roles/iam.serviceAccountTokenCreator` on
    /// itself.
    pub credentials_file: Option<String>,
}

#[derive(Debug, Clone)]
struct SigningStyle {
    host: Option<String>,
    insecure: bool,
}

struct EndpointStyle {
    host: String,
}

impl URLStyle for EndpointStyle {
    fn host(&self, _bucket: &str) -> String {
        self.host.clone()
    }

    fn path(&self, bucket: &str, object: &str) -> String {
        if object.is_empty() {
            return bucket.to_string();
        }
        format!("{bucket}/{object}")
    }
}

fn split_endpoint(endpoint: &str) -> BackendResult<(String, bool)> {
    let endpoint = endpoint.trim().trim_end_matches('/');

    let (insecure, host) = if let Some(host) = endpoint.strip_prefix("http://") {
        (true, host)
    } else if let Some(host) = endpoint.strip_prefix("https://") {
        (false, host)
    } else {
        return Err(BackendError::Configuration(format!(
            "GCS endpoint '{}' must start with http:// or https://",
            endpoint
        )));
    };

    if host.is_empty() || host.contains('/') {
        return Err(BackendError::Configuration(format!(
            "GCS endpoint '{}' must not contain a path",
            endpoint
        )));
    }

    Ok((host.to_string(), insecure))
}

fn status_of(error: &GcsError) -> Option<u16> {
    match error {
        GcsError::Response(response) => Some(response.code),
        _ => None,
    }
}

fn is_not_found(error: &GcsError) -> bool {
    status_of(error) == Some(404)
}

fn is_transient_http(error: &reqwest::Error) -> bool {
    error.is_timeout()
        || error.is_connect()
        || error.is_request()
        || error.is_body()
        || error
            .status()
            .is_some_and(|status| is_transient_status(status.as_u16()))
}

fn is_transient(error: &GcsError) -> bool {
    match error {
        GcsError::Response(response) => is_transient_status(response.code),
        GcsError::HttpClient(error) => is_transient_http(error),
        _ => false,
    }
}

fn gcs_error(message: String, error: &GcsError) -> BackendError {
    if is_transient(error) {
        BackendError::Retryable(message)
    } else {
        BackendError::Provider(message)
    }
}

impl GcsBackend {
    pub async fn new(bucket_name: String) -> BackendResult<Self> {
        Self::new_with_options(bucket_name, GcsOptions::default()).await
    }

    pub async fn new_with_credentials(
        bucket_name: String,
        credentials_path: String,
    ) -> BackendResult<Self> {
        Self::new_with_options(
            bucket_name,
            GcsOptions {
                credentials_file: Some(credentials_path),
                ..Default::default()
            },
        )
        .await
    }

    pub async fn new_with_options(bucket_name: String, options: GcsOptions) -> BackendResult<Self> {
        let credentials = match &options.credentials_file {
            Some(path) => Some(CredentialsFile::new_from_file(path.clone()).await.map_err(
                |e| {
                    BackendError::Configuration(format!(
                        "Failed to read GCS credentials file '{}': {}",
                        path, e
                    ))
                },
            )?),
            None => None,
        };

        let mut config = ClientConfig::default();

        if let Some(endpoint) = &options.endpoint {
            config.storage_endpoint = endpoint.trim_end_matches('/').to_string();
            config = config.anonymous();

            // Without a token source nothing derives the signing identity from the credentials,
            // so it is taken from the key file directly.
            if let Some(credentials) = credentials {
                config.default_google_access_id = credentials.client_email.clone();
                config.default_sign_by = credentials
                    .private_key
                    .clone()
                    .map(|key| SignBy::PrivateKey(key.into_bytes()));
            }
        } else {
            config = match credentials {
                Some(credentials) => config.with_credentials(credentials).await,
                None => config.with_auth().await,
            }
            .map_err(|e| {
                BackendError::Configuration(format!("Failed to initialize GCS auth: {}", e))
            })?;
        }

        let signing_style = match options
            .public_endpoint
            .as_ref()
            .or(options.endpoint.as_ref())
        {
            Some(endpoint) => {
                let (host, insecure) = split_endpoint(endpoint)?;
                SigningStyle {
                    host: Some(host),
                    insecure,
                }
            }
            None => SigningStyle {
                host: None,
                insecure: false,
            },
        };

        let client = Client::new(config);

        let sessions = reqwest::Client::builder()
            .connect_timeout(SESSION_CONNECT_TIMEOUT)
            .timeout(SESSION_REQUEST_TIMEOUT)
            .build()
            .map_err(|e| {
                BackendError::Configuration(format!("Failed to create GCS upload client: {}", e))
            })?;

        info!(
            "Initialized GCS backend with bucket: {} (endpoint: {:?}, public endpoint: {:?})",
            bucket_name, options.endpoint, options.public_endpoint
        );
        Ok(Self {
            client,
            bucket_name,
            signing_style,
            sessions,
            uploader: Arc::default(),
        })
    }

    pub fn with_uploader(mut self, uploader: Arc<Uploader>) -> Self {
        self.uploader = uploader;
        self
    }

    // The etag is the generation: it changes with every write and is what
    // `ifGenerationMatch` accepts, which the JSON API offers in place of `If-Match`.
    fn object_to_metadata(object: Object, content_type: Option<String>) -> ObjectMetadata {
        let last_modified = object
            .updated
            .and_then(|dt| DateTime::from_timestamp(dt.unix_timestamp(), dt.nanosecond()))
            .unwrap_or_else(Utc::now);

        ObjectMetadata {
            key: object.name,
            size: object.size as u64,
            content_type: object.content_type.or(content_type),
            etag: object.generation.to_string(),
            last_modified,
            custom_metadata: object.metadata.unwrap_or_default(),
        }
    }

    fn upload_object_metadata(
        key: &str,
        content_type: &Option<String>,
        custom_metadata: &HashMap<String, String>,
    ) -> Object {
        Object {
            name: key.to_string(),
            content_type: content_type.clone(),
            metadata: if custom_metadata.is_empty() {
                None
            } else {
                Some(custom_metadata.clone())
            },
            ..Default::default()
        }
    }

    fn provider_error(action: &str, key: &str, error: GcsError) -> BackendError {
        warn!("Failed to {} GCS object: {}: {:?}", action, key, error);
        gcs_error(
            format!("Failed to {} object '{}': {}", action, key, error),
            &error,
        )
    }
}

enum SessionStatus {
    Incomplete { persisted: u64 },
    Finished(Box<Object>),
}

#[derive(Default)]
struct SessionState {
    persisted: u64,
    /// A request failed in a way that leaves the persisted offset unknown.
    stale: bool,
    object: Option<Object>,
}

impl SessionState {
    fn apply(&mut self, status: SessionStatus) {
        match status {
            SessionStatus::Incomplete { persisted } => self.persisted = persisted,
            SessionStatus::Finished(object) => {
                self.persisted = object.size.max(0) as u64;
                self.object = Some(*object);
            }
        }
    }
}

/// A resumable upload session. The session URI authorizes the upload by itself, so chunks go
/// out through a plain HTTP client that exposes the persisted range on every response.
struct GcsResumableUpload {
    http: reqwest::Client,
    session_url: String,
    key: String,
    content_type: Option<String>,
    state: tokio::sync::Mutex<SessionState>,
}

// `Range: bytes=0-<last>` on a 308 response; absent while nothing is persisted.
fn persisted_bytes(headers: &HeaderMap) -> u64 {
    headers
        .get(RANGE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().strip_prefix("bytes="))
        .and_then(|value| value.split_once('-'))
        .and_then(|(_, last)| last.trim().parse::<u64>().ok())
        .map_or(0, |last| last + 1)
}

impl GcsResumableUpload {
    fn session_error(&self, error: reqwest::Error) -> BackendError {
        let message = format!(
            "Failed to upload to GCS session of '{}': {}",
            self.key, error
        );
        if is_transient_http(&error) {
            BackendError::Retryable(message)
        } else {
            BackendError::Provider(message)
        }
    }

    async fn send(&self, content_range: String, body: Bytes) -> BackendResult<SessionStatus> {
        let response = self
            .http
            .put(&self.session_url)
            .header(CONTENT_RANGE, content_range)
            .header(CONTENT_LENGTH, body.len())
            .body(body)
            .send()
            .await
            .map_err(|e| self.session_error(e))?;

        match response.status().as_u16() {
            308 => Ok(SessionStatus::Incomplete {
                persisted: persisted_bytes(response.headers()),
            }),
            200 | 201 => {
                let object = response
                    .json::<Object>()
                    .await
                    .map_err(|e| self.session_error(e))?;
                Ok(SessionStatus::Finished(Box::new(object)))
            }
            status => {
                let body = response.text().await.unwrap_or_default();
                let message = format!(
                    "GCS rejected upload of '{}' with {}: {}",
                    self.key, status, body
                );
                if is_transient_status(status) {
                    Err(BackendError::Retryable(message))
                } else {
                    Err(BackendError::Provider(message))
                }
            }
        }
    }
}

#[async_trait]
impl MultipartUpload for GcsResumableUpload {
    async fn upload_part(
        &self,
        number: u32,
        offset: u64,
        data: Bytes,
    ) -> BackendResult<PartReceipt> {
        let size = data.len() as u64;
        let end = offset + size;
        let receipt = PartReceipt {
            number,
            offset,
            size,
            etag: None,
        };

        // An unaligned part can only be the last one, so it carries the object size.
        let total = if size.is_multiple_of(GCS_CHUNK_ALIGNMENT) {
            "*".to_string()
        } else {
            end.to_string()
        };

        let mut state = self.state.lock().await;

        if state.stale {
            let status = self.send("bytes */*".to_string(), Bytes::new()).await?;
            state.apply(status);
            state.stale = false;
        }

        for _ in 0..MAX_CHUNK_ROUNDS {
            if state.object.is_some() || state.persisted >= end {
                return Ok(receipt);
            }

            if state.persisted < offset {
                return Err(BackendError::Provider(format!(
                    "GCS session of '{}' holds {} bytes, but part {} starts at {}",
                    self.key, state.persisted, number, offset
                )));
            }

            let start = state.persisted;
            let body = data.slice((start - offset) as usize..);

            state.stale = true;
            let status = self
                .send(format!("bytes {}-{}/{}", start, end - 1, total), body)
                .await?;
            state.apply(status);
            state.stale = false;
        }

        Err(BackendError::Retryable(format!(
            "GCS session of '{}' stopped accepting part {}",
            self.key, number
        )))
    }

    async fn complete(&self, parts: Vec<PartReceipt>) -> BackendResult<ObjectMetadata> {
        let size: u64 = parts.iter().map(|part| part.size).sum();
        let mut state = self.state.lock().await;

        if state.object.is_none() {
            let status = self.send(format!("bytes */{}", size), Bytes::new()).await?;
            state.apply(status);
        }

        match &state.object {
            Some(object) => {
                debug!(
                    "Uploaded object to GCS in {} chunks: {} ({} bytes)",
                    parts.len(),
                    self.key,
                    size
                );
                Ok(GcsBackend::object_to_metadata(
                    object.clone(),
                    self.content_type.clone(),
                ))
            }
            None => Err(BackendError::Provider(format!(
                "GCS session of '{}' holds {} of {} bytes",
                self.key, state.persisted, size
            ))),
        }
    }

    async fn abort(&self) {
        match self
            .http
            .delete(&self.session_url)
            .header(CONTENT_LENGTH, 0)
            .send()
            .await
        {
            Ok(response) if response.status().as_u16() == 499 || response.status().is_success() => {
            }
            Ok(response) => warn!(
                "Failed to cancel GCS upload session of {}: {}",
                self.key,
                response.status()
            ),
            Err(e) => warn!(
                "Failed to cancel GCS upload session of {}: {:?}",
                self.key, e
            ),
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

    fn uploader(&self) -> &Uploader {
        &self.uploader
    }

    fn upload_limits(&self) -> UploadLimits {
        GCS_LIMITS
    }

    async fn put_single(
        &self,
        key: &str,
        data: Bytes,
        opts: &PutOptions,
    ) -> BackendResult<ObjectMetadata> {
        let request = UploadObjectRequest {
            bucket: self.bucket_name.clone(),
            ..Default::default()
        };

        debug!("Uploading object to GCS: {} ({} bytes)", key, data.len());
        let metadata = Self::upload_object_metadata(key, &opts.content_type, &opts.metadata);

        let object = self
            .client
            .upload_object(&request, data, &UploadType::Multipart(Box::new(metadata)))
            .await
            .map_err(|e| Self::provider_error("upload", key, e))?;

        debug!("Uploaded object to GCS: {} ({} bytes)", key, object.size);
        Ok(Self::object_to_metadata(object, opts.content_type.clone()))
    }

    async fn start_multipart(
        &self,
        key: &str,
        opts: &PutOptions,
    ) -> BackendResult<Arc<dyn MultipartUpload>> {
        let request = UploadObjectRequest {
            bucket: self.bucket_name.clone(),
            ..Default::default()
        };
        let metadata = Self::upload_object_metadata(key, &opts.content_type, &opts.metadata);

        let session = self
            .client
            .prepare_resumable_upload(&request, &UploadType::Multipart(Box::new(metadata)))
            .await
            .map_err(|e| Self::provider_error("start upload of", key, e))?;

        Ok(Arc::new(GcsResumableUpload {
            http: self.sessions.clone(),
            session_url: session.url().to_string(),
            key: key.to_string(),
            content_type: opts.content_type.clone(),
            state: tokio::sync::Mutex::default(),
        }))
    }

    async fn put_object_if(
        &self,
        key: &str,
        data: Bytes,
        content_type: Option<String>,
        precondition: WritePrecondition,
    ) -> BackendResult<ObjectMetadata> {
        let generation = match &precondition {
            WritePrecondition::IfAbsent => 0,
            WritePrecondition::IfMatch(etag) => match etag.parse::<i64>() {
                Ok(generation) => generation,
                Err(_) => return Err(BackendError::PreconditionFailed(key.to_string())),
            },
        };

        let request = UploadObjectRequest {
            bucket: self.bucket_name.clone(),
            if_generation_match: Some(generation),
            ..Default::default()
        };

        let metadata = Self::upload_object_metadata(key, &content_type, &HashMap::new());

        match self
            .client
            .upload_object(&request, data, &UploadType::Multipart(Box::new(metadata)))
            .await
        {
            Ok(object) => Ok(Self::object_to_metadata(object, content_type)),
            Err(e) if matches!(status_of(&e), Some(412) | Some(404)) => {
                // A missing object fails an `IfMatch` write with 404 on some servers
                Err(BackendError::PreconditionFailed(key.to_string()))
            }
            Err(e) => Err(Self::provider_error("upload", key, e)),
        }
    }

    async fn get_object(&self, key: &str) -> BackendResult<ObjectData> {
        let request = GetObjectRequest {
            bucket: self.bucket_name.clone(),
            object: key.to_string(),
            ..Default::default()
        };

        // Pinning the download to the generation read here keeps the metadata and the bytes
        // consistent when the object is overwritten in between.
        let object = self.client.get_object(&request).await.map_err(|e| {
            if is_not_found(&e) {
                BackendError::NotFound(key.to_string())
            } else {
                Self::provider_error("read", key, e)
            }
        })?;

        let request = GetObjectRequest {
            generation: Some(object.generation),
            ..request
        };

        let stream = self
            .client
            .download_streamed_object(&request, &Range::default())
            .await
            .map_err(|e| {
                if is_not_found(&e) {
                    BackendError::NotFound(key.to_string())
                } else {
                    Self::provider_error("read", key, e)
                }
            })?;

        debug!("Retrieved object from GCS: {} ({} bytes)", key, object.size);

        let stream: ByteStream = Box::pin(stream.map_err(std::io::Error::other));

        Ok(ObjectData {
            metadata: Self::object_to_metadata(object, None),
            stream,
        })
    }

    async fn get_object_range(
        &self,
        key: &str,
        range: ByteRange,
    ) -> BackendResult<ObjectRangeData> {
        let metadata = self.head_object(key).await?;
        let (start, end) =
            range
                .resolve(metadata.size)
                .ok_or(BackendError::RangeNotSatisfiable {
                    size: metadata.size,
                })?;

        let request = GetObjectRequest {
            bucket: self.bucket_name.clone(),
            object: key.to_string(),
            generation: metadata.etag.parse::<i64>().ok(),
            ..Default::default()
        };

        match self
            .client
            .download_streamed_object(&request, &Range(Some(start), Some(end)))
            .await
        {
            Ok(stream) => {
                debug!(
                    "Retrieved range {}-{} of GCS object: {} ({} bytes)",
                    start,
                    end,
                    key,
                    end - start + 1
                );

                let stream: ByteStream = Box::pin(stream.map_err(std::io::Error::other));

                Ok(ObjectRangeData {
                    metadata,
                    start,
                    end,
                    stream,
                })
            }
            Err(e) => match status_of(&e) {
                Some(404) => Err(BackendError::NotFound(key.to_string())),
                Some(416) => Err(BackendError::RangeNotSatisfiable {
                    size: metadata.size,
                }),
                _ => Err(Self::provider_error("read range of", key, e)),
            },
        }
    }

    async fn head_object(&self, key: &str) -> BackendResult<ObjectMetadata> {
        let request = GetObjectRequest {
            bucket: self.bucket_name.clone(),
            object: key.to_string(),
            ..Default::default()
        };

        match self.client.get_object(&request).await {
            Ok(object) => Ok(Self::object_to_metadata(object, None)),
            Err(e) if is_not_found(&e) => Err(BackendError::NotFound(key.to_string())),
            Err(e) => Err(Self::provider_error("read metadata of", key, e)),
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
            Err(e) if is_not_found(&e) => Ok(()),
            Err(e) => Err(Self::provider_error("delete", key, e)),
        }
    }

    async fn copy_object(&self, source_key: &str, dest_key: &str) -> BackendResult<ObjectMetadata> {
        let request = CopyObjectRequest {
            source_bucket: self.bucket_name.clone(),
            source_object: source_key.to_string(),
            destination_bucket: self.bucket_name.clone(),
            destination_object: dest_key.to_string(),
            ..Default::default()
        };

        match self.client.copy_object(&request).await {
            Ok(object) => {
                debug!("Copied GCS object {} to {}", source_key, dest_key);
                Ok(Self::object_to_metadata(object, None))
            }
            Err(e) if is_not_found(&e) => Err(BackendError::NotFound(source_key.to_string())),
            Err(e) => {
                warn!(
                    "Failed to copy object in GCS: {} -> {}: {:?}",
                    source_key, dest_key, e
                );
                Err(gcs_error(
                    format!(
                        "Failed to copy object '{}' to '{}': {}",
                        source_key, dest_key, e
                    ),
                    &e,
                ))
            }
        }
    }

    async fn list_objects(
        &self,
        prefix: Option<&str>,
        max_keys: Option<usize>,
        continuation_token: Option<&str>,
    ) -> BackendResult<ObjectPage> {
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

        if let Some(token) = continuation_token {
            request.page_token = Some(token.to_string());
        }

        match self.client.list_objects(&request).await {
            Ok(response) => {
                let next_continuation_token = response.next_page_token.clone();
                let objects: Vec<ObjectMetadata> = response
                    .items
                    .unwrap_or_default()
                    .into_iter()
                    .map(|object| Self::object_to_metadata(object, None))
                    .collect();

                debug!(
                    "Listed {} objects from GCS with prefix: {:?}",
                    objects.len(),
                    prefix
                );

                Ok(ObjectPage {
                    objects,
                    next_continuation_token,
                })
            }
            Err(e) if is_not_found(&e) => Err(BackendError::NotFound(format!(
                "bucket:{}",
                self.bucket_name
            ))),
            Err(e) => {
                warn!("Failed to list objects from GCS: {:?}", e);
                Err(gcs_error(format!("Failed to list objects: {}", e), &e))
            }
        }
    }

    async fn get_public_url(
        &self,
        key: &str,
        expiration_secs: u64,
        purpose: PublicUrlPurpose,
    ) -> BackendResult<SignedUrl> {
        let method = match purpose {
            PublicUrlPurpose::Retrieve => SignedURLMethod::GET,
            PublicUrlPurpose::Upload => SignedURLMethod::PUT,
        };

        let mut url_options = SignedURLOptions {
            method,
            expires: std::time::Duration::from_secs(expiration_secs),
            insecure: self.signing_style.insecure,
            ..Default::default()
        };

        if let Some(host) = &self.signing_style.host {
            url_options.style = Box::new(EndpointStyle { host: host.clone() });
        }

        let url = self
            .client
            .signed_url(&self.bucket_name, key, None, None, url_options)
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
        Ok(SignedUrl::new(url))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_endpoints() {
        assert_eq!(
            split_endpoint("http://localhost:4443/").unwrap(),
            ("localhost:4443".to_string(), true)
        );
        assert_eq!(
            split_endpoint("https://storage.example.com").unwrap(),
            ("storage.example.com".to_string(), false)
        );
        assert!(split_endpoint("localhost:4443").is_err());
        assert!(split_endpoint("https://example.com/storage").is_err());
    }

    #[test]
    fn uses_the_generation_as_etag() {
        let metadata = GcsBackend::object_to_metadata(
            Object {
                name: "a".to_string(),
                size: 3,
                generation: 1730000000000001,
                content_type: Some("text/plain".to_string()),
                metadata: Some(HashMap::from([("k".to_string(), "v".to_string())])),
                ..Default::default()
            },
            None,
        );

        assert_eq!(metadata.etag, "1730000000000001");
        assert_eq!(metadata.size, 3);
        assert_eq!(metadata.content_type.as_deref(), Some("text/plain"));
        assert_eq!(
            metadata.custom_metadata.get("k").map(String::as_str),
            Some("v")
        );
    }

    #[test]
    fn reads_the_persisted_range() {
        let mut headers = HeaderMap::new();
        assert_eq!(persisted_bytes(&headers), 0);

        headers.insert(RANGE, "bytes=0-262143".parse().unwrap());
        assert_eq!(persisted_bytes(&headers), 262_144);

        headers.insert(RANGE, "garbage".parse().unwrap());
        assert_eq!(persisted_bytes(&headers), 0);
    }

    #[test]
    fn only_sends_metadata_that_exists() {
        let object = GcsBackend::upload_object_metadata("a", &None, &HashMap::new());
        assert!(object.metadata.is_none());
        assert!(object.content_type.is_none());

        let object = GcsBackend::upload_object_metadata(
            "a",
            &Some("text/plain".to_string()),
            &HashMap::from([("k".to_string(), "v".to_string())]),
        );
        assert_eq!(object.content_type.as_deref(), Some("text/plain"));
        assert_eq!(object.metadata.unwrap().len(), 1);
    }
}
