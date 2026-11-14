use async_trait::async_trait;
use chrono::Utc;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Seek, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio_util::io::ReaderStream;
use tracing::{debug, info, warn};

use bytes::Bytes;

use crate::backend::{
    compute_etag, Backend, ByteRange, ByteStream, ObjectData, ObjectMetadata, ObjectPage,
    ObjectRangeData, PublicUrlPurpose, SignedUrl, WritePrecondition,
};
use crate::durable::{
    validate_part_list, validate_part_number, validate_part_size, validate_part_sizes,
    validate_upload_id, DurablePart, DurablePartRef, DurableUpload,
};
use crate::error::{BackendError, BackendResult};
use crate::multipart::{MultipartUpload, PartReceipt, PutOptions, UploadLimits};
use crate::uploader::Uploader;

const UPLOADS_DIR: &str = ".uploads";

/// Object metadata lives in its own tree under the root, at the same relative path as the data,
/// so no key's metadata can be mistaken for, or overwritten by, another key's data.
const METADATA_DIR: &str = ".meta";

/// Earlier versions kept metadata next to the data, as `<key minus extension>.meta.json`.
const LEGACY_METADATA_EXTENSION: &str = "meta.json";

// Several service instances may share one root, so only files no instance can still be writing
// are removed: an upload in progress touches its file every `UPLOAD_TOUCH_INTERVAL`, far more
// often than this.
const STALE_UPLOAD_AGE: Duration = Duration::from_secs(6 * 60 * 60);

const UPLOAD_TOUCH_INTERVAL: Duration = Duration::from_secs(10 * 60);

const DURABLE_DIR: &str = "durable";

const DURABLE_MANIFEST: &str = "manifest.json";

// Providers keep unfinished uploads for about a week as well (Azure drops uncommitted blocks
// after 7 days), so durable uploads behave the same on every backend.
const STALE_DURABLE_UPLOAD_AGE: Duration = Duration::from_secs(7 * 24 * 60 * 60);

const LOCAL_LIMITS: UploadLimits = UploadLimits {
    max_concurrency: 1,
    ..UploadLimits::UNBOUNDED
};

pub struct LocalBackend {
    layout: Layout,
    public_base_url: Option<String>,
    conditional_writes: tokio::sync::Mutex<()>,
    uploader: Arc<Uploader>,
    upload_touch_interval: Duration,
}

fn percent_encode(segment: &str) -> String {
    let mut encoded = String::with_capacity(segment.len());

    for byte in segment.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char)
            }
            _ => encoded.push_str(&format!("%{:02X}", byte)),
        }
    }

    encoded
}

fn blocking_error(error: tokio::task::JoinError) -> BackendError {
    BackendError::Internal(format!("file operation failed: {}", error))
}

/// Where the files of the bucket live under the root.
#[derive(Debug, Clone)]
struct Layout {
    root_path: PathBuf,
    bucket_name: String,
}

impl Layout {
    fn uploads_path(&self) -> PathBuf {
        self.root_path.join(UPLOADS_DIR)
    }

    fn durable_root(&self) -> PathBuf {
        self.uploads_path()
            .join(DURABLE_DIR)
            .join(percent_encode(&self.bucket_name))
    }

    fn durable_path(&self, upload_id: &str) -> BackendResult<PathBuf> {
        validate_upload_id(upload_id)?;
        if !upload_id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(BackendError::NotFound(format!("upload {}", upload_id)));
        }
        Ok(self.durable_root().join(upload_id))
    }

    fn bucket_path(&self) -> PathBuf {
        self.root_path.join(&self.bucket_name)
    }

    fn data_path(&self, key: &str) -> BackendResult<PathBuf> {
        if key.contains("..") || key.starts_with('/') {
            return Err(BackendError::InvalidPath(format!("Invalid key: {}", key)));
        }

        Ok(self.bucket_path().join(key))
    }

    fn object_paths(&self, key: &str) -> BackendResult<ObjectPaths> {
        Ok(ObjectPaths {
            key: key.to_string(),
            data: self.data_path(key)?,
            metadata: self
                .root_path
                .join(METADATA_DIR)
                .join(&self.bucket_name)
                .join(key),
            layout: self.clone(),
        })
    }

    async fn read_metadata(&self, key: &str) -> BackendResult<ObjectMetadata> {
        let paths = self.object_paths(key)?;

        match fs::read(&paths.metadata).await {
            Ok(content) => {
                let metadata: ObjectMetadata = serde_json::from_slice(&content)?;
                return Ok(match fs::metadata(&paths.data).await {
                    Ok(file) if file.is_file() && file.len() != metadata.size => {
                        warn!(
                            "The metadata of {} describes {} bytes but the object holds {}; \
                             using what the file says",
                            key,
                            metadata.size,
                            file.len()
                        );
                        inferred_metadata(key, &file)
                    }
                    _ => metadata,
                });
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }

        if !paths.data.is_file() {
            return Err(BackendError::NotFound(key.to_string()));
        }
        read_legacy_metadata(&paths.legacy_metadata(), key)
            .await
            .ok_or_else(|| BackendError::NotFound(key.to_string()))
    }

    /// The metadata of the object whose old-layout sidecar is the file at `path`, if it is one.
    async fn legacy_owner(&self, path: &Path) -> Option<ObjectMetadata> {
        let content = fs::read(path).await.ok()?;
        let metadata: ObjectMetadata = serde_json::from_slice(&content).ok()?;
        let owner = self.object_paths(&metadata.key).ok()?;

        let owns_it = owner.legacy_metadata() == path
            && owner.data != path
            && owner.data.is_file()
            && !owner.metadata.exists();
        owns_it.then_some(metadata)
    }

    async fn migrate_legacy_metadata_at(&self, path: &Path) -> BackendResult<()> {
        let Some(metadata) = self.legacy_owner(path).await else {
            return Ok(());
        };

        let owner = self.object_paths(&metadata.key)?;
        owner.write_metadata(&metadata).await?;
        info!(
            "Moved the metadata of {} out of the way of a new object",
            metadata.key
        );
        Ok(())
    }
}

/// Where a finished object and its metadata live, and the directory their temporary files are
/// written to before they are renamed into place.
#[derive(Debug, Clone)]
struct ObjectPaths {
    key: String,
    data: PathBuf,
    metadata: PathBuf,
    layout: Layout,
}

impl ObjectPaths {
    fn temp_file(&self) -> PathBuf {
        self.layout
            .uploads_path()
            .join(uuid::Uuid::new_v4().simple().to_string())
    }

    fn legacy_metadata(&self) -> PathBuf {
        self.data.with_extension(LEGACY_METADATA_EXTENSION)
    }

    /// Metadata an earlier version kept at the data path for another object is moved into the
    /// metadata tree before the data replaces it, so that object survives.
    ///
    /// The metadata is written before the data is renamed into place and renamed right after it,
    /// but a crash between the two renames still leaves the new data with the previous object's
    /// metadata, or none. Readers notice the former when the sizes disagree and fall back to what
    /// the file itself says; the latter reads as no object.
    async fn publish(&self, temp: &Path, metadata: &ObjectMetadata) -> BackendResult<()> {
        if let Some(parent) = self.data.parent() {
            fs::create_dir_all(parent).await?;
        }

        let staged = self.stage_metadata(metadata).await?;
        let replaced = async {
            self.layout.migrate_legacy_metadata_at(&self.data).await?;
            fs::rename(temp, &self.data).await?;
            Ok(())
        }
        .await;

        if let Err(e) = replaced {
            remove_if_present(&staged).await;
            return Err(e);
        }
        self.place_metadata(&staged).await?;

        let legacy = self.legacy_metadata();
        if read_legacy_metadata(&legacy, &self.key).await.is_some() {
            remove_if_present(&legacy).await;
        }
        Ok(())
    }

