use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::header::CACHE_CONTROL;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use bytes::BytesMut;
use futures::StreamExt;
use object_store_backends::multipart::MIB;
use object_store_backends::{
    BackendError, DurablePartRef, DURABLE_MAX_PARTS, DURABLE_MIN_PART_SIZE,
};
use ring::aead::{self, Aad, LessSafeKey, Nonce, UnboundKey};
use ring::rand::{SecureRandom, SystemRandom};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::json;

use crate::api::{ObjectMetadataResponse, SharedService};
use crate::error::{ServiceError, ServiceResult};
use crate::public::PublicUrlSigner;
use crate::service::validate_deletable_object_key;

const MANIFEST_HEADER: &str = "x-metorial-upload-manifest";
const MANIFEST_AAD: &[u8] = b"metorial/object-storage/part-manifest/v1";
const RECEIPT_AAD: &[u8] = b"metorial/object-storage/part-receipt/v1";
const MAX_PART_BYTES: u64 = 75 * MIB;
// The minimum reservation also limits concurrency for short parts.
const MIN_PART_RESERVATION_MIB: u64 = 32;
const MAX_MANIFEST_SECS: u64 = 600;
const MAX_BATCH: usize = 8;
const MAX_TOKEN_LEN: usize = 4096;

#[derive(Deserialize, Serialize)]
struct Part {
    bucket: String,
    key: String,
    upload_id: String,
    number: u32,
    size: u64,
}

#[derive(Deserialize, Serialize)]
struct Manifest {
    part: Part,
    expires_at: i64,
}

#[derive(Deserialize, Serialize)]
struct Receipt {
    part: Part,
    etag: String,
}

fn seal<T: Serialize>(
    signer: &PublicUrlSigner,
    context: &[u8],
    value: &T,
) -> ServiceResult<String> {
    let mut nonce = [0; aead::NONCE_LEN];
    SystemRandom::new()
        .fill(&mut nonce)
        .map_err(|_| ServiceError::Internal("Could not generate an encryption nonce".into()))?;
    let mut bytes = serde_json::to_vec(value)?;
    key(signer)
        .seal_in_place_append_tag(
            Nonce::assume_unique_for_key(nonce),
            Aad::from(context),
            &mut bytes,
        )
        .map_err(|_| ServiceError::Internal("Could not encrypt upload token".into()))?;
    let mut token = nonce.to_vec();
    token.extend(bytes);
    Ok(URL_SAFE_NO_PAD.encode(token))
}

fn open<T: DeserializeOwned>(signer: &PublicUrlSigner, context: &[u8], token: &str) -> Option<T> {
    if token.len() > MAX_TOKEN_LEN {
        return None;
    }

    let mut token = URL_SAFE_NO_PAD.decode(token).ok()?;
    let (nonce, bytes) = token.split_at_mut_checked(aead::NONCE_LEN)?;
    let nonce = Nonce::try_assume_unique_for_key(nonce).ok()?;
    let plaintext = key(signer)
        .open_in_place(nonce, Aad::from(context), bytes)
        .ok()?;
    serde_json::from_slice(plaintext).ok()
}

fn key(signer: &PublicUrlSigner) -> LessSafeKey {
    LessSafeKey::new(
        UnboundKey::new(&aead::AES_256_GCM, &signer.multipart_key()).expect("32-byte key"),
    )
}

fn invalid(message: &str) -> ServiceError {
    BackendError::InvalidRequest(message.into()).into()
}

fn now() -> i64 {
    chrono::Utc::now().timestamp()
}

#[derive(Deserialize)]
pub(crate) struct PartManifestRequest {
    upload_id: String,
    expires_in: u64,
    parts: Vec<PartSpec>,
}

#[derive(Deserialize)]
struct PartSpec {
    number: u32,
    size: u64,
}

#[derive(Serialize)]
pub(crate) struct PartManifestResponse {
    number: u32,
    url: String,
    manifest: String,
}

pub(crate) async fn sign_parts(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
    Json(request): Json<PartManifestRequest>,
) -> ServiceResult<Json<Vec<PartManifestResponse>>> {
    let signer = service.multipart_signer()?;
    validate_deletable_object_key(&key)?;
    if request.parts.is_empty() || request.parts.len() > MAX_BATCH {
        return Err(invalid("Invalid part manifest batch"));
    }

    let expires_at = now() + request.expires_in.clamp(1, MAX_MANIFEST_SECS) as i64;
    let url = signer.part_url();
    let mut response = Vec::with_capacity(request.parts.len());
    for spec in request.parts {
        if spec.number == 0
            || spec.number > DURABLE_MAX_PARTS
            || spec.size == 0
            || spec.size > MAX_PART_BYTES
        {
            return Err(invalid("Invalid part number or byte count"));
        }

        let part = Part {
            bucket: bucket.clone(),
            key: key.clone(),
            upload_id: request.upload_id.clone(),
            number: spec.number,
            size: spec.size,
        };
        let manifest = seal(signer, MANIFEST_AAD, &Manifest { part, expires_at })?;
        response.push(PartManifestResponse {
            number: spec.number,
            url: url.clone(),
            manifest,
        });
    }

    Ok(Json(response))
}

