use std::sync::Arc;
use std::time::{Duration, SystemTime};

use object_store::metadata::MetadataStore;
use object_store::server::run_maintenance;
use object_store::zip::{ZipJobManager, ZipSettings};
use object_store::ObjectStoreService;
use object_store_backends::local::LocalBackend;
use object_store_backends::Backend;
use tempfile::TempDir;
use tokio_util::sync::CancellationToken;

#[tokio::test]
async fn removes_abandoned_local_uploads_while_running() {
    let dir = TempDir::new().unwrap();
    let backend = Arc::new(LocalBackend::new(
        dir.path().to_path_buf(),
        "physical".to_string(),
    ));
    backend.init().await.unwrap();
    let metadata = Arc::new(MetadataStore::new(backend.clone()).await.unwrap());
    let service = Arc::new(ObjectStoreService::new(backend, metadata));
    let jobs = ZipJobManager::new(service.clone(), ZipSettings::default());

    let uploads = dir.path().join(".uploads");
    let abandoned = uploads.join("abandoned");
    let in_progress = uploads.join("in-progress");
    std::fs::write(&abandoned, b"left behind").unwrap();
    std::fs::write(&in_progress, b"still being written").unwrap();
    std::fs::File::options()
        .write(true)
        .open(&abandoned)
        .unwrap()
        .set_modified(SystemTime::now() - Duration::from_secs(7 * 60 * 60))
        .unwrap();

    let shutdown = CancellationToken::new();
    let maintenance = tokio::spawn(run_maintenance(service, jobs, shutdown.clone()));

    for _ in 0..200 {
        if !abandoned.exists() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    assert!(!abandoned.exists());
    assert!(in_progress.exists());

    shutdown.cancel();
    maintenance.await.unwrap();
}