    async fn write_metadata(&self, metadata: &ObjectMetadata) -> BackendResult<()> {
        let staged = self.stage_metadata(metadata).await?;
        self.place_metadata(&staged).await
    }

    async fn stage_metadata(&self, metadata: &ObjectMetadata) -> BackendResult<PathBuf> {
        if let Some(parent) = self.metadata.parent() {
            fs::create_dir_all(parent).await?;
        }

        let temp = self.temp_file();
        let written = async {
            fs::write(&temp, serde_json::to_vec_pretty(metadata)?).await?;
            Ok(())
        }
        .await;

        if let Err(e) = written {
            remove_if_present(&temp).await;
            return Err(e);
        }
        Ok(temp)
    }

    async fn place_metadata(&self, staged: &Path) -> BackendResult<()> {
        if let Err(e) = fs::rename(staged, &self.metadata).await {
            remove_if_present(staged).await;
            return Err(e.into());
        }
        Ok(())
    }
}

/// Metadata for an object whose metadata file can't be trusted. The etag changes whenever the
/// file is rewritten, without reading the file.
fn inferred_metadata(key: &str, file: &std::fs::Metadata) -> ObjectMetadata {
    let modified: chrono::DateTime<Utc> = file.modified().map(Into::into).unwrap_or_default();
    let fingerprint = format!(
        "{}:{}:{}",
        key,
        file.len(),
        modified.timestamp_nanos_opt().unwrap_or_default()
    );

    ObjectMetadata {
        key: key.to_string(),
        size: file.len(),
        content_type: None,
        etag: compute_etag(fingerprint.as_bytes()),
        last_modified: modified,
        custom_metadata: HashMap::new(),
    }
}

/// A sidecar an earlier version wrote, only if it says it belongs to `key`: the old layout
/// mapped `x`, `x.txt` and `x.bin` to the same `x.meta.json`, and that path can also hold an
/// object of its own.
async fn read_legacy_metadata(path: &Path, key: &str) -> Option<ObjectMetadata> {
    let content = fs::read(path).await.ok()?;
    let metadata: ObjectMetadata = serde_json::from_slice(&content).ok()?;
    (metadata.key == key).then_some(metadata)
}

async fn remove_if_present(path: &Path) {
    match fs::remove_file(path).await {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => warn!("Failed to remove temporary upload file {:?}: {}", path, e),
    }
}

async fn remove_existing(path: &Path) -> BackendResult<()> {
    match fs::remove_file(path).await {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

async fn create_temp_file(path: &Path) -> BackendResult<fs::File> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }

    Ok(fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .await?)
}

impl LocalBackend {
    pub fn new(root_path: PathBuf, bucket_name: String) -> Self {
        Self {
            layout: Layout {
                root_path,
                bucket_name,
            },
            public_base_url: None,
            conditional_writes: tokio::sync::Mutex::new(()),
            uploader: Arc::default(),
            upload_touch_interval: UPLOAD_TOUCH_INTERVAL,
        }
    }

    pub fn with_public_base_url(mut self, public_base_url: Option<String>) -> Self {
        self.public_base_url = public_base_url
            .map(|url| url.trim_end_matches('/').to_string())
            .filter(|url| !url.is_empty());
        self
    }

    pub fn with_uploader(mut self, uploader: Arc<Uploader>) -> Self {
        self.uploader = uploader;
        self
    }

    fn object_paths(&self, key: &str) -> BackendResult<ObjectPaths> {
        self.layout.object_paths(key)
    }

    async fn read_metadata(&self, key: &str) -> BackendResult<ObjectMetadata> {
        self.layout.read_metadata(key).await
    }
}

/// Parts are written in place into a temporary file that is renamed over the object on
/// completion, so readers never see a partial object.
struct LocalMultipartUpload {
    file: Arc<Mutex<std::fs::File>>,
    temp_path: PathBuf,
    paths: ObjectPaths,
    key: String,
    content_type: Option<String>,
    custom_metadata: HashMap<String, String>,
    touch: tokio::task::JoinHandle<()>,
}

/// Keeps the file's modification time recent while the upload waits for its next part, so
/// stale upload cleanup never takes it for abandoned.
fn keep_touching(file: Arc<Mutex<std::fs::File>>, every: Duration) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(every).await;
            let file = file.clone();
            let touched = tokio::task::spawn_blocking(move || -> std::io::Result<()> {
                let file = file
                    .lock()
                    .map_err(|_| std::io::Error::other("upload file lock poisoned"))?;
                file.set_modified(SystemTime::now())
            })
            .await;

            if let Ok(Err(e)) = touched {
                warn!("Failed to touch a temporary upload file: {}", e);
            }
        }
    })
}

impl Drop for LocalMultipartUpload {
    fn drop(&mut self) {
        self.touch.abort();
    }
}

#[async_trait]
impl MultipartUpload for LocalMultipartUpload {
    async fn upload_part(
        &self,
        number: u32,
        offset: u64,
        data: Bytes,
    ) -> BackendResult<PartReceipt> {
        let size = data.len() as u64;
        let file = self.file.clone();

        tokio::task::spawn_blocking(move || -> std::io::Result<()> {
            let mut file = file
                .lock()
                .map_err(|_| std::io::Error::other("upload file lock poisoned"))?;
            file.seek(std::io::SeekFrom::Start(offset))?;
            file.write_all(&data)
        })
        .await
        .map_err(blocking_error)??;

        Ok(PartReceipt {
            number,
            offset,
            size,
            etag: None,
        })
    }

    async fn complete(&self, parts: Vec<PartReceipt>) -> BackendResult<ObjectMetadata> {
        self.touch.abort();
        if !fs::try_exists(&self.temp_path).await? {
            return Err(BackendError::NotFound(format!(
                "the upload of '{}' is no longer in progress",
                self.key
            )));
        }
        let size: u64 = parts.iter().map(|part| part.size).sum();
        let file = self.file.clone();

        let written = tokio::task::spawn_blocking(move || -> std::io::Result<u64> {
            let file = file
                .lock()
                .map_err(|_| std::io::Error::other("upload file lock poisoned"))?;
            file.sync_all()?;
            Ok(file.metadata()?.len())
        })
        .await
        .map_err(blocking_error)??;

        if written != size {
            return Err(BackendError::Internal(format!(
                "upload of '{}' wrote {} bytes, expected {}",
                self.key, written, size
            )));
        }

        let metadata = ObjectMetadata {
            key: self.key.clone(),
            size,
            content_type: self.content_type.clone(),
            etag: uuid::Uuid::new_v4().simple().to_string(),
            last_modified: Utc::now(),
            custom_metadata: self.custom_metadata.clone(),
        };

        self.paths.publish(&self.temp_path, &metadata).await?;

        info!(
            "Object stored: {} (etag: {}, {} bytes in {} parts)",
            self.key,
            metadata.etag,
            size,
            parts.len()
        );
        Ok(metadata)
    }