pub(crate) async fn put_part(
    State(service): State<SharedService>,
    headers: HeaderMap,
    body: Body,
) -> Response {
    let Ok(signer) = service.multipart_signer() else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let manifest = headers
        .get(MANIFEST_HEADER)
        .and_then(|header| header.to_str().ok())
        .and_then(|token| open::<Manifest>(signer, MANIFEST_AAD, token));
    let Some(Manifest { part, expires_at }) = manifest else {
        return StatusCode::FORBIDDEN.into_response();
    };
    if expires_at <= now() {
        return StatusCode::FORBIDDEN.into_response();
    }

    let reservation = part.size.div_ceil(MIB).max(MIN_PART_RESERVATION_MIB) as u32;
    let Ok(_permit) = service.public_part_budget.acquire_many(reservation).await else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    if expires_at <= now() {
        return StatusCode::FORBIDDEN.into_response();
    }

    let size = part.size as usize;
    let mut data = BytesMut::with_capacity(size);
    let mut stream = body.into_data_stream();
    while let Some(chunk) = stream.next().await {
        let Ok(chunk) = chunk else {
            return StatusCode::BAD_REQUEST.into_response();
        };
        if chunk.len() > size - data.len() {
            return StatusCode::BAD_REQUEST.into_response();
        }
        data.extend_from_slice(&chunk);
    }
    if data.len() != size {
        return StatusCode::BAD_REQUEST.into_response();
    }

    let result = service
        .upload_public_part(
            &part.bucket,
            &part.key,
            &part.upload_id,
            part.number,
            data.freeze(),
        )
        .await;
    let uploaded = match result {
        Ok(uploaded) if uploaded.number == part.number && uploaded.size == part.size => uploaded,
        Ok(_) => return StatusCode::BAD_GATEWAY.into_response(),
        Err(error) => return error.into_response().status().into_response(),
    };

    match seal(
        signer,
        RECEIPT_AAD,
        &Receipt {
            part,
            etag: uploaded.etag,
        },
    ) {
        Ok(receipt) => (
            [(CACHE_CONTROL, "no-store")],
            Json(json!({ "receipt": receipt })),
        )
            .into_response(),
        Err(error) => error.into_response(),
    }
}

#[derive(Deserialize)]
pub(crate) struct CompletePublicUploadRequest {
    upload_id: String,
    total_size: u64,
    part_size: u64,
    receipts: Vec<String>,
}

pub(crate) async fn complete_public_upload(
    State(service): State<SharedService>,
    Path((bucket, key)): Path<(String, String)>,
    Json(request): Json<CompletePublicUploadRequest>,
) -> ServiceResult<Json<ObjectMetadataResponse>> {
    let signer = service.multipart_signer()?;
    if !(DURABLE_MIN_PART_SIZE..=MAX_PART_BYTES).contains(&request.part_size)
        || request.total_size == 0
    {
        return Err(invalid("Invalid multipart upload size"));
    }

    let count = request.total_size.div_ceil(request.part_size);
    if count > u64::from(DURABLE_MAX_PARTS) || request.receipts.len() as u64 != count {
        return Err(invalid("Expected one receipt for every part"));
    }

    let mut parts = Vec::with_capacity(request.receipts.len());
    for (index, token) in request.receipts.iter().enumerate() {
        let Some(receipt) = open::<Receipt>(signer, RECEIPT_AAD, token) else {
            return Err(invalid("Invalid part receipt"));
        };

        let part = receipt.part;
        let expected_size =
            (request.total_size - index as u64 * request.part_size).min(request.part_size);
        if part.bucket != bucket
            || part.key != key
            || part.upload_id != request.upload_id
            || part.number as usize != index + 1
            || part.size != expected_size
        {
            return Err(invalid("Part receipt does not match the upload"));
        }
        parts.push(DurablePartRef {
            number: part.number,
            etag: receipt.etag,
        });
    }

    let result = service
        .complete_public_multipart(&bucket, &key, &request.upload_id, &parts)
        .await;
    let metadata = match result {
        Err(ServiceError::Backend(BackendError::NotFound(_))) => {
            service.head_object(&bucket, &key).await?
        }
        other => other?,
    };
    if metadata.size != request.total_size {
        return Err(BackendError::Conflict(
            "Completed object size does not match the upload".into(),
        )
        .into());
    }

    Ok(Json(metadata.into()))
}
