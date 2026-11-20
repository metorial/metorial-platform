use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use bytes::Bytes;
use futures::StreamExt;
use lowerdeck_doctor::{
    probes, Category, Check, CheckError, Doctor, Options, Outcome, Resolution, Severity,
};
use object_store_backends::{Backend, BackendError, PutOptions};
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::config::{BackendConfig, Config, PublicUrlMode};

const COMPONENT: &str = "object-storage";
const DOCTOR_PREFIX: &str = ".metorial-doctor";
const ROUND_TRIP_TIMEOUT: Duration = Duration::from_secs(15);
const SLOW_ROUND_TRIP: Duration = Duration::from_millis(500);
const MIN_SIGNING_SECRET_LENGTH: usize = 32;
const DISK_WARN_FREE_RATIO: f64 = 0.10;
const DISK_FAIL_FREE_RATIO: f64 = 0.02;
const DOCS: &str = "datacenter/operations/doctor#object-storage";

pub fn fingerprint(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))[..12].to_string()
}

pub fn create_doctor(config: &Config, backend: Arc<dyn Backend>) -> Doctor {
    let mut options = Options::new(COMPONENT);
    if let Some(secret) = config.public.signing_secret.as_deref() {
        options.fingerprints.insert(
            "object-storage-signing-secret".to_string(),
            fingerprint(secret),
        );
    }

    let doctor = Doctor::new(options);
    for check in checks(config, backend) {
        doctor
            .register(check)
            .expect("object-storage doctor checks have unique, valid ids");
    }

    doctor
}

pub fn checks(config: &Config, backend: Arc<dyn Backend>) -> Vec<Check> {
    let mut checks = vec![
        configured_check(&config.backend),
        bucket_check(&config.backend, backend.clone()),
        round_trip_check(&config.backend, backend.clone()),
        latency_check(),
        multipart_check(backend),
        signing_secret_check(config),
        public_listener_check(config),
    ];

    if let BackendConfig::Local { root_path, .. } = &config.backend {
        checks.push(local_disk_check(root_path.clone()));
    }

    checks
}

fn backend_type(config: &BackendConfig) -> &'static str {
    match config {
        BackendConfig::Local { .. } => "local",
        BackendConfig::S3 { .. } => "s3",
        BackendConfig::Gcs { .. } => "gcs",
        BackendConfig::Azure { .. } => "azure",
    }
}

fn physical_bucket(config: &BackendConfig) -> &str {
    match config {
        BackendConfig::Local {
            physical_bucket, ..
        }
        | BackendConfig::S3 {
            physical_bucket, ..
        }
        | BackendConfig::Gcs {
            physical_bucket, ..
        }
        | BackendConfig::Azure {
            physical_bucket, ..
        } => physical_bucket,
    }
}

fn instance_key() -> String {
    let instance = std::env::var("HOSTNAME")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    format!("{DOCTOR_PREFIX}/{instance}")
}

fn configured_check(config: &BackendConfig) -> Check {
    let kind = backend_type(config);
    let bucket = physical_bucket(config).to_string();
    let endpoint = match config {
        BackendConfig::S3 { endpoint, .. }
        | BackendConfig::Gcs { endpoint, .. }
        | BackendConfig::Azure { endpoint, .. } => endpoint.clone(),
        BackendConfig::Local { .. } => None,
    };

    Check::new(
        "backend.configured",
        "The storage backend is configured",
        Category::Configuration,
        Severity::Critical,
        move |_| {
            let bucket = bucket.clone();
            let endpoint = endpoint.clone();
            async move {
                if bucket.trim().is_empty() {
                    return Ok(
                        Outcome::fail("No physical bucket is configured.").with_resolution(
                            Resolution::new("Set OBJECT_STORE__BACKEND__PHYSICAL_BUCKET.")
                                .docs(DOCS),
                        ),
                    );
                }

                Ok(
                    Outcome::pass(format!("The {kind} backend stores into {bucket}."))
                        .with_details(
                            json!({ "backend": kind, "bucket": bucket, "endpoint": endpoint }),
                        ),
                )
            }
        },
    )
    .target(kind)
}