    async fn abort(&self) {
        self.touch.abort();
        remove_if_present(&self.temp_path).await;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DurableManifest {
    key: String,
    initiated: chrono::DateTime<Utc>,
    content_type: Option<String>,
    #[serde(default)]
    metadata: HashMap<String, String>,
}

/// A part is stored as `<number>.<etag>`, so a replacement never overwrites the bytes a
/// completion may be reading, and a completion naming an old etag finds nothing instead of the
/// replacement.
fn part_file_name(number: u32, etag: &str) -> String {
    format!("{}.{}", number, etag)
}

fn parse_part_file_name(name: &str) -> Option<(u32, &str)> {
    let (number, etag) = name.split_once('.')?;
    Some((number.parse().ok()?, etag))
}

async fn read_manifest(dir: &Path, upload_id: &str) -> BackendResult<DurableManifest> {
    match fs::read(dir.join(DURABLE_MANIFEST)).await {
        Ok(bytes) => Ok(serde_json::from_slice(&bytes)?),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Err(BackendError::NotFound(
            format!("upload {} is no longer in progress", upload_id),
        )),
        Err(e) => Err(e.into()),
    }
}

async fn touch(path: &Path) {
    let path = path.to_path_buf();
    let _ = tokio::task::spawn_blocking(move || -> std::io::Result<()> {
        std::fs::OpenOptions::new()
            .write(true)
            .open(&path)?
            .set_modified(SystemTime::now())
    })
    .await;
}

impl LocalBackend {
    async fn durable_upload(&self, key: &str, upload_id: &str) -> BackendResult<PathBuf> {
        let dir = self.layout.durable_path(upload_id)?;
        let manifest = read_manifest(&dir, upload_id).await?;

        if manifest.key != key {
            return Err(BackendError::NotFound(format!(
                "upload {} does not belong to '{}'",
                upload_id, key
            )));
        }
        Ok(dir)
    }

    async fn remove_stale_durable_uploads(&self) -> BackendResult<usize> {
        let root = self.layout.durable_root();
        let mut entries = match fs::read_dir(&root).await {
            Ok(entries) => entries,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(0),
            Err(e) => return Err(e.into()),
        };
        let cutoff = SystemTime::now() - STALE_DURABLE_UPLOAD_AGE;
        let mut removed = 0;

        while let Some(entry) = entries.next_entry().await? {
            let manifest = entry.path().join(DURABLE_MANIFEST);
            let modified = match fs::metadata(&manifest).await {
                Ok(metadata) => metadata.modified().ok(),
                Err(_) => entry.metadata().await.ok().and_then(|m| m.modified().ok()),
            };

            if modified.is_some_and(|modified| modified < cutoff) {
                let _ = fs::remove_dir_all(entry.path()).await;
                removed += 1;
            }
        }
        Ok(removed)
    }
}

#[async_trait]
impl Backend for LocalBackend {
    async fn init(&self) -> BackendResult<()> {
        let components: Vec<_> = Path::new(&self.layout.bucket_name).components().collect();
        let inside_root = !components.is_empty()
            && components
                .iter()
                .all(|component| matches!(component, Component::Normal(_)));
        let reserved = components.first().is_some_and(|first| {
            [UPLOADS_DIR, METADATA_DIR]
                .iter()
                .any(|dir| first.as_os_str() == *dir)
        });

        if !inside_root {
            return Err(BackendError::Configuration(format!(
                "The local bucket name '{}' must be a relative path inside the root",
                self.layout.bucket_name
            )));
        }
        if reserved {
            return Err(BackendError::Configuration(format!(
                "The local backend keeps its own files in '{}'; choose another bucket name",
                self.layout.bucket_name
            )));
        }

        let bucket_path = self.layout.bucket_path();
        fs::create_dir_all(&bucket_path).await?;
        fs::create_dir_all(self.layout.uploads_path()).await?;
        self.remove_stale_uploads().await?;
        info!("Initialized local backend at {:?}", bucket_path);
        Ok(())
    }

    async fn remove_stale_uploads(&self) -> BackendResult<()> {
        let mut entries = fs::read_dir(self.layout.uploads_path()).await?;
        let cutoff = SystemTime::now() - STALE_UPLOAD_AGE;
        let mut removed = 0;

        while let Some(entry) = entries.next_entry().await? {
            let Ok(metadata) = entry.metadata().await else {
                continue;
            };

            let stale =
                metadata.is_file() && metadata.modified().is_ok_and(|modified| modified < cutoff);

            if stale {
                remove_if_present(&entry.path()).await;
                removed += 1;
            }
        }

        if removed > 0 {
            info!("Removed {} stale temporary upload files", removed);
        }

        let durable = self.remove_stale_durable_uploads().await?;
        if durable > 0 {
            info!("Removed {} stale durable uploads", durable);
        }
        Ok(())
    }

    fn backend_name(&self) -> &'static str {
        "local"
    }

    async fn start_durable_multipart(&self, key: &str, opts: &PutOptions) -> BackendResult<String> {
        self.layout.data_path(key)?;

        let upload_id = uuid::Uuid::new_v4().simple().to_string();
        let dir = self.layout.durable_path(&upload_id)?;
        fs::create_dir_all(&dir).await?;

        let manifest = DurableManifest {
            key: key.to_string(),
            initiated: Utc::now(),
            content_type: opts.content_type.clone(),
            metadata: opts.metadata.clone(),
        };
        let temp = dir.join(format!("{}.tmp", DURABLE_MANIFEST));
        fs::write(&temp, serde_json::to_vec(&manifest)?).await?;
        fs::rename(&temp, dir.join(DURABLE_MANIFEST)).await?;

        debug!("Started durable upload {} of {}", upload_id, key);
        Ok(upload_id)
    }

    async fn upload_durable_part(
        &self,
        key: &str,
        upload_id: &str,
        number: u32,
        data: Bytes,
    ) -> BackendResult<DurablePart> {
        validate_part_number(number)?;
        validate_part_size(data.len() as u64)?;
        let dir = self.durable_upload(key, upload_id).await?;

        let size = data.len() as u64;
        let etag = compute_etag(&data);
        let temp = dir.join(format!("{}.tmp", uuid::Uuid::new_v4().simple()));
        fs::write(&temp, &data).await?;
        fs::rename(&temp, dir.join(part_file_name(number, &etag))).await?;

        let mut entries = fs::read_dir(&dir).await?;
        while let Some(entry) = entries.next_entry().await? {
            let name = entry.file_name();
            let Some((other, other_etag)) = name.to_str().and_then(parse_part_file_name) else {
                continue;
            };
            if other == number && other_etag != etag && other_etag != "tmp" {
                remove_if_present(&entry.path()).await;
            }
        }
        touch(&dir.join(DURABLE_MANIFEST)).await;

        Ok(DurablePart { number, size, etag })
    }

    async fn complete_durable_multipart(
        &self,
        key: &str,
        upload_id: &str,
        parts: &[DurablePartRef],
    ) -> BackendResult<ObjectMetadata> {
        validate_part_list(parts)?;
        let dir = self.durable_upload(key, upload_id).await?;
        let manifest = read_manifest(&dir, upload_id).await?;

        let mut files = Vec::with_capacity(parts.len());
        let mut sizes = Vec::with_capacity(parts.len());
        for part in parts {
            let path = dir.join(part_file_name(part.number, &part.etag));
            match fs::metadata(&path).await {
                Ok(metadata) => sizes.push(metadata.len()),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                    return Err(BackendError::InvalidRequest(format!(
                        "part {} with etag {} was not uploaded or has been replaced",
                        part.number, part.etag
                    )))
                }
                Err(e) => return Err(e.into()),
            }
            files.push(path);
        }
        validate_part_sizes(&sizes)?;

        let paths = self.object_paths(key)?;
        let temp_path = paths.temp_file();
        let mut output = create_temp_file(&temp_path).await?;
        let copied = async {
            for file in &files {
                let mut input = fs::File::open(file).await?;
                tokio::io::copy(&mut input, &mut output).await?;
            }
            output.sync_all().await?;
            Ok::<_, BackendError>(())
        }
        .await;
        drop(output);

        if let Err(e) = copied {
            remove_if_present(&temp_path).await;
            return Err(e);
        }

        let metadata = ObjectMetadata {
            key: key.to_string(),
            size: sizes.iter().sum(),
            content_type: manifest.content_type,
            etag: uuid::Uuid::new_v4().simple().to_string(),
            last_modified: Utc::now(),
            custom_metadata: manifest.metadata,
        };

        if let Err(e) = paths.publish(&temp_path, &metadata).await {
            remove_if_present(&temp_path).await;
            return Err(e);
        }
        let _ = fs::remove_dir_all(&dir).await;

        info!(
            "Object stored: {} ({} bytes in {} durable parts)",
            key,
            metadata.size,
            parts.len()
        );
        Ok(metadata)
    }

