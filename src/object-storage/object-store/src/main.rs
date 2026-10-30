use object_store::{Config, ObjectStoreService};
use object_store_backends::{
    azure::AzureBackend, gcs::GcsBackend, local::LocalBackend, s3::S3Backend, Backend,
};
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

    info!("Starting object storage service with config: {:?}", config);

    let backend: Arc<dyn Backend> = match config.backend {
        object_store::config::BackendConfig::Local {
            root_path,
            physical_bucket,
        } => {
            info!("Using local backend at {:?}", root_path);
            Arc::new(LocalBackend::new(root_path, physical_bucket))
        }
        object_store::config::BackendConfig::S3 {
            region,
            physical_bucket,
            endpoint,
        } => {
            info!(
                "Using S3 backend with bucket: {}, region: {}, endpoint: {:?}",
                physical_bucket, region, endpoint
            );
            Arc::new(S3Backend::new_with_config(physical_bucket, region, endpoint).await?)
        }
        object_store::config::BackendConfig::Gcs { physical_bucket } => {
            info!("Using GCS backend with bucket: {}", physical_bucket);
            Arc::new(GcsBackend::new(physical_bucket).await?)
        }
        object_store::config::BackendConfig::Azure {
            account,
            access_key,
            physical_bucket,
        } => {
            info!(
                "Using Azure backend with account: {}, container: {}",
                account, physical_bucket
            );
            Arc::new(AzureBackend::new(account, access_key, physical_bucket)?)
        }
    };

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
