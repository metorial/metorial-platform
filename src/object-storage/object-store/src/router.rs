use axum::body::{Body, BodyDataStream};
use axum::extract::{FromRef, Request};
use axum::middleware;
use axum::routing::{any, delete, get, head, post, put};
use axum::Router;
use futures::StreamExt;
use std::io;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;

use crate::api::*;
use crate::error::RequestBodyError;
use crate::service::ObjectStoreService;
use crate::zip::{ZipJobManager, ZipSettings};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RouterOptions {
    pub request_timeout: Duration,
    pub upload_idle_timeout: Duration,
    /// Zero turns the minimum rate off.
    pub upload_min_bytes_per_sec: u64,
    pub upload_min_rate_grace: Duration,
}

impl RouterOptions {
    pub const DEFAULT: Self = Self {
        request_timeout: Duration::from_secs(60),
        upload_idle_timeout: Duration::from_secs(60),
        upload_min_bytes_per_sec: 16 * 1024,
        upload_min_rate_grace: Duration::from_secs(60),
    };

    fn body_guard(&self) -> BodyGuard {
        BodyGuard {
            idle_timeout: self.upload_idle_timeout,
            min_bytes_per_sec: self.upload_min_bytes_per_sec,
            grace: self.upload_min_rate_grace,
        }
    }
}

impl Default for RouterOptions {
    fn default() -> Self {
        Self::DEFAULT
    }
}

#[derive(Clone)]
pub struct AppState {
    pub service: SharedService,
    pub jobs: SharedJobs,
}

impl FromRef<AppState> for SharedService {
    fn from_ref(state: &AppState) -> Self {
        state.service.clone()
    }
}

impl FromRef<AppState> for SharedJobs {
    fn from_ref(state: &AppState) -> Self {
        state.jobs.clone()
    }
}

pub fn create_router(service: Arc<ObjectStoreService>) -> Router {
    create_router_with_options(service, RouterOptions::default())
}

/// A router with a zip job manager of its own, using the default zip settings.
pub fn create_router_with_options(
    service: Arc<ObjectStoreService>,
    options: RouterOptions,
) -> Router {
    let jobs = ZipJobManager::new(service.clone(), ZipSettings::default());
    create_app_router(service, jobs, options)
}

/// Uploads, copies and digests of large objects can legitimately run for hours, so they are
/// exempt from the request timeout. An upload body that stops sending data is cut off after the idle timeout instead, as
/// is one that keeps sending but falls below the minimum rate, which aborts the upload and
/// releases its share of the upload memory budget.
///
/// Zip job requests keep the request timeout: they wait at most `zip.max_wait`, which the
/// configuration keeps below it. The timeout also bounds how long a spec body that trickles in
/// holds its share of the spec parsing budget; the job manager enforces `max_spec_bytes`.
pub fn create_app_router(
    service: Arc<ObjectStoreService>,
    jobs: Arc<ZipJobManager>,
    options: RouterOptions,
) -> Router {
    let timed = Router::new()
        .route("/health", get(health_check))
        .route("/ping", get(health_check))
        .route("/buckets", post(create_bucket))
        .route("/buckets", put(upsert_bucket))
        .route("/buckets", get(list_buckets))
        .route("/buckets/:bucket", get(get_bucket_by_id))
        .route("/buckets/:bucket", delete(delete_bucket))
        .route("/buckets/:bucket/objects/*key", get(get_object))
        .route("/buckets/:bucket/objects/*key", head(head_object))
        .route("/buckets/:bucket/objects/*key", delete(delete_object))
        .route("/buckets/:bucket/objects", get(list_objects))
        .route("/buckets/:bucket/objects/delete", post(delete_objects))
        .route("/buckets/:bucket/object-info/*key", get(get_object_info))
        .route("/buckets/:bucket/public-url/*key", get(get_public_url))
        .layer(TimeoutLayer::new(options.request_timeout));

    // A wildcard, so ids with a slash reach the handler and are rejected as invalid instead of
    // falling through to a 404.
    let zip_jobs = Router::new()
        .route("/zip-jobs", any(missing_zip_job_id))
        .route("/zip-jobs/", any(missing_zip_job_id))
        .route(
            "/zip-jobs/*job_id",
            put(put_zip_job).get(get_zip_job).delete(delete_zip_job),
        )
        .layer(TimeoutLayer::new(options.request_timeout));

    let guard = options.body_guard();
    let streaming = Router::new()
        .route("/buckets/:bucket/objects/*key", put(put_object))
        .route("/buckets/:bucket/copy-object/*key", post(copy_object))
        .route(
            "/buckets/:bucket/object-digests/*key",
            get(get_object_digests),
        )
        .layer(middleware::map_request(
            move |request: Request| async move { guard.apply(request) },
        ));

    timed
        .merge(zip_jobs)
        .merge(streaming)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive()),
        )
        .with_state(AppState { service, jobs })
}

#[derive(Debug, Clone, Copy)]
struct BodyGuard {
    idle_timeout: Duration,
    min_bytes_per_sec: u64,
    grace: Duration,
}

struct BodyProgress {
    stream: BodyDataStream,
    received: u64,
    waited: Duration,
}

impl BodyGuard {
    /// Only time spent waiting on the client counts against the minimum rate, so an upload held
    /// up by the memory budget or a slow backend is not blamed for it.
    fn allowance(&self, progress: &BodyProgress) -> (Duration, bool) {
        if self.min_bytes_per_sec == 0 {
            return (self.idle_timeout, false);
        }

        let earned =
            Duration::try_from_secs_f64(progress.received as f64 / self.min_bytes_per_sec as f64)
                .unwrap_or(Duration::MAX);
        let rate_allowance = self
            .grace
            .saturating_add(earned)
            .saturating_sub(progress.waited);
        if rate_allowance < self.idle_timeout {
            (rate_allowance, true)
        } else {
            (self.idle_timeout, false)
        }
    }

    fn apply(self, request: Request) -> Request {
        let (parts, body) = request.into_parts();
        let progress = BodyProgress {
            stream: body.into_data_stream(),
            received: 0,
            waited: Duration::ZERO,
        };

        let stream = futures::stream::unfold(Some(progress), move |state| async move {
            let mut progress = state?;
            let (allowance, by_rate) = self.allowance(&progress);

            let started = Instant::now();
            let next = tokio::time::timeout(allowance, progress.stream.next()).await;
            progress.waited = progress.waited.saturating_add(started.elapsed());

            match next {
                Ok(Some(Ok(chunk))) => {
                    progress.received += chunk.len() as u64;
                    Some((Ok(chunk), Some(progress)))
                }
                Ok(Some(Err(error))) => Some((Err(RequestBodyError::from_body(error)), None)),
                Ok(None) => None,
                Err(_) if by_rate => Some((
                    Err(RequestBodyError::io(
                        io::ErrorKind::TimedOut,
                        format!(
                            "request body arrived slower than {} bytes per second",
                            self.min_bytes_per_sec
                        ),
                    )),
                    None,
                )),
                Err(_) => Some((
                    Err(RequestBodyError::io(
                        io::ErrorKind::TimedOut,
                        "request body stalled",
                    )),
                    None,
                )),
            }
        });

        Request::from_parts(parts, Body::from_stream(stream))
    }
}