fn bucket_check(config: &BackendConfig, backend: Arc<dyn Backend>) -> Check {
    let kind = backend_type(config);
    let bucket = physical_bucket(config).to_string();

    Check::new(
        "backend.bucket",
        "The bucket exists and can be listed",
        Category::Storage,
        Severity::Critical,
        move |_| {
            let backend = backend.clone();
            let bucket = bucket.clone();
            async move {
                match backend
                    .list_objects(Some(DOCTOR_PREFIX), Some(1), None)
                    .await
                {
                    Ok(_) => Ok(Outcome::pass(format!("Bucket {bucket} can be listed."))),
                    Err(error) => Ok(backend_failure(
                        kind,
                        &format!("Listing bucket {bucket} failed"),
                        &error,
                    )),
                }
            }
        },
    )
    .target(kind)
    .depends_on(["backend.configured"])
}

fn round_trip_check(config: &BackendConfig, backend: Arc<dyn Backend>) -> Check {
    let kind = backend_type(config);

    Check::new(
        "backend.round-trip",
        "Objects can be written, read and deleted",
        Category::Storage,
        Severity::Critical,
        move |_| {
            let backend = backend.clone();
            async move {
                let key = instance_key();
                let payload = Bytes::from(format!("metorial doctor {}", chrono::Utc::now()));
                let started = Instant::now();

                let result = round_trip(backend.as_ref(), &key, payload).await;
                let latency_ms = started.elapsed().as_millis() as u64;

                Ok(match result {
                    Ok(()) => Outcome::pass(format!("Round trip took {latency_ms}ms."))
                        .with_details(json!({ "latencyMs": latency_ms })),
                    Err((step, error)) => {
                        backend_failure(kind, &format!("The {step} step failed"), &error)
                    }
                })
            }
        },
    )
    .target(kind)
    .timeout(ROUND_TRIP_TIMEOUT)
    .depends_on(["backend.bucket"])
}

async fn round_trip(
    backend: &dyn Backend,
    key: &str,
    payload: Bytes,
) -> Result<(), (&'static str, BackendError)> {
    backend
        .put_single(key, payload.clone(), &PutOptions::default())
        .await
        .map_err(|error| ("put", error))?;

    let result = async {
        backend
            .head_object(key)
            .await
            .map_err(|error| ("head", error))?;

        let mut object = backend
            .get_object(key)
            .await
            .map_err(|error| ("get", error))?;
        let mut read = Vec::new();
        while let Some(chunk) = object.stream.next().await {
            read.extend_from_slice(&chunk.map_err(|error| ("get", BackendError::Io(error)))?);
        }

        if read != payload {
            return Err((
                "get",
                BackendError::Internal("the object read back differs from the one written".into()),
            ));
        }

        Ok(())
    }
    .await;

    let deleted = backend
        .delete_object(key)
        .await
        .map_err(|error| ("delete", error));

    result.and(deleted)
}

fn latency_check() -> Check {
    Check::new(
        "backend.latency",
        "The storage backend answers quickly",
        Category::Storage,
        Severity::Warning,
        |ctx| async move {
            let latency_ms = ctx
                .dependency("backend.round-trip")
                .and_then(|result| result.details.as_ref())
                .and_then(|details| details.get("latencyMs"))
                .and_then(|value| value.as_u64());

            let Some(latency_ms) = latency_ms else {
                return Ok(Outcome::skip("The round trip did not complete."));
            };

            let threshold_ms = SLOW_ROUND_TRIP.as_millis() as u64;
            let details = json!({ "latencyMs": latency_ms, "thresholdMs": threshold_ms });
            if latency_ms > threshold_ms {
                return Ok(Outcome::warn(format!(
                    "A round trip took {latency_ms}ms, slower than {threshold_ms}ms."
                ))
                .with_resolution(
                    Resolution::new(
                        "Check the network path to the storage backend, or move it closer to the cluster.",
                    )
                    .docs(DOCS),
                )
                .with_details(details));
            }

            Ok(Outcome::pass(format!("A round trip took {latency_ms}ms.")).with_details(details))
        },
    )
    .depends_on(["backend.round-trip"])
}

fn multipart_check(backend: Arc<dyn Backend>) -> Check {
    Check::new(
        "backend.multipart",
        "Multipart uploads are supported",
        Category::Storage,
        Severity::Warning,
        move |_| {
            let backend = backend.clone();
            async move {
                let key = format!("{}-multipart", instance_key());
                match backend.start_multipart(&key, &PutOptions::default()).await {
                    Ok(upload) => {
                        upload.abort().await;
                        Ok(Outcome::pass("A multipart upload was started and aborted."))
                    }
                    Err(error) => Ok(Outcome::warn(format!(
                        "Starting a multipart upload failed: {error}"
                    ))
                    .with_resolution(
                        Resolution::new(
                            "Large uploads need multipart support; use a store that implements the S3 multipart API.",
                        )
                        .docs(DOCS),
                    )),
                }
            }
        },
    )
    .depends_on(["backend.round-trip"])
}

