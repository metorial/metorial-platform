use std::path::{Path, PathBuf};

use tempfile::TempDir;
use tokio::sync::{Semaphore, SemaphorePermit};

/// Which storage a service process is configured with. Cloud backends run against the emulators
/// `scripts/test-emulators.sh` starts, and are skipped when its variables are not set.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BackendKind {
    Local,
    S3,
    Azure,
    Gcs,
}

pub const LOCAL_PHYSICAL_BUCKET: &str = "store";

pub const EMULATOR_SLOTS: usize = 3;

static S3_SLOTS: Semaphore = Semaphore::const_new(EMULATOR_SLOTS);
static AZURE_SLOTS: Semaphore = Semaphore::const_new(EMULATOR_SLOTS);
static GCS_SLOTS: Semaphore = Semaphore::const_new(EMULATOR_SLOTS);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Turn {
    Shared,
    Exclusive,
}

fn env(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| !value.is_empty())
}

pub fn toml_string(value: &str) -> String {
    serde_json::to_string(value).unwrap()
}

impl BackendKind {
    pub const ALL: [BackendKind; 4] = [
        BackendKind::Local,
        BackendKind::S3,
        BackendKind::Azure,
        BackendKind::Gcs,
    ];

    pub fn name(self) -> &'static str {
        match self {
            BackendKind::Local => "local",
            BackendKind::S3 => "s3",
            BackendKind::Azure => "azure",
            BackendKind::Gcs => "gcs",
        }
    }

    fn missing(self) -> Option<&'static str> {
        let needed = match self {
            BackendKind::Local => return None,
            BackendKind::S3 => "OBJECT_STORE_TEST_S3_ENDPOINT",
            BackendKind::Azure => "OBJECT_STORE_TEST_AZURE_CONNECTION_STRING",
            BackendKind::Gcs => "OBJECT_STORE_TEST_GCS_ENDPOINT",
        };
        env(needed).is_none().then_some(needed)
    }

    pub fn is_available(self) -> bool {
        self.missing().is_none()
    }

    /// Waits until the test may use this backend, or prints why it is skipped and returns `None`.
    /// One emulator serves every test, so at most [`EMULATOR_SLOTS`] share it at once, and a test
    /// asserting lease timing has it to itself; otherwise the emulator's queueing, not the
    /// service, decides whether a three-second lease survives.
    pub async fn take_turn(
        self,
        test: &str,
        turn: Turn,
    ) -> Option<Option<SemaphorePermit<'static>>> {
        if let Some(variable) = self.missing() {
            println!(
                "[e2e] SKIP {test} on {}: {variable} is not set (run scripts/test-emulators.sh)",
                self.name()
            );
            return None;
        }
        let slots = match self {
            BackendKind::Local => return Some(None),
            BackendKind::S3 => &S3_SLOTS,
            BackendKind::Azure => &AZURE_SLOTS,
            BackendKind::Gcs => &GCS_SLOTS,
        };
        let permits = match turn {
            Turn::Shared => 1,
            Turn::Exclusive => EMULATOR_SLOTS as u32,
        };
        Some(Some(slots.acquire_many(permits).await.unwrap()))
    }

    /// Whether conditional writes are atomic across processes, which multi-instance lease tests
    /// need. The local backend's compare-and-swap is only atomic inside one process.
    pub fn has_cross_process_cas(self) -> bool {
        self != BackendKind::Local
    }

    pub fn physical_bucket(self) -> String {
        match self {
            BackendKind::Local => LOCAL_PHYSICAL_BUCKET.to_string(),
            BackendKind::S3 => {
                env("OBJECT_STORE_TEST_S3_BUCKET").unwrap_or_else(|| "conformance".into())
            }
            BackendKind::Azure => {
                env("OBJECT_STORE_TEST_AZURE_CONTAINER").unwrap_or_else(|| "conformance".into())
            }
            BackendKind::Gcs => {
                env("OBJECT_STORE_TEST_GCS_BUCKET").unwrap_or_else(|| "conformance".into())
            }
        }
    }

    pub fn backend_toml(self, data_dir: &Path) -> String {
        let bucket = toml_string(&self.physical_bucket());
        match self {
            BackendKind::Local => format!(
                "type = \"local\"\nroot_path = {}\nphysical_bucket = {bucket}\n",
                toml_string(data_dir.to_str().unwrap())
            ),
            BackendKind::S3 => format!(
                "type = \"s3\"\nregion = \"us-east-1\"\nphysical_bucket = {bucket}\nendpoint = {}\n",
                toml_string(&env("OBJECT_STORE_TEST_S3_ENDPOINT").unwrap())
            ),
            BackendKind::Azure => format!(
                "type = \"azure\"\nphysical_bucket = {bucket}\nconnection_string = {}\n",
                toml_string(&env("OBJECT_STORE_TEST_AZURE_CONNECTION_STRING").unwrap())
            ),
            BackendKind::Gcs => {
                let mut toml = format!(
                    "type = \"gcs\"\nphysical_bucket = {bucket}\nendpoint = {}\n",
                    toml_string(&env("OBJECT_STORE_TEST_GCS_ENDPOINT").unwrap())
                );
                if let Some(credentials) = env("OBJECT_STORE_TEST_GCS_CREDENTIALS") {
                    toml.push_str(&format!("credentials_file = {}\n", toml_string(&credentials)));
                }
                toml
            }
        }
    }
}

