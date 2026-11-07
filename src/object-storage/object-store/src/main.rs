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

    let backend: Arc<dyn Backend> = config.backend.build().await?;

    backend.init().await?;

    let metadata = Arc::new(MetadataStore::new(backend.clone()).await?);
    let public_signer = config.public.signer()?.map(Arc::new);
    let service = Arc::new(
        ObjectStoreService::new(backend, metadata.clone()).with_public_signer(public_signer),
    );

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

    let app = object_store::router::create_router(service);

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    info!("Object storage service listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