fn signing_secret_check(config: &Config) -> Check {
    let proxy = config.public.mode == PublicUrlMode::Proxy;
    let secret = config.public.signing_secret.clone();

    Check::new(
        "signing.secret",
        "The URL signing secret is configured",
        Category::Security,
        Severity::Critical,
        move |_| {
            let secret = secret.clone();
            async move {
                if !proxy {
                    return Ok(Outcome::skip("Public URLs come from the backend."));
                }

                let Some(secret) = secret.filter(|secret| !secret.is_empty()) else {
                    return Ok(
                        Outcome::fail("No signing secret is configured.").with_resolution(
                            Resolution::new("Set OBJECT_STORE__PUBLIC__SIGNING_SECRET.").docs(DOCS),
                        ),
                    );
                };

                let details =
                    json!({ "fingerprint": fingerprint(&secret), "length": secret.len() });
                if secret.len() < MIN_SIGNING_SECRET_LENGTH {
                    return Ok(Outcome::fail(format!(
                        "The signing secret has {} characters, fewer than {MIN_SIGNING_SECRET_LENGTH}.",
                        secret.len()
                    ))
                    .with_resolution(
                        Resolution::new("Use a random secret of at least 32 characters.").docs(DOCS),
                    )
                    .with_details(details));
                }

                Ok(Outcome::pass("The signing secret is configured.").with_details(details))
            }
        },
    )
}

fn public_listener_check(config: &Config) -> Check {
    let proxy = config.public.mode == PublicUrlMode::Proxy;
    let host = match config.public.host.as_str() {
        "0.0.0.0" | "::" | "" => "127.0.0.1".to_string(),
        host => host.to_string(),
    };
    let address = format!("{host}:{}", config.public.port);

    Check::new(
        "public.listener",
        "The public listener accepts connections",
        Category::Runtime,
        Severity::Critical,
        move |_| {
            let address = address.clone();
            async move {
                if !proxy {
                    return Ok(Outcome::skip("Public URLs come from the backend."));
                }

                probes::tcp(&address).await
            }
        },
    )
    .depends_on(["signing.secret"])
}

fn local_disk_check(root: PathBuf) -> Check {
    Check::new(
        "local.disk",
        "The local storage disk has free space",
        Category::Storage,
        Severity::Critical,
        move |_| {
            let root = root.clone();
            async move {
                let (free, total) = disk_space(&root)?;
                let ratio = if total == 0 {
                    0.0
                } else {
                    free as f64 / total as f64
                };
                let percent = (ratio * 1000.0).round() / 10.0;
                let details = json!({ "path": root, "freeBytes": free, "totalBytes": total, "freePercent": percent });
                let resolution =
                    Resolution::new("Grow the volume, or move to an S3-compatible backend.")
                        .docs(DOCS);

                Ok(if ratio < DISK_FAIL_FREE_RATIO {
                    Outcome::fail(format!("Only {percent}% of the storage disk is free."))
                        .with_resolution(resolution)
                        .with_details(details)
                } else if ratio < DISK_WARN_FREE_RATIO {
                    Outcome::warn(format!("Only {percent}% of the storage disk is free."))
                        .with_resolution(resolution)
                        .with_details(details)
                } else {
                    Outcome::pass(format!("{percent}% of the storage disk is free."))
                        .with_details(details)
                })
            }
        },
    )
    .target("local")
}

// statvfs field widths differ per platform, so the casts are needed off Linux.
#[allow(clippy::unnecessary_cast)]
fn disk_space(path: &Path) -> Result<(u64, u64), CheckError> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let path = CString::new(path.as_os_str().as_bytes())?;
    let mut stats: libc::statvfs = unsafe { std::mem::zeroed() };
    if unsafe { libc::statvfs(path.as_ptr(), &mut stats) } != 0 {
        return Err(Box::new(std::io::Error::last_os_error()));
    }

    let block = stats.f_frsize as u64;
    Ok((stats.f_bavail as u64 * block, stats.f_blocks as u64 * block))
}