    async fn abort_durable_multipart(&self, key: &str, upload_id: &str) -> BackendResult<()> {
        match self.durable_upload(key, upload_id).await {
            Ok(dir) => {
                fs::remove_dir_all(&dir).await?;
                Ok(())
            }
            Err(BackendError::NotFound(_)) => Ok(()),
            Err(e) => Err(e),
        }
    }

    async fn list_durable_multiparts(&self, prefix: &str) -> BackendResult<Vec<DurableUpload>> {
        let mut entries = match fs::read_dir(self.layout.durable_root()).await {
            Ok(entries) => entries,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(e.into()),
        };
        let mut uploads = Vec::new();

        while let Some(entry) = entries.next_entry().await? {
            let Some(upload_id) = entry.file_name().to_str().map(str::to_string) else {
                continue;
            };
            let Ok(manifest) = read_manifest(&entry.path(), &upload_id).await else {
                continue;
            };
            if manifest.key.starts_with(prefix) {
                uploads.push(DurableUpload {
                    key: manifest.key,
                    upload_id,
                    initiated: Some(manifest.initiated),
                });
            }
        }

        uploads.sort_by(|a, b| a.initiated.cmp(&b.initiated));
        Ok(uploads)
    }

    fn uploader(&self) -> &Uploader {
        &self.uploader
    }

    fn upload_limits(&self) -> UploadLimits {
        LOCAL_LIMITS
    }

    async fn put_single(
        &self,
        key: &str,
        data: Bytes,
        opts: &PutOptions,
    ) -> BackendResult<ObjectMetadata> {
        debug!("Putting object: {}", key);

        let paths = self.object_paths(key)?;
        let temp = paths.temp_file();

        let metadata = ObjectMetadata {
            key: key.to_string(),
            size: data.len() as u64,
            content_type: opts.content_type.clone(),
            etag: compute_etag(&data),
            last_modified: Utc::now(),
            custom_metadata: opts.metadata.clone(),
        };

        let written = async {
            let mut file = create_temp_file(&temp).await?;
            file.write_all(&data).await?;
            file.sync_all().await?;
            drop(file);
            paths.publish(&temp, &metadata).await
        }
        .await;

        if let Err(e) = written {
            remove_if_present(&temp).await;
            return Err(e);
        }

        info!(
            "Object stored: {} (etag: {}, {} bytes)",
            key, metadata.etag, metadata.size
        );
        Ok(metadata)
    }

