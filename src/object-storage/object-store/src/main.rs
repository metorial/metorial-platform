use object_store::{Config, ObjectStoreService};
use object_store_backends::Backend;
use std::sync::Arc;
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

    let backend: Arc<dyn Backend> = config.backend.build().await?;

    backend.init().await?;

    let metadata = Arc::new(MetadataStore::new(backend.clone()).await?);
    let service = Arc::new(ObjectStoreService::new(backend, metadata.clone()));

    let metadata_clone = metadata.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            if let Err(e) = metadata_clone.cleanup_expired_locks().await {
                tracing::error!("Failed to cleanup expired locks: {}", e);
            }
        }
    });

    let app = object_store::router::create_router(service);

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    info!("Object storage service listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
