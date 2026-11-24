use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::header::CONTENT_LENGTH;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, put};
use axum::{Json, Router};
use futures::StreamExt;
use object_store_backends::PublicUrlPurpose;
use serde::Deserialize;
use serde_json::json;
use std::io;
use std::time::Duration;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;

use crate::api::{self, SharedService};
use crate::error::RequestBodyError;
use crate::public::{purpose_name, PublicUrlError};
use crate::public_multipart;

#[derive(Debug, Deserialize)]
pub struct SignedQuery {
    pub expires: Option<i64>,
    pub purpose: Option<String>,
    pub size: Option<u64>,
    pub signature: Option<String>,
}

/// The proxy listener serves signed object URLs and optional encrypted part manifests.
/// The management API stays on the internal listener.
pub fn create_public_router(service: SharedService, request_timeout: Duration) -> Router {
    let mut router = Router::new()
        .route("/health", get(api::health_check))
        .route(
            "/:bucket/*key",
            get(public_get).head(public_head).put(public_put),
        );
    if service.multipart_signer().is_ok() {
        router = router.route("/upload-part", put(public_multipart::put_part));
    }
    router
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
                .layer(TimeoutLayer::new(request_timeout)),
        )
        .with_state(service)
}

fn forbidden(message: &str) -> Response {
    (StatusCode::FORBIDDEN, Json(json!({ "error": message }))).into_response()
}

fn bad_request(message: &str) -> Response {
    (StatusCode::BAD_REQUEST, Json(json!({ "error": message }))).into_response()
}

fn content_length(headers: &HeaderMap) -> Option<u64> {
    headers
        .get(CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse().ok())
}

// HTTP framing already stops a body at its Content-Length; this keeps the signed size the limit
// whatever transport delivered the body.
fn limit_body(body: Body, size: u64) -> Body {
    let mut received = 0u64;
    Body::from_stream(body.into_data_stream().map(move |chunk| {
        let chunk = chunk.map_err(RequestBodyError::from_body)?;
        received += chunk.len() as u64;
        if received > size {
            return Err(RequestBodyError::io(
                io::ErrorKind::InvalidData,
                "upload is larger than its signed size",
            ));
        }
        Ok(chunk)
    }))
}

fn authorize(
    service: &SharedService,
    bucket: &str,
    key: &str,
    purpose: PublicUrlPurpose,
    query: &SignedQuery,
) -> Result<(), &'static str> {
    let Some(signer) = service.public_signer() else {
        return Err("Public URLs are not served by this instance");
    };

    let (Some(expires), Some(signature)) = (query.expires, query.signature.as_deref()) else {
        return Err("Missing signature");
    };

    if query.purpose.as_deref() != Some(purpose_name(purpose)) {
        return Err("This URL does not allow this operation");
    }

    signer
        .verify(
            bucket,
            key,
            purpose,
            expires,
            query.size,
            signature,
            chrono::Utc::now().timestamp(),
        )
        .map_err(|error| match error {
            PublicUrlError::Expired => "URL expired",
            PublicUrlError::InvalidSignature => "Invalid signature",
        })
}

pub async fn public_get(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
    Query(query): Query<SignedQuery>,
    headers: HeaderMap,
) -> Response {
    if let Err(message) = authorize(&service, &bucket, &key, PublicUrlPurpose::Retrieve, &query) {
        return forbidden(message);
    }

    api::get_object(State(service), Path((bucket, key)), headers)
        .await
        .into_response()
}

pub async fn public_head(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
    Query(query): Query<SignedQuery>,
) -> Response {
    if let Err(message) = authorize(&service, &bucket, &key, PublicUrlPurpose::Retrieve, &query) {
        return forbidden(message);
    }

    api::head_object(State(service), Path((bucket, key)))
        .await
        .into_response()
}

pub async fn public_put(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
    Query(query): Query<SignedQuery>,
    headers: HeaderMap,
    body: Body,
) -> Response {
    if let Err(message) = authorize(&service, &bucket, &key, PublicUrlPurpose::Upload, &query) {
        return forbidden(message);
    }

    // Signed uploads carry content only; custom metadata is reserved for the internal API.
    let mut upload_headers = HeaderMap::new();
    if let Some(content_type) = headers.get("content-type") {
        upload_headers.insert("content-type", content_type.clone());
    }

    let body = match query.size {
        Some(size) => {
            if content_length(&headers) != Some(size) {
                return bad_request("The upload must declare exactly the signed size");
            }
            upload_headers.insert(CONTENT_LENGTH, size.into());
            limit_body(body, size)
        }
        None => body,
    };

    let uploaded = api::put_object(
        State(service.clone()),
        Path((bucket.clone(), key.clone())),
        upload_headers,
        body,
    )
    .await;

    if let (Ok(Json(metadata)), Some(size)) = (&uploaded, query.size) {
        if metadata.metadata.size != size {
            let _ = service.delete_object(&bucket, &key).await;
            return bad_request("The upload does not match the signed size");
        }
    }

    match uploaded {
        Ok(Json(metadata)) => {
            let mut response = StatusCode::OK.into_response();
            if let Ok(etag) = format!("\"{}\"", metadata.metadata.etag).parse() {
                response.headers_mut().insert("etag", etag);
            }
            response
        }
        Err(error) => error.into_response(),
    }
}