    async fn start_multipart(
        &self,
        key: &str,
        opts: &PutOptions,
    ) -> BackendResult<Arc<dyn MultipartUpload>> {
        let paths = self.object_paths(key)?;
        let temp_path = paths.temp_file();
        let file = Arc::new(Mutex::new(
            create_temp_file(&temp_path).await?.into_std().await,
        ));

        Ok(Arc::new(LocalMultipartUpload {
            touch: keep_touching(file.clone(), self.upload_touch_interval),
            file,
            temp_path,
            paths,
            key: key.to_string(),
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
        let _guard = self.conditional_writes.lock().await;

        let current = match self.head_object(key).await {
            Ok(metadata) => Some(metadata),
            Err(BackendError::NotFound(_)) => None,
            Err(e) => return Err(e),
        };

        let satisfied = match (&precondition, &current) {
            (WritePrecondition::IfAbsent, None) => true,
            (WritePrecondition::IfMatch(etag), Some(current)) => &current.etag == etag,
            _ => false,
        };

        if !satisfied {
            return Err(BackendError::PreconditionFailed(key.to_string()));
        }

        let opts = PutOptions {
            content_type,
            ..Default::default()
        };
        self.put_single(key, data, &opts).await
    }

    async fn get_object(&self, key: &str) -> BackendResult<ObjectData> {
        debug!("Getting object: {}", key);

        let object_path = self.layout.data_path(key)?;

        if !object_path.exists() {
            return Err(BackendError::NotFound(key.to_string()));
        }

        let file = fs::File::open(&object_path).await?;
        let metadata = self.read_metadata(key).await?;

        // Convert file to stream
        let stream: ByteStream =
            Box::pin(ReaderStream::new(file).map(|result| result.map_err(std::io::Error::other)));

        Ok(ObjectData { metadata, stream })
    }

    async fn get_object_range(
        &self,
        key: &str,
        range: ByteRange,
    ) -> BackendResult<ObjectRangeData> {
        debug!("Getting object range: {} {:?}", key, range);

        let object_path = self.layout.data_path(key)?;

        if !object_path.exists() {
            return Err(BackendError::NotFound(key.to_string()));
        }

        let metadata = self.read_metadata(key).await?;
        let (start, end) =
            range
                .resolve(metadata.size)
                .ok_or(BackendError::RangeNotSatisfiable {
                    size: metadata.size,
                })?;

        let mut file = fs::File::open(&object_path).await?;
        file.seek(std::io::SeekFrom::Start(start)).await?;

        let stream: ByteStream = Box::pin(
            ReaderStream::new(file.take(end - start + 1))
                .map(|result| result.map_err(std::io::Error::other)),
        );

        Ok(ObjectRangeData {
            metadata,
            start,
            end,
            stream,
        })
    }

    async fn head_object(&self, key: &str) -> BackendResult<ObjectMetadata> {
        debug!("Getting object metadata: {}", key);
        self.read_metadata(key).await
    }

    async fn copy_object(&self, source_key: &str, dest_key: &str) -> BackendResult<ObjectMetadata> {
        debug!("Copying object: {} -> {}", source_key, dest_key);

        let source_path = self.layout.data_path(source_key)?;
        if !source_path.exists() {
            return Err(BackendError::NotFound(source_key.to_string()));
        }

        let source_metadata = self.read_metadata(source_key).await?;
        let metadata = ObjectMetadata {
            key: dest_key.to_string(),
            last_modified: Utc::now(),
            ..source_metadata
        };

        let paths = self.object_paths(dest_key)?;
        let temp = paths.temp_file();

        let copied = async {
            drop(create_temp_file(&temp).await?);
            fs::copy(&source_path, &temp).await?;
            paths.publish(&temp, &metadata).await
        }
        .await;

        if let Err(e) = copied {
            remove_if_present(&temp).await;
            return Err(e);
        }

        info!("Object copied: {} -> {}", source_key, dest_key);
        Ok(metadata)
    }

    /// The metadata goes first, so a failure part way leaves no object behind, just a data file
    /// nothing refers to. A data file that is really another object's old-layout sidecar stays.
    async fn delete_object(&self, key: &str) -> BackendResult<()> {
        debug!("Deleting object: {}", key);

        let paths = self.object_paths(key)?;

        remove_existing(&paths.metadata).await?;
        if read_legacy_metadata(&paths.legacy_metadata(), key)
            .await
            .is_some()
        {
            remove_existing(&paths.legacy_metadata()).await?;
        }

        if self.layout.legacy_owner(&paths.data).await.is_none() {
            remove_existing(&paths.data).await?;
        }

        info!("Object deleted: {}", key);
        Ok(())
    }

    async fn list_objects(
        &self,
        prefix: Option<&str>,
        max_keys: Option<usize>,
        continuation_token: Option<&str>,
    ) -> BackendResult<ObjectPage> {
        debug!("Listing objects with prefix: {:?}", prefix);

        let bucket_path = self.layout.bucket_path();

        let prefix_str = prefix.unwrap_or("");
        if self.layout.data_path(prefix_str).is_err() {
            return Ok(ObjectPage {
                objects: Vec::new(),
                next_continuation_token: None,
            });
        }

        let search_path = if prefix_str.is_empty() {
            bucket_path.clone()
        } else {
            let candidate = bucket_path.join(prefix_str);
            if candidate.is_dir() {
                candidate
            } else {
                candidate.parent().unwrap_or(&bucket_path).to_path_buf()
            }
        };

        let mut keys = Vec::new();
        Self::collect_keys(&bucket_path, &search_path, prefix_str, &mut keys).await?;

        keys.sort();

        if let Some(token) = continuation_token {
            let start = keys.partition_point(|key| key.as_str() <= token);
            keys.drain(..start);
        }

        let next_continuation_token = match max_keys {
            Some(max) if keys.len() > max => {
                keys.truncate(max);
                keys.last().cloned()
            }
            _ => None,
        };

        let mut objects = Vec::with_capacity(keys.len());
        for key in keys {
            if let Ok(metadata) = self.read_metadata(&key).await {
                objects.push(metadata);
            }
        }

        Ok(ObjectPage {
            objects,
            next_continuation_token,
        })
    }

    async fn get_public_url(
        &self,
        key: &str,
        _expiration_secs: u64,
        _purpose: PublicUrlPurpose,
    ) -> BackendResult<SignedUrl> {
        let Some(base_url) = &self.public_base_url else {
            return Err(BackendError::Provider(
                "Public URL generation requires a public_url for the local backend".to_string(),
            ));
        };

        let (bucket, object_key) = key
            .split_once('/')
            .ok_or_else(|| BackendError::InvalidPath(format!("Invalid key: {}", key)))?;

        Ok(SignedUrl::new(format!(
            "{}/buckets/{}/objects/{}",
            base_url,
            percent_encode(bucket),
            object_key
                .split('/')
                .map(percent_encode)
                .collect::<Vec<_>>()
                .join("/")
        )))
    }
}

impl LocalBackend {
    /// Walks only the bucket's own directory, which `init` keeps clear of the root's upload and
    /// metadata trees.
    fn collect_keys<'a>(
        bucket_path: &'a Path,
        current_path: &'a Path,
        prefix: &'a str,
        keys: &'a mut Vec<String>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = BackendResult<()>> + Send + 'a>> {
        Box::pin(async move {
            if !current_path.exists() {
                return Ok(());
            }

            if current_path.is_file() {
                Self::push_key(bucket_path, current_path, prefix, keys);
                return Ok(());
            }

            let mut entries = fs::read_dir(current_path).await?;
            while let Some(entry) = entries.next_entry().await? {
                let path = entry.path();

                if path.is_dir() {
                    Self::collect_keys(bucket_path, &path, prefix, keys).await?;
                } else {
                    Self::push_key(bucket_path, &path, prefix, keys);
                }
            }

            Ok(())
        })
    }

    /// Every file is a candidate; files without metadata, like old-layout sidecars, are dropped
    /// when the page reads the metadata of its keys.
    fn push_key(bucket_path: &Path, path: &Path, prefix: &str, keys: &mut Vec<String>) {
        let Ok(relative) = path.strip_prefix(bucket_path) else {
            return;
        };

        let key = relative.to_string_lossy().to_string();
        if key.starts_with(prefix) {
            keys.push(key);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytes::Bytes;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_local_backend_put_get() {
        use futures::stream;

        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "test-bucket".to_string());

        backend.init().await.unwrap();

        let data = b"Hello, World!".to_vec();
        let data_clone = data.clone();

        // Create a stream from the data
        let stream: ByteStream = Box::pin(stream::iter(vec![Ok(Bytes::from(data.clone()))]));

        let metadata = backend
            .put_object(
                "test.txt",
                stream,
                Some("text/plain".to_string()),
                HashMap::new(),
            )
            .await
            .unwrap();

        assert_eq!(metadata.key, "test.txt");
        assert_eq!(metadata.size, 13);

        let mut obj = backend.get_object("test.txt").await.unwrap();

        // Collect stream back to Vec<u8>
        let mut collected = Vec::new();
        while let Some(chunk) = obj.stream.next().await {
            collected.extend_from_slice(&chunk.unwrap());
        }
        assert_eq!(collected, data_clone);
    }

    #[tokio::test]
    async fn test_local_backend_delete() {
        use futures::stream;

        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "test-bucket".to_string());

        backend.init().await.unwrap();

        let data = b"Hello, World!".to_vec();
        let stream: ByteStream = Box::pin(stream::iter(vec![Ok(Bytes::from(data))]));

        backend
            .put_object(
                "test.txt",
                stream,
                Some("text/plain".to_string()),
                HashMap::new(),
            )
            .await
            .unwrap();

        backend.delete_object("test.txt").await.unwrap();

        let result = backend.get_object("test.txt").await;
        assert!(matches!(result, Err(BackendError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_path_traversal_prevention() {
        use futures::stream;

        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "test-bucket".to_string());

        backend.init().await.unwrap();

        let stream: ByteStream = Box::pin(stream::iter(vec![Ok(Bytes::from(vec![1, 2, 3]))]));

        let result = backend
            .put_object("../etc/passwd", stream, None, HashMap::new())
            .await;
        assert!(matches!(result, Err(BackendError::InvalidPath(_))));
    }

    #[tokio::test]
    async fn test_public_url() {
        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "test-bucket".to_string())
            .with_public_base_url(Some("http://localhost:35010/".to_string()));

        let url = backend
            .get_public_url("files/a b/c.txt", 60, PublicUrlPurpose::Retrieve)
            .await
            .unwrap();

        assert_eq!(
            url.url,
            "http://localhost:35010/buckets/files/objects/a%20b/c.txt"
        );
        assert!(url.headers.is_empty());
    }

    #[tokio::test]
    async fn test_public_url_without_base_url() {
        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "test-bucket".to_string());

        assert!(backend
            .get_public_url("files/a.txt", 60, PublicUrlPurpose::Upload)
            .await
            .is_err());
    }

    fn small_parts(root: &Path) -> LocalBackend {
        let uploader = Uploader::new(crate::uploader::UploadSettings {
            single_request_threshold: 1024,
            min_part_size: 1024,
            ..Default::default()
        });
        LocalBackend::new(root.to_path_buf(), "bucket".to_string())
            .with_uploader(Arc::new(uploader))
    }

    fn chunks(data: &[u8], fail: bool) -> ByteStream {
        let mut items: Vec<Result<Bytes, std::io::Error>> = data
            .chunks(700)
            .map(|c| Ok(Bytes::copy_from_slice(c)))
            .collect();
        if fail {
            items.push(Err(std::io::Error::other("client went away")));
        }
        Box::pin(futures::stream::iter(items))
    }

    async fn read(backend: &LocalBackend, key: &str) -> Vec<u8> {
        let mut object = backend.get_object(key).await.unwrap();
        let mut data = Vec::new();
        while let Some(chunk) = object.stream.next().await {
            data.extend_from_slice(&chunk.unwrap());
        }
        data
    }

    fn temp_files(root: &Path) -> Vec<PathBuf> {
        std::fs::read_dir(root.join(UPLOADS_DIR))
            .map(|entries| entries.map(|e| e.unwrap().path()).collect())
            .unwrap_or_default()
    }

    #[tokio::test]
    async fn writes_multipart_uploads_atomically() {
        let temp_dir = TempDir::new().unwrap();
        let backend = small_parts(temp_dir.path());
        backend.init().await.unwrap();

        let data: Vec<u8> = (0..20_000u32).map(|i| (i % 251) as u8).collect();
        let opts = PutOptions {
            content_type: Some("application/octet-stream".to_string()),
            metadata: HashMap::from([("k".to_string(), "v".to_string())]),
            ..Default::default()
        };

        let uploaded = backend
            .put_object_stream("dir/multi.bin", chunks(&data, false), opts)
            .await
            .unwrap();

        assert_eq!(uploaded.metadata.size, data.len() as u64);
        assert_eq!(read(&backend, "dir/multi.bin").await, data);

        let head = backend.head_object("dir/multi.bin").await.unwrap();
        assert_eq!(head.etag, uploaded.metadata.etag);
        assert_eq!(head.custom_metadata["k"], "v");
        assert!(temp_files(temp_dir.path()).is_empty());
    }

    #[tokio::test]
    async fn failed_uploads_leave_no_trace() {
        let temp_dir = TempDir::new().unwrap();
        let backend = small_parts(temp_dir.path());
        backend.init().await.unwrap();

        let data: Vec<u8> = (0..20_000u32).map(|i| (i % 13) as u8).collect();

        backend
            .put_object_stream("new.bin", chunks(&data, true), PutOptions::default())
            .await
            .unwrap_err();
        assert!(matches!(
            backend.head_object("new.bin").await,
            Err(BackendError::NotFound(_))
        ));
        assert!(!temp_dir.path().join("bucket/new.bin").exists());

        backend
            .put_object_stream(
                "kept.bin",
                chunks(b"original", false),
                PutOptions::default(),
            )
            .await
            .unwrap();
        backend
            .put_object_stream("kept.bin", chunks(&data, true), PutOptions::default())
            .await
            .unwrap_err();
        assert_eq!(read(&backend, "kept.bin").await, b"original");

        assert!(temp_files(temp_dir.path()).is_empty());
    }

    #[tokio::test]
    async fn removes_only_stale_temporary_files_on_init() {
        let temp_dir = TempDir::new().unwrap();
        let uploads = temp_dir.path().join(UPLOADS_DIR);
        std::fs::create_dir_all(&uploads).unwrap();

        let stale = uploads.join("stale");
        let fresh = uploads.join("fresh");
        std::fs::write(&stale, b"abandoned").unwrap();
        std::fs::write(&fresh, b"in progress elsewhere").unwrap();
        std::fs::File::options()
            .write(true)
            .open(&stale)
            .unwrap()
            .set_modified(SystemTime::now() - STALE_UPLOAD_AGE - Duration::from_secs(60))
            .unwrap();

        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "bucket".to_string());
        backend.init().await.unwrap();

        assert!(!stale.exists());
        assert!(fresh.exists());
    }

    fn age(path: &Path, by: Duration) {
        std::fs::File::options()
            .write(true)
            .open(path)
            .unwrap()
            .set_modified(SystemTime::now() - by)
            .unwrap();
    }

    #[tokio::test]
    async fn removes_stale_temporary_files_while_running() {
        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "bucket".to_string());
        backend.init().await.unwrap();

        let uploads = temp_dir.path().join(UPLOADS_DIR);
        let stale = uploads.join("stale");
        let recent = uploads.join("recent");
        let directory = uploads.join("directory");
        std::fs::write(&stale, b"abandoned").unwrap();
        std::fs::write(&recent, b"in progress elsewhere").unwrap();
        std::fs::create_dir(&directory).unwrap();
        age(&stale, STALE_UPLOAD_AGE + Duration::from_secs(60));
        age(&recent, STALE_UPLOAD_AGE - Duration::from_secs(60));

        backend.remove_stale_uploads().await.unwrap();

        assert!(!stale.exists());
        assert!(recent.exists());
        assert!(directory.exists());
    }

    #[tokio::test]
    async fn keeps_the_files_of_waiting_uploads_fresh() {
        let temp_dir = TempDir::new().unwrap();
        let mut backend = small_parts(temp_dir.path());
        backend.upload_touch_interval = Duration::from_millis(50);
        backend.init().await.unwrap();

        let upload = backend
            .start_multipart("waiting.bin", &PutOptions::default())
            .await
            .unwrap();
        upload
            .upload_part(1, 0, Bytes::from_static(b"first part"))
            .await
            .unwrap();
        let [temp] = temp_files(temp_dir.path()).try_into().unwrap();
        age(&temp, STALE_UPLOAD_AGE + Duration::from_secs(60));

        tokio::time::sleep(Duration::from_millis(300)).await;
        backend.remove_stale_uploads().await.unwrap();
        assert!(temp.exists(), "a waiting upload must look fresh");

        drop(upload);
        tokio::time::sleep(Duration::from_millis(100)).await;
        age(&temp, STALE_UPLOAD_AGE + Duration::from_secs(60));
        tokio::time::sleep(Duration::from_millis(200)).await;
        backend.remove_stale_uploads().await.unwrap();
        assert!(!temp.exists(), "a dropped upload stops touching its file");
    }

    #[tokio::test]
    async fn refuses_bucket_names_it_keeps_its_own_files_in() {
        let temp_dir = TempDir::new().unwrap();
        for name in [UPLOADS_DIR, METADATA_DIR] {
            let backend = LocalBackend::new(temp_dir.path().to_path_buf(), name.to_string());
            assert!(matches!(
                backend.init().await,
                Err(BackendError::Configuration(_))
            ));
        }
    }

    #[tokio::test]
    async fn never_lists_its_own_files() {
        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "bucket".to_string());
        backend.init().await.unwrap();
        backend
            .put_object("a", chunks(b"a", false), None, HashMap::new())
            .await
            .unwrap();
        std::fs::write(temp_dir.path().join(UPLOADS_DIR).join("partial"), b"x").unwrap();

        let page = backend.list_objects(None, None, None).await.unwrap();
        let keys: Vec<_> = page.objects.iter().map(|o| o.key.as_str()).collect();
        assert_eq!(keys, ["a"]);
        assert!(temp_dir
            .path()
            .join(METADATA_DIR)
            .join("bucket/a")
            .is_file());
        assert!(!temp_dir.path().join("bucket/a.meta.json").exists());
    }

    #[tokio::test]
    async fn never_lists_its_own_files_under_any_prefix() {
        let temp_dir = TempDir::new().unwrap();
        for bucket in ["bucket", "nested/bucket"] {
            let backend = LocalBackend::new(temp_dir.path().to_path_buf(), bucket.to_string());
            backend.init().await.unwrap();
            for key in ["a", "dir/b"] {
                backend
                    .put_object(key, chunks(b"x", false), None, HashMap::new())
                    .await
                    .unwrap();
            }
        }
        std::fs::write(temp_dir.path().join(UPLOADS_DIR).join("partial"), b"x").unwrap();

        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "bucket".to_string());
        for prefix in [
            None,
            Some(""),
            Some("d"),
            Some("dir/"),
            Some("."),
            Some("./"),
            Some(".."),
            Some("../"),
            Some("../.meta"),
            Some("../.uploads/"),
            Some("../nested/"),
            Some("/"),
            Some(".meta"),
            Some(".uploads"),
        ] {
            let page = backend.list_objects(prefix, None, None).await.unwrap();
            let keys: Vec<_> = page.objects.iter().map(|o| o.key.as_str()).collect();
            let expected: &[&str] = match prefix {
                None | Some("") => &["a", "dir/b"],
                Some("d") | Some("dir/") => &["dir/b"],
                _ => &[],
            };
            assert_eq!(keys, expected, "prefix {:?}", prefix);
        }
    }

