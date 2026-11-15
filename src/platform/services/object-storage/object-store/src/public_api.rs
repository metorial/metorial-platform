use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use object_store_backends::PublicUrlPurpose;
use serde::Deserialize;
use serde_json::json;
use std::time::Duration;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;

use crate::api::{self, SharedService};
use crate::public::{purpose_name, PublicUrlError};

#[derive(Debug, Deserialize)]
pub struct SignedQuery {
    pub expires: Option<i64>,
    pub purpose: Option<String>,
    pub signature: Option<String>,
}

/// The listener that serves signed public URLs in proxy mode. It only exposes reading and
/// uploading single objects, and only with a valid signature; the management API stays on the
/// internal listener.
pub fn create_public_router(service: SharedService, request_timeout: Duration) -> Router {
    Router::new()
        .route("/health", get(api::health_check))
        .route(
            "/:bucket/*key",
            get(public_get).head(public_head).put(public_put),
        )
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

    match api::put_object(State(service), Path((bucket, key)), upload_headers, body).await {
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