fn backend_failure(kind: &str, context: &str, error: &BackendError) -> Outcome {
    let message = error.to_string();
    let mut outcome = Outcome::fail(format!("{context}: {message}"));
    if let Some(resolution) = backend_resolution(kind, &message) {
        outcome = outcome.with_resolution(resolution.docs(DOCS));
    }

    outcome.with_details(json!({ "backend": kind }))
}

pub fn backend_resolution(kind: &str, message: &str) -> Option<Resolution> {
    let has = |needle: &str| message.contains(needle);

    let resolution = match kind {
        "s3" if has("NoSuchBucket") => Resolution::new(
            "The bucket does not exist: create it, or set OBJECT_STORE__BACKEND__CREATE_BUCKET=true.",
        ),
        "s3" if has("PermanentRedirect") || has("AuthorizationHeaderMalformed") => {
            Resolution::new("The bucket is in another region: set OBJECT_STORE__BACKEND__REGION to its region.")
        }
        "s3" if has("InvalidAccessKeyId") || has("SignatureDoesNotMatch") => Resolution::new(
            "The access key or secret is wrong: check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
        ),
        "s3" if has("AccessDenied") || has("Forbidden") => Resolution::new(
            "The credentials lack access: allow s3:ListBucket, s3:GetObject, s3:PutObject, s3:DeleteObject and s3:AbortMultipartUpload on the bucket.",
        ),
        "s3" if has("dns error") || has("failed to lookup") => Resolution::new(
            "The endpoint host does not resolve. For MinIO or Ceph also set OBJECT_STORE__BACKEND__FORCE_PATH_STYLE=true.",
        ),
        "s3" if has("certificate") || has("tls") || has("TLS") => Resolution::new(
            "The endpoint's TLS certificate is not trusted: add its CA to the trust bundle, or use the right https endpoint.",
        ),
        "gcs" if has("403") || has("Forbidden") || has("Permission") => Resolution::new(
            "Grant the service account roles/storage.objectAdmin on the bucket (or bind it through Workload Identity).",
        ),
        "gcs" if has("404") => Resolution::new("The bucket does not exist in this project."),
        "azure" if has("AuthorizationPermissionMismatch") || has("AuthorizationFailure") => {
            Resolution::new("Assign the Storage Blob Data Contributor role on the storage account.")
        }
        "azure" if has("ContainerNotFound") => {
            Resolution::new("The container does not exist: create it in the storage account.")
        }
        "local" if has("Permission denied") || has("Read-only") => Resolution::new(
            "The service cannot write to its data directory: check the volume's ownership and that it is mounted read-write.",
        ),
        "local" if has("No space left") => Resolution::new("The data volume is full: grow it."),
        _ if has("Connection refused") || has("connection refused") => {
            Resolution::new("Nothing listens at the storage endpoint: check OBJECT_STORE__BACKEND__ENDPOINT.")
        }
        _ => return None,
    };

    Some(resolution)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fingerprint_is_twelve_hex_characters_of_the_sha256() {
        let value = fingerprint("0123456789abcdef0123456789abcdef");

        assert_eq!(value.len(), 12);
        assert_eq!(
            value,
            hex::encode(Sha256::digest(b"0123456789abcdef0123456789abcdef"))[..12]
        );
    }

    #[test]
    fn resolutions_follow_the_provider_error() {
        let region = backend_resolution("s3", "Provider error: PermanentRedirect").unwrap();
        assert!(region.summary.contains("REGION"));

        let azure = backend_resolution("azure", "AuthorizationPermissionMismatch").unwrap();
        assert!(azure.summary.contains("Storage Blob Data Contributor"));

        assert!(backend_resolution("s3", "something else").is_none());
    }

    #[tokio::test]
    async fn every_check_is_registered() {
        let config = Config {
            backend: BackendConfig::Local {
                root_path: std::env::temp_dir(),
                physical_bucket: "test".into(),
                public_url: None,
            },
            ..Default::default()
        };
        let root = tempfile::tempdir().unwrap();
        let backend: Arc<dyn Backend> = Arc::new(object_store_backends::local::LocalBackend::new(
            root.path().to_path_buf(),
            "test".into(),
        ));
        backend.init().await.unwrap();

        let doctor = create_doctor(&config, backend);
        let report = doctor.run(true).await.unwrap();
        let ids: Vec<_> = report
            .checks
            .iter()
            .map(|check| check.id.as_str())
            .collect();

        assert!(ids.contains(&"backend.round-trip"));
        assert!(ids.contains(&"signing.secret"));
    }
}