    #[tokio::test]
    async fn refuses_bucket_names_outside_its_own_directory() {
        let temp_dir = TempDir::new().unwrap();
        for name in [
            "",
            ".",
            "..",
            "../outside",
            "/absolute",
            "./.uploads",
            ".uploads/",
            ".meta/bucket",
            "bucket/../.meta",
        ] {
            let backend = LocalBackend::new(temp_dir.path().to_path_buf(), name.to_string());
            assert!(
                matches!(backend.init().await, Err(BackendError::Configuration(_))),
                "bucket name {:?}",
                name
            );
        }
    }

    #[tokio::test]
    async fn falls_back_to_the_file_when_its_metadata_is_stale() {
        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "bucket".to_string());
        backend.init().await.unwrap();
        let written = backend
            .put_object(
                "x",
                chunks(b"old", false),
                Some("text/plain".to_string()),
                HashMap::from([("k".to_string(), "v".to_string())]),
            )
            .await
            .unwrap();

        std::fs::write(temp_dir.path().join("bucket/x"), b"replaced data").unwrap();

        let head = backend.head_object("x").await.unwrap();
        assert_eq!(head.size, 13);
        assert_ne!(head.etag, written.etag);
        assert_eq!(head.content_type, None);
        assert!(head.custom_metadata.is_empty());
        assert_eq!(backend.head_object("x").await.unwrap().etag, head.etag);
        assert_eq!(read(&backend, "x").await, b"replaced data");

