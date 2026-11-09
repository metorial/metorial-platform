use axum::body::Body;
use axum::extract::rejection::{PathRejection, QueryRejection};
use axum::extract::{Path, Query, State};
use axum::http::header::{CONTENT_LENGTH, IF_RANGE, RANGE};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use futures::StreamExt;
use object_store_backends::{BackendError, ByteRange, ContentDigests, ObjectMetadata, PutOptions};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use crate::error::{RequestBodyError, ServiceError, ServiceResult};
use crate::metadata::Bucket;
use crate::service::{DigestedObject, ObjectStoreService};
use crate::zip::{JobRequestError, ZipJob, ZipJobManager};

pub type SharedService = Arc<ObjectStoreService>;
pub type SharedJobs = Arc<ZipJobManager>;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBucketRequest {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BucketResponse {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListBucketsResponse {
    pub buckets: Vec<BucketResponse>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ObjectMetadataResponse {
    pub key: String,
    pub size: u64,
    pub content_type: Option<String>,
    pub etag: String,
    pub last_modified: String,
    pub metadata: HashMap<String, String>,
}

/// An object's metadata with the digests of its content. `digests.git_blob_sha1` is null after
/// an upload sent without a Content-Length; the digests route always computes it.
#[derive(Debug, Serialize, Deserialize)]
pub struct DigestedObjectResponse {
    #[serde(flatten)]
    pub metadata: ObjectMetadataResponse,
    pub digests: ContentDigests,
}

impl From<DigestedObject> for DigestedObjectResponse {
    fn from(object: DigestedObject) -> Self {
        Self {
            metadata: object.metadata.into(),
            digests: object.digests,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListObjectsResponse {
    pub objects: Vec<ObjectMetadataResponse>,
    pub next_continuation_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListObjectsQuery {
    pub prefix: Option<String>,
    pub max_keys: Option<usize>,
    pub continuation_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteObjectsRequest {
    pub keys: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CopyObjectRequest {
    pub source_bucket: String,
    pub source_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteObjectResultResponse {
    pub key: String,
    pub deleted: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteObjectsResponse {
    pub results: Vec<DeleteObjectResultResponse>,
    pub deleted: usize,
    pub failed: usize,
}

#[derive(Debug, Deserialize)]
pub struct GetPublicUrlQuery {
    pub expiration_secs: Option<u64>,
    pub purpose: Option<object_store_backends::PublicUrlPurpose>,
}

#[derive(Debug, Deserialize)]
pub struct ZipJobQuery {
    /// Seconds to hold the response while the job is still queued or running.
    pub wait: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct PublicUrlResponse {
    pub url: String,
    pub headers: HashMap<String, String>,
    pub expires_in: u64,
}

impl From<Bucket> for BucketResponse {
    fn from(bucket: Bucket) -> Self {
        Self {
            id: bucket.id,
            name: bucket.name,
            created_at: bucket.created_at,
        }
    }
}

impl From<object_store_backends::ObjectMetadata> for ObjectMetadataResponse {
    fn from(metadata: object_store_backends::ObjectMetadata) -> Self {
        Self {
            key: metadata.key,
            size: metadata.size,
            content_type: metadata.content_type,
            etag: metadata.etag,
            last_modified: metadata.last_modified.to_rfc3339(),
            metadata: metadata.custom_metadata,
        }
    }
}

pub async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "object-store"
    }))
}

pub async fn create_bucket(
    State(service): State<SharedService>,
    Json(payload): Json<CreateBucketRequest>,
) -> ServiceResult<Json<BucketResponse>> {
    let bucket = service.create_bucket(&payload.name).await?;
    Ok(Json(bucket.into()))
}

pub async fn upsert_bucket(
    State(service): State<SharedService>,
    Json(payload): Json<CreateBucketRequest>,
) -> ServiceResult<Json<BucketResponse>> {
    let bucket = service.upsert_bucket(&payload.name).await?;
    Ok(Json(bucket.into()))
}

pub async fn list_buckets(
    State(service): State<SharedService>,
) -> ServiceResult<Json<ListBucketsResponse>> {
    let buckets = service.list_buckets().await?;
    let response = ListBucketsResponse {
        buckets: buckets.into_iter().map(|b| b.into()).collect(),
    };
    Ok(Json(response))
}

pub async fn get_bucket_by_id(
    State(service): State<SharedService>,
    Path(id): Path<String>,
) -> ServiceResult<Json<BucketResponse>> {
    let bucket = service.get_bucket_by_id(&id).await?;
    Ok(Json(bucket.into()))
}

pub async fn delete_bucket(
    State(service): State<SharedService>,
    Path(bucket): Path<String>,
) -> ServiceResult<StatusCode> {
    service.delete_bucket(&bucket).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn put_object(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
    headers: HeaderMap,
    body: Body,
) -> ServiceResult<Json<DigestedObjectResponse>> {
    // Extract content type from headers
    let content_type = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .or_else(|| {
            // Try to guess content type from file extension
            mime_guess::from_path(&key).first().map(|m| m.to_string())
        });

    // Extract custom metadata from headers (x-amz-meta-* pattern)
    let mut metadata = HashMap::new();
    for (header_key, value) in headers.iter() {
        if let Some(meta_key) = header_key.as_str().strip_prefix("x-object-meta-") {
            if let Ok(meta_value) = value.to_str() {
                metadata.insert(meta_key.to_string(), meta_value.to_string());
            }
        }
    }

    // HTTP holds a body to its Content-Length, so it is the exact size, not just a hint.
    let content_length = headers
        .get(CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok());

    let stream: object_store_backends::ByteStream = Box::pin(
        body.into_data_stream()
            .map(|result| result.map_err(RequestBodyError::from_body)),
    );

    let opts = PutOptions {
        content_type,
        metadata,
        size_hint: content_length,
        exact_size: content_length,
    };

    let uploaded = service
        .put_object_stream(&bucket, &key, stream, opts)
        .await?;

    Ok(Json(DigestedObjectResponse {
        metadata: uploaded.metadata.into(),
        digests: uploaded.digests,
    }))
}

pub async fn get_object_digests(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
) -> ServiceResult<Json<DigestedObjectResponse>> {
    let object = service.digest_object(&bucket, &key).await?;
    Ok(Json(object.into()))
}

fn object_headers(metadata: &ObjectMetadata) -> HeaderMap {
    let mut headers = HeaderMap::new();

    if let Some(ct) = &metadata.content_type {
        if let Ok(header_value) = ct.parse() {
            headers.insert("content-type", header_value);
        }
    }

    headers.insert(
        "etag",
        metadata
            .etag
            .parse()
            .unwrap_or_else(|_| "unknown".parse().unwrap()),
    );

    headers.insert(
        "last-modified",
        metadata
            .last_modified
            .to_rfc2822()
            .parse()
            .unwrap_or_else(|_| "unknown".parse().unwrap()),
    );

    headers.insert("accept-ranges", HeaderValue::from_static("bytes"));

    // Add custom metadata as x-object-meta-* headers
    for (key, value) in metadata.custom_metadata.iter() {
        let header_name = format!("x-object-meta-{}", key);
        if let Ok(header_value) = value.parse() {
            if let Ok(header_name) = header_name.parse::<axum::http::HeaderName>() {
                headers.insert(header_name, header_value);
            }
        }
    }

    headers
}

fn content_length_header(length: u64) -> HeaderValue {
    HeaderValue::from_str(&length.to_string()).unwrap_or_else(|_| HeaderValue::from_static("0"))
}

// A malformed, multi-range or non-`bytes` Range header is ignored and the whole object is served
// (RFC 9110 14.2); so is any Range sent together with If-Range, since objects are validated by key.
fn requested_range(headers: &HeaderMap) -> Option<ByteRange> {
    if headers.contains_key(IF_RANGE) {
        return None;
    }

    headers
        .get(RANGE)
        .and_then(|value| value.to_str().ok())
        .and_then(ByteRange::parse_header)
}

pub async fn get_object(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
    request_headers: HeaderMap,
) -> ServiceResult<Response> {
    if let Some(range) = requested_range(&request_headers) {
        return match service.get_object_range(&bucket, &key, range).await {
            Ok(part) => {
                let mut headers = object_headers(&part.metadata);

                headers.insert("content-length", content_length_header(part.len()));
                headers.insert(
                    "content-range",
                    HeaderValue::from_str(&format!(
                        "bytes {}-{}/{}",
                        part.start, part.end, part.metadata.size
                    ))
                    .unwrap_or_else(|_| HeaderValue::from_static("bytes */*")),
                );

                let body = Body::from_stream(part.stream);

                Ok((StatusCode::PARTIAL_CONTENT, headers, body).into_response())
            }
            Err(ServiceError::Backend(BackendError::RangeNotSatisfiable { size })) => {
                let mut headers = HeaderMap::new();

                headers.insert("accept-ranges", HeaderValue::from_static("bytes"));
                headers.insert(
                    "content-range",
                    HeaderValue::from_str(&format!("bytes */{}", size))
                        .unwrap_or_else(|_| HeaderValue::from_static("bytes */*")),
                );

                Ok((StatusCode::RANGE_NOT_SATISFIABLE, headers).into_response())
            }
            Err(error) => Err(error),
        };
    }

    let obj_data = service.get_object(&bucket, &key).await?;

    let mut headers = object_headers(&obj_data.metadata);

    headers.insert(
        "content-length",
        content_length_header(obj_data.metadata.size),
    );

    let body = Body::from_stream(obj_data.stream);

    Ok((headers, body).into_response())
}

pub async fn get_object_info(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
) -> ServiceResult<Json<ObjectMetadataResponse>> {
    let metadata = service.head_object(&bucket, &key).await?;
    Ok(Json(metadata.into()))
}

pub async fn head_object(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
) -> ServiceResult<Response> {
    let metadata = service.head_object(&bucket, &key).await?;

    let mut headers = HeaderMap::new();

    if let Some(ct) = metadata.content_type {
        if let Ok(header_value) = ct.parse() {
            headers.insert("content-type", header_value);
        }
    }

    headers.insert(
        "etag",
        metadata
            .etag
            .parse()
            .unwrap_or_else(|_| "unknown".parse().unwrap()),
    );

    headers.insert(
        "last-modified",
        metadata
            .last_modified
            .to_rfc2822()
            .parse()
            .unwrap_or_else(|_| "unknown".parse().unwrap()),
    );

    headers.insert(
        "content-length",
        metadata
            .size
            .to_string()
            .parse()
            .unwrap_or_else(|_| "0".parse().unwrap()),
    );

    headers.insert("accept-ranges", HeaderValue::from_static("bytes"));

    // Add custom metadata as x-object-meta-* headers
    for (key, value) in metadata.custom_metadata.iter() {
        let header_name = format!("x-object-meta-{}", key);
        if let Ok(header_value) = value.parse() {
            if let Ok(header_name) = header_name.parse::<axum::http::HeaderName>() {
                headers.insert(header_name, header_value);
            }
        }
    }

    Ok((StatusCode::OK, headers).into_response())
}

pub async fn delete_object(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
) -> ServiceResult<StatusCode> {
    service.delete_object(&bucket, &key).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn copy_object(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
    Json(payload): Json<CopyObjectRequest>,
) -> ServiceResult<Json<ObjectMetadataResponse>> {
    let metadata = service
        .copy_object(&payload.source_bucket, &payload.source_key, &bucket, &key)
        .await?;

    Ok(Json(metadata.into()))
}

pub async fn delete_objects(
    State(service): State<SharedService>,
    Path(bucket): Path<String>,
    Json(payload): Json<DeleteObjectsRequest>,
) -> ServiceResult<Json<DeleteObjectsResponse>> {
    let results = service.delete_objects(&bucket, &payload.keys).await?;

    let deleted = results.iter().filter(|r| r.deleted).count();

    Ok(Json(DeleteObjectsResponse {
        failed: results.len() - deleted,
        deleted,
        results: results
            .into_iter()
            .map(|r| DeleteObjectResultResponse {
                key: r.key,
                deleted: r.deleted,
                error: r.error,
            })
            .collect(),
    }))
}

pub async fn list_objects(
    State(service): State<SharedService>,
    Path(bucket): Path<String>,
    Query(params): Query<ListObjectsQuery>,
) -> ServiceResult<Json<ListObjectsResponse>> {
    let page = service
        .list_objects(
            &bucket,
            params.prefix.as_deref(),
            params.max_keys,
            params.continuation_token.as_deref(),
        )
        .await?;

    let response = ListObjectsResponse {
        objects: page.objects.into_iter().map(|o| o.into()).collect(),
        next_continuation_token: page.next_continuation_token,
    };

    Ok(Json(response))
}

pub async fn get_public_url(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
    Query(params): Query<GetPublicUrlQuery>,
) -> ServiceResult<Json<PublicUrlResponse>> {
    // Default expiration is 1 hour (3600 seconds)
    let expiration_secs = params.expiration_secs.unwrap_or(3600);

    // Default purpose is retrieve
    let purpose = params
        .purpose
        .unwrap_or(object_store_backends::PublicUrlPurpose::Retrieve);

    let url = service
        .get_public_url(&bucket, &key, expiration_secs, purpose)
        .await?;

    Ok(Json(PublicUrlResponse {
        url: url.url,
        headers: url.headers,
        expires_in: expiration_secs,
    }))
}

fn zip_job_response(job: ZipJob) -> Response {
    let status = if job.is_active() {
        StatusCode::ACCEPTED
    } else {
        StatusCode::OK
    };
    (status, Json(job)).into_response()
}

fn job_id(path: Result<Path<String>, PathRejection>) -> Result<String, JobRequestError> {
    path.map(|Path(id)| id)
        .map_err(|rejection| JobRequestError::InvalidJobId(rejection.body_text()))
}

fn wait_duration(
    query: Result<Query<ZipJobQuery>, QueryRejection>,
) -> Result<Duration, JobRequestError> {
    let Query(query) =
        query.map_err(|rejection| JobRequestError::InvalidRequest(rejection.body_text()))?;

    match query.wait {
        None => Ok(Duration::ZERO),
        Some(seconds) if seconds.is_finite() && seconds >= 0.0 => {
            Ok(Duration::try_from_secs_f64(seconds).unwrap_or(Duration::MAX))
        }
        Some(seconds) => Err(JobRequestError::InvalidRequest(format!(
            "wait must be a non-negative number of seconds, got {}",
            seconds
        ))),
    }
}

pub async fn missing_zip_job_id() -> JobRequestError {
    JobRequestError::InvalidJobId("the path needs a job id: /zip-jobs/{jobId}".to_string())
}

pub async fn put_zip_job(
    State(jobs): State<SharedJobs>,
    path: Result<Path<String>, PathRejection>,
    query: Result<Query<ZipJobQuery>, QueryRejection>,
    headers: HeaderMap,
    body: Body,
) -> Result<Response, JobRequestError> {
    let id = job_id(path)?;
    crate::zip::validate_job_id(&id).map_err(JobRequestError::InvalidJobId)?;
    let wait = wait_duration(query)?;
    let content_length = headers
        .get(CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok());

    let job = jobs
        .submit_body(&id, content_length, body.into_data_stream(), wait)
        .await?;
    Ok(zip_job_response(job))
}

pub async fn get_zip_job(
    State(jobs): State<SharedJobs>,
    path: Result<Path<String>, PathRejection>,
    query: Result<Query<ZipJobQuery>, QueryRejection>,
) -> Result<Response, JobRequestError> {
    let id = job_id(path)?;
    let wait = wait_duration(query)?;

    let job = jobs.get(&id, wait).await?;
    Ok(zip_job_response(job))
}

pub async fn delete_zip_job(
    State(jobs): State<SharedJobs>,
    path: Result<Path<String>, PathRejection>,
) -> Result<Response, JobRequestError> {
    let id = job_id(path)?;

    let job = jobs.cancel(&id).await?;
    Ok((StatusCode::OK, Json(job)).into_response())
}
