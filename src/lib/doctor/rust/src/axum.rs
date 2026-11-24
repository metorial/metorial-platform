use axum::body::Body;
use axum::extract::State;
use axum::http::{Method, Response, Uri};
use axum::routing::any;
use axum::Router;

use crate::doctor::Doctor;

/// A router serving `GET /doctor`, ready to merge into the health listener's router.
pub fn router(doctor: Doctor) -> Router {
    Router::new()
        .route("/doctor", any(handler))
        .with_state(doctor)
}

pub async fn handler(State(doctor): State<Doctor>, method: Method, uri: Uri) -> Response<Body> {
    let response = doctor.respond(method.as_str(), uri.query()).await;

    let mut builder = Response::builder().status(response.status);
    for (name, value) in response.headers {
        builder = builder.header(name, value);
    }

    builder
        .body(Body::from(response.body))
        .unwrap_or_else(|_| Response::new(Body::empty()))
}