        let range = backend
            .get_object_range("x", ByteRange::Suffix { length: 4 })
            .await
            .unwrap();
        assert_eq!((range.start, range.end), (9, 12));
        assert_eq!(keys(&backend).await, ["x"]);

        backend
            .put_object("x", chunks(b"new", false), None, HashMap::new())
            .await
            .unwrap();
        assert_eq!(backend.head_object("x").await.unwrap().size, 3);
    }

    #[tokio::test]
    async fn reports_a_finished_upload_as_gone() {
        let temp_dir = TempDir::new().unwrap();
        let backend = small_parts(temp_dir.path());
        backend.init().await.unwrap();

        let upload = backend
            .start_multipart("done.bin", &PutOptions::default())
            .await
            .unwrap();
        let part = upload
            .upload_part(1, 0, Bytes::from_static(b"data"))
            .await
            .unwrap();
        upload.complete(vec![part.clone()]).await.unwrap();

        assert!(matches!(
            upload.complete(vec![part]).await,
            Err(BackendError::NotFound(_))
        ));
        assert_eq!(read(&backend, "done.bin").await, b"data");
    }

    fn write_legacy(root: &Path, key: &str, data: &[u8], sidecar_key: &str) {
        let data_path = root.join("bucket").join(key);
        std::fs::create_dir_all(data_path.parent().unwrap()).unwrap();
        std::fs::write(&data_path, data).unwrap();

        let metadata = ObjectMetadata {
            key: sidecar_key.to_string(),
            size: data.len() as u64,
            content_type: Some("text/legacy".to_string()),
            etag: "legacy".to_string(),
            last_modified: Utc::now(),
            custom_metadata: HashMap::new(),
        };
        std::fs::write(
            data_path.with_extension(LEGACY_METADATA_EXTENSION),
            serde_json::to_vec(&metadata).unwrap(),
        )
        .unwrap();
    }

    async fn keys(backend: &LocalBackend) -> Vec<String> {
        let page = backend.list_objects(None, None, None).await.unwrap();
        page.objects.into_iter().map(|object| object.key).collect()
    }

    #[tokio::test]
    async fn still_reads_objects_written_with_sidecars() {
        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "bucket".to_string());
        backend.init().await.unwrap();
        write_legacy(temp_dir.path(), "dir/old.txt", b"old data", "dir/old.txt");

        let head = backend.head_object("dir/old.txt").await.unwrap();
        assert_eq!(head.content_type.as_deref(), Some("text/legacy"));
        assert_eq!(read(&backend, "dir/old.txt").await, b"old data");
        assert_eq!(keys(&backend).await, ["dir/old.txt"]);
        assert!(matches!(
            backend.head_object("dir/old.meta.json").await,
            Err(BackendError::NotFound(_))
        ));

        backend
            .copy_object("dir/old.txt", "dir/new.txt")
            .await
            .unwrap();
        assert_eq!(read(&backend, "dir/new.txt").await, b"old data");

        backend.delete_object("dir/old.txt").await.unwrap();
        assert!(!temp_dir.path().join("bucket/dir/old.txt").exists());
        assert!(!temp_dir.path().join("bucket/dir/old.meta.json").exists());
        assert_eq!(keys(&backend).await, ["dir/new.txt"]);
    }

    #[tokio::test]
    async fn ignores_sidecars_that_belong_to_another_key() {
        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "bucket".to_string());
        backend.init().await.unwrap();
        write_legacy(temp_dir.path(), "x.txt", b"text", "x.txt");
        std::fs::write(temp_dir.path().join("bucket/x.bin"), b"orphan").unwrap();

        assert_eq!(read(&backend, "x.txt").await, b"text");
        assert!(matches!(
            backend.head_object("x.bin").await,
            Err(BackendError::NotFound(_))
        ));
        assert_eq!(keys(&backend).await, ["x.txt"]);

        backend.delete_object("x.bin").await.unwrap();
        assert_eq!(read(&backend, "x.txt").await, b"text");
        backend.delete_object("x.meta.json").await.unwrap();
        assert_eq!(read(&backend, "x.txt").await, b"text");
    }

    #[tokio::test]
    async fn moves_a_sidecar_out_of_the_way_of_an_object_at_its_path() {
        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "bucket".to_string());
        backend.init().await.unwrap();
        write_legacy(temp_dir.path(), "x", b"legacy x", "x");

        backend
            .put_object(
                "x.meta.json",
                chunks(b"an object of its own", false),
                None,
                HashMap::new(),
            )
            .await
            .unwrap();

        assert_eq!(read(&backend, "x").await, b"legacy x");
        assert_eq!(
            backend
                .head_object("x")
                .await
                .unwrap()
                .content_type
                .as_deref(),
            Some("text/legacy")
        );
        assert_eq!(read(&backend, "x.meta.json").await, b"an object of its own");
        assert_eq!(keys(&backend).await, ["x", "x.meta.json"]);
    }

    #[tokio::test]
    async fn drops_the_sidecar_when_an_object_is_rewritten() {
        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "bucket".to_string());
        backend.init().await.unwrap();
        write_legacy(temp_dir.path(), "x", b"legacy x", "x");

        backend
            .put_object("x", chunks(b"new x", false), None, HashMap::new())
            .await
            .unwrap();

        assert_eq!(read(&backend, "x").await, b"new x");
        assert!(!temp_dir.path().join("bucket/x.meta.json").exists());
        assert_eq!(keys(&backend).await, ["x"]);
    }

    #[tokio::test]
    async fn copies_replace_the_destination_atomically() {
        let temp_dir = TempDir::new().unwrap();
        let backend = LocalBackend::new(temp_dir.path().to_path_buf(), "bucket".to_string());
        backend.init().await.unwrap();

        backend
            .put_object(
                "source",
                chunks(b"new contents", false),
                None,
                HashMap::new(),
            )
            .await
            .unwrap();
        backend
            .put_object("dest", chunks(b"old", false), None, HashMap::new())
            .await
            .unwrap();

        let copied = backend.copy_object("source", "dest").await.unwrap();

        assert_eq!(copied.size, 12);
        assert_eq!(read(&backend, "dest").await, b"new contents");
        assert!(temp_files(temp_dir.path()).is_empty());
    }

    mod durable {
        use super::*;
        use crate::durable::{DurablePartRef, DURABLE_MIN_PART_SIZE};

        async fn backend(root: &Path) -> LocalBackend {
            let backend = LocalBackend::new(root.to_path_buf(), "bucket".to_string());
            backend.init().await.unwrap();
            backend
        }

        fn part(byte: u8, size: u64) -> Bytes {
            Bytes::from(vec![byte; size as usize])
        }

        fn reference(part: &DurablePart) -> DurablePartRef {
            DurablePartRef {
                number: part.number,
                etag: part.etag.clone(),
            }
        }

        #[tokio::test]
        async fn completes_parts_uploaded_by_separate_handles() {
            let temp_dir = TempDir::new().unwrap();
            let opts = PutOptions {
                content_type: Some("application/gzip".to_string()),
                metadata: HashMap::from([("rows".to_string(), "3".to_string())]),
                ..Default::default()
            };
            let upload_id = backend(temp_dir.path())
                .await
                .start_durable_multipart("exports/a.gz", &opts)
                .await
                .unwrap();

            let first = backend(temp_dir.path())
                .await
                .upload_durable_part("exports/a.gz", &upload_id, 1, part(1, DURABLE_MIN_PART_SIZE))
                .await
                .unwrap();
            let second = backend(temp_dir.path())
                .await
                .upload_durable_part("exports/a.gz", &upload_id, 2, part(2, 10))
                .await
                .unwrap();
            assert_eq!(second.size, 10);

            let resumed = backend(temp_dir.path()).await;
            let metadata = resumed
                .complete_durable_multipart(
                    "exports/a.gz",
                    &upload_id,
                    &[reference(&first), reference(&second)],
                )
                .await
                .unwrap();

            assert_eq!(metadata.size, DURABLE_MIN_PART_SIZE + 10);
            assert_eq!(metadata.content_type.as_deref(), Some("application/gzip"));
            assert_eq!(metadata.custom_metadata.get("rows").map(String::as_str), Some("3"));

            let data = read(&resumed, "exports/a.gz").await;
            assert_eq!(data.len() as u64, DURABLE_MIN_PART_SIZE + 10);
            assert!(data[..DURABLE_MIN_PART_SIZE as usize].iter().all(|b| *b == 1));
            assert!(data[DURABLE_MIN_PART_SIZE as usize..].iter().all(|b| *b == 2));
            assert!(resumed.list_durable_multiparts("").await.unwrap().is_empty());
        }

        #[tokio::test]
        async fn a_replaced_part_wins_even_when_shorter() {
            let temp_dir = TempDir::new().unwrap();
            let backend = backend(temp_dir.path()).await;
            let upload_id = backend
                .start_durable_multipart("a", &PutOptions::default())
                .await
                .unwrap();

            let stale = backend
                .upload_durable_part("a", &upload_id, 1, part(9, 100))
                .await
                .unwrap();
            let fresh = backend
                .upload_durable_part("a", &upload_id, 1, part(7, 20))
                .await
                .unwrap();
            assert_ne!(stale.etag, fresh.etag);

            let error = backend
                .complete_durable_multipart("a", &upload_id, &[reference(&stale)])
                .await
                .unwrap_err();
            assert!(matches!(error, BackendError::InvalidRequest(_)), "{error:?}");

            backend
                .complete_durable_multipart("a", &upload_id, &[reference(&fresh)])
                .await
                .unwrap();
            assert_eq!(read(&backend, "a").await, vec![7; 20]);
        }

        #[tokio::test]
        async fn completing_twice_reports_the_upload_as_gone() {
            let temp_dir = TempDir::new().unwrap();
            let backend = backend(temp_dir.path()).await;
            let upload_id = backend
                .start_durable_multipart("a", &PutOptions::default())
                .await
                .unwrap();
            let only = backend
                .upload_durable_part("a", &upload_id, 1, part(1, 5))
                .await
                .unwrap();

            backend
                .complete_durable_multipart("a", &upload_id, &[reference(&only)])
                .await
                .unwrap();
            let again = backend
                .complete_durable_multipart("a", &upload_id, &[reference(&only)])
                .await
                .unwrap_err();
            assert!(matches!(again, BackendError::NotFound(_)), "{again:?}");
            assert_eq!(backend.head_object("a").await.unwrap().size, 5);
        }

        #[tokio::test]
        async fn enforces_the_minimum_size_of_leading_parts() {
            let temp_dir = TempDir::new().unwrap();
            let backend = backend(temp_dir.path()).await;
            let upload_id = backend
                .start_durable_multipart("a", &PutOptions::default())
                .await
                .unwrap();
            let first = backend
                .upload_durable_part("a", &upload_id, 1, part(1, 5))
                .await
                .unwrap();
            let second = backend
                .upload_durable_part("a", &upload_id, 2, part(2, 5))
                .await
                .unwrap();

            let error = backend
                .complete_durable_multipart("a", &upload_id, &[reference(&first), reference(&second)])
                .await
                .unwrap_err();
            assert!(matches!(error, BackendError::InvalidRequest(_)), "{error:?}");
            assert!(!backend.object_exists("a").await.unwrap());
        }

        #[tokio::test]
        async fn lists_and_aborts_open_uploads() {
            let temp_dir = TempDir::new().unwrap();
            let backend = backend(temp_dir.path()).await;
            let a = backend
                .start_durable_multipart("exports/a", &PutOptions::default())
                .await
                .unwrap();
            let b = backend
                .start_durable_multipart("other/b", &PutOptions::default())
                .await
                .unwrap();

            let listed = backend.list_durable_multiparts("exports/").await.unwrap();
            assert_eq!(listed.len(), 1);
            assert_eq!(listed[0].upload_id, a);
            assert_eq!(listed[0].key, "exports/a");

            backend.abort_durable_multipart("exports/a", &a).await.unwrap();
            backend.abort_durable_multipart("exports/a", &a).await.unwrap();
            assert!(backend.list_durable_multiparts("exports/").await.unwrap().is_empty());

            let error = backend
                .upload_durable_part("exports/a", &a, 1, part(1, 1))
                .await
                .unwrap_err();
            assert!(matches!(error, BackendError::NotFound(_)), "{error:?}");
            assert_eq!(backend.list_durable_multiparts("").await.unwrap()[0].upload_id, b);
        }

        #[tokio::test]
        async fn an_upload_belongs_to_its_key() {
            let temp_dir = TempDir::new().unwrap();
            let backend = backend(temp_dir.path()).await;
            let upload_id = backend
                .start_durable_multipart("a", &PutOptions::default())
                .await
                .unwrap();

            for error in [
                backend
                    .upload_durable_part("b", &upload_id, 1, part(1, 1))
                    .await
                    .unwrap_err(),
                backend
                    .upload_durable_part("a", "../../escape", 1, part(1, 1))
                    .await
                    .unwrap_err(),
            ] {
                assert!(
                    matches!(error, BackendError::NotFound(_) | BackendError::InvalidRequest(_)),
                    "{error:?}"
                );
            }
        }

        #[tokio::test]
        async fn sweeps_durable_uploads_older_than_a_week() {
            let temp_dir = TempDir::new().unwrap();
            let backend = backend(temp_dir.path()).await;
            let old = backend
                .start_durable_multipart("old", &PutOptions::default())
                .await
                .unwrap();
            let fresh = backend
                .start_durable_multipart("fresh", &PutOptions::default())
                .await
                .unwrap();

            let manifest = backend.layout.durable_path(&old).unwrap().join(DURABLE_MANIFEST);
            age(&manifest, STALE_DURABLE_UPLOAD_AGE + Duration::from_secs(60));
            backend.remove_stale_uploads().await.unwrap();

            let left: Vec<_> = backend
                .list_durable_multiparts("")
                .await
                .unwrap()
                .into_iter()
                .map(|upload| upload.upload_id)
                .collect();
            assert_eq!(left, vec![fresh]);
        }
    }
}
