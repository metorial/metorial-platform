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

    // A configuration that does not parse must stop the service: falling back to the defaults would
    // silently store data on the container's local disk.
    let configured_by_env = std::env::vars().any(|(key, _)| key.starts_with("OBJECT_STORE__"));
    let config = if let Ok(config_path) = std::env::var("CONFIG_PATH") {
        Config::from_file(&config_path)?
    } else if configured_by_env {
        Config::from_env()
            .map_err(|error| anyhow::anyhow!("Invalid OBJECT_STORE__* configuration: {error}"))?
    } else {
        Config::default()
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
    let public_signer = config.public.signer()?.map(Arc::new);
    info!(
        "Archive upload memory budget: {} bytes",
        config.zip.upload_memory_budget_bytes
    );
    let archive_uploader = Arc::new(Uploader::new(config.archive_upload_settings()));
    let service = Arc::new(
        ObjectStoreService::new(backend, metadata)
            .with_public_signer(public_signer)
            .with_archive_uploader(archive_uploader)
            .with_max_concurrent_digests(config.digests.max_concurrent),
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

    if service.public_signer().is_some() {
        let public_app = object_store::public_api::create_public_router(
            service.clone(),
            std::time::Duration::from_secs(config.public.request_timeout_secs),
        );
        let public_addr = format!("{}:{}", config.public.host, config.public.port);
        let public_listener = tokio::net::TcpListener::bind(&public_addr).await?;

        info!(
            "Public object URLs are served on {} for {}",
            public_addr,
            config.public.base_url.as_deref().unwrap_or_default()
        );

        tokio::spawn(async move {
            if let Err(error) = axum::serve(public_listener, public_app).await {
                tracing::error!("Public listener stopped: {}", error);
                std::process::exit(1);
            }
        });
    }

    if config.server.health_port != 0 {
        let health_app = axum::Router::new()
            .route("/", axum::routing::get(object_store::api::health_check))
            .route(
                "/health",
                axum::routing::get(object_store::api::health_check),
            );
        let health_addr = format!("{}:{}", config.server.host, config.server.health_port);
        let health_listener = tokio::net::TcpListener::bind(&health_addr).await?;

        tokio::spawn(async move {
            if let Err(error) = axum::serve(health_listener, health_app).await {
                tracing::error!("Health listener stopped: {}", error);
                std::process::exit(1);
            }
        });
    }

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