/// One storage that any number of service processes can share. For the local backend this is
/// a temporary data directory; cloud backends share the emulator bucket, isolated by unique
/// logical bucket names.
pub struct Storage {
    pub kind: BackendKind,
    root: TempDir,
}

impl Storage {
    pub fn new(kind: BackendKind) -> Storage {
        let root = tempfile::Builder::new()
            .prefix(&format!("e2e-zip-{}-", kind.name()))
            .tempdir()
            .unwrap();
        Storage { kind, root }
    }

    pub fn data_dir(&self) -> PathBuf {
        self.root.path().join("data")
    }

    /// Temporary upload files the local backend still has (`<root>/.uploads`).
    pub fn local_temp_uploads(&self) -> Option<Vec<String>> {
        if self.kind != BackendKind::Local {
            return None;
        }
        let dir = self.data_dir().join(".uploads");
        let Ok(entries) = std::fs::read_dir(&dir) else {
            return Some(Vec::new());
        };
        Some(
            entries
                .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
                .collect(),
        )
    }

    /// The job record file on the local backend.
    pub fn local_job_record(&self, id: &str) -> Option<PathBuf> {
        (self.kind == BackendKind::Local).then(|| {
            self.data_dir()
                .join(LOCAL_PHYSICAL_BUCKET)
                .join(".metadata/zip-jobs")
                .join(format!("{id}.json"))
        })
    }

    /// Every job record file on the local backend.
    pub fn local_job_records(&self) -> Option<Vec<String>> {
        if self.kind != BackendKind::Local {
            return None;
        }
        let dir = self
            .data_dir()
            .join(LOCAL_PHYSICAL_BUCKET)
            .join(".metadata/zip-jobs");
        let Ok(entries) = std::fs::read_dir(&dir) else {
            return Some(Vec::new());
        };
        Some(
            entries
                .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
                .filter(|name| !name.ends_with(".meta.json"))
                .collect(),
        )
    }

    /// Unfinished S3 multipart uploads under `prefix` (a logical bucket and key prefix), read
    /// from the emulator's own `ListMultipartUploads`. `None` when this is not S3 or the
    /// emulator refuses the anonymous request.
    pub async fn s3_pending_multipart_uploads(&self, prefix: &str) -> Option<Vec<String>> {
        if self.kind != BackendKind::S3 {
            return None;
        }
        let endpoint = env("OBJECT_STORE_TEST_S3_ENDPOINT")?;
        let url = format!(
            "{}/{}?uploads&prefix={}",
            endpoint.trim_end_matches('/'),
            self.kind.physical_bucket(),
            prefix
        );
        let response = reqwest::get(&url).await.ok()?;
        if !response.status().is_success() {
            println!(
                "[e2e] note: ListMultipartUploads answered {}",
                response.status()
            );
            return None;
        }
        let body = response.text().await.ok()?;
        Some(
            body.split("<Upload>")
                .skip(1)
                .filter_map(|upload| {
                    let start = upload.find("<Key>")? + 5;
                    let end = upload.find("</Key>")?;
                    Some(upload[start..end].to_string())
                })
                .collect(),
        )
    }

    /// Asserts no upload of `bucket` is left half done: no local temp files, no open S3
    /// multipart uploads. Azure's uncommitted blocks and GCS resumable sessions cannot be
    /// listed through their emulators and expire on their own.
    /// Aborts can finish just after the job's final state is written, so this polls briefly.
    pub async fn assert_no_leftover_uploads(&self, bucket: &str, context: &str) {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
        loop {
            let temp = self.local_temp_uploads().unwrap_or_default();
            let pending = self
                .s3_pending_multipart_uploads(&format!("{bucket}/"))
                .await
                .unwrap_or_default();
            if temp.is_empty() && pending.is_empty() {
                return;
            }
            assert!(
                std::time::Instant::now() < deadline,
                "{context}: uploads left behind: local temp files {temp:?}, S3 multipart {pending:?}"
            );
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }
    }
}
