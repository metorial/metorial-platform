use object_store::server::{run_maintenance, serve, shutdown_signal};
use object_store::zip::ZipJobManager;
use object_store::{Config, ObjectStoreService};
use object_store_backends::{Backend, Uploader};
use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use object_store::metadata::MetadataStore;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "object_store=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = if let Ok(config_path) = std::env::var("CONFIG_PATH") {
        Config::from_file(&config_path)?
    } else {
        Config::from_env().unwrap_or_else(|_| Config::default())
    };

    info!(
        "Starting object storage service with backend: {:?}",
        config.backend
    );

    info!("Upload settings: {:?}", config.uploads);
    let uploader = Arc::new(Uploader::new(config.uploads.settings()));
    let backend: Arc<dyn Backend> = config.backend.clone().build(uploader).await?;

    backend.init().await?;

    let metadata = Arc::new(MetadataStore::new(backend.clone()).await?);
    info!(
        "Archive upload memory budget: {} bytes",
        config.zip.upload_memory_budget_bytes
    );
    let archive_uploader = Arc::new(Uploader::new(config.archive_upload_settings()));
    let service = Arc::new(
        ObjectStoreService::new(backend, metadata).with_archive_uploader(archive_uploader),
    );

    let zip_settings = config.zip_settings();
    if zip_settings.max_wait.as_secs() < config.zip.max_wait_seconds {
        info!(
            "zip.max_wait_seconds lowered to {:?} to stay below the request timeout",
            zip_settings.max_wait
        );
    }
    let jobs = ZipJobManager::new(service.clone(), zip_settings);
    info!("Zip job instance id: {}", jobs.instance_id());

    let shutdown = CancellationToken::new();
    tokio::spawn({
        let shutdown = shutdown.clone();
        async move {
            shutdown_signal().await;
            shutdown.cancel();
        }
    });
    tokio::spawn(run_maintenance(
        service.clone(),
        jobs.clone(),
        shutdown.clone(),
    ));

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    info!("Object storage service listening on {}", addr);

    serve(
        listener,
        service,
        jobs,
        config.server.router_options(),
        shutdown,
    )
    .await?;

    info!("Object storage service stopped");
    Ok(())
}
