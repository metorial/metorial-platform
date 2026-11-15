use std::future::IntoFuture;
use std::sync::Arc;
use std::time::Duration;

use tokio::net::TcpListener;
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

use crate::router::{create_app_router, RouterOptions};
use crate::service::ObjectStoreService;
use crate::zip::ZipJobManager;

pub const MAINTENANCE_INTERVAL: Duration = Duration::from_secs(60);

/// Serves the API until `shutdown` fires. Then it stops accepting connections, interrupts the
/// zip jobs running here (see `ZipJobManager::shutdown`) and returns once every in-flight
/// request has been answered.
pub async fn serve(
    listener: TcpListener,
    service: Arc<ObjectStoreService>,
    jobs: Arc<ZipJobManager>,
    options: RouterOptions,
    shutdown: CancellationToken,
) -> std::io::Result<()> {
    let app = create_app_router(service, jobs.clone(), options);

    let server = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown.clone().cancelled_owned())
        .into_future();
    let stop_jobs = async {
        shutdown.cancelled().await;
        info!("Shutting down");
        jobs.shutdown().await;
    };

    let (served, ()) = tokio::join!(server, stop_jobs);
    served
}

/// Expired lock, zip job record and abandoned upload cleanup, every `MAINTENANCE_INTERVAL` until
/// `shutdown`.
pub async fn run_maintenance(
    service: Arc<ObjectStoreService>,
    jobs: Arc<ZipJobManager>,
    shutdown: CancellationToken,
) {
    let mut interval = tokio::time::interval(MAINTENANCE_INTERVAL);

    loop {
        tokio::select! {
            _ = shutdown.cancelled() => return,
            _ = interval.tick() => {}
        }

        if let Err(e) = service.metadata().cleanup_expired_locks().await {
            error!("Failed to cleanup expired locks: {}", e);
        }
        if let Err(e) = jobs.delete_expired_records().await {
            error!("Failed to delete expired zip job records: {}", e);
        }
        if let Err(e) = service.backend().remove_stale_uploads().await {
            error!("Failed to remove stale uploads: {}", e);
        }
    }
}

/// Resolves on SIGINT, or SIGTERM on Unix.
pub async fn shutdown_signal() {
    let interrupt = async {
        if let Err(e) = tokio::signal::ctrl_c().await {
            error!("Failed to listen for SIGINT: {}", e);
            std::future::pending::<()>().await;
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(e) => {
                error!("Failed to listen for SIGTERM: {}", e);
                std::future::pending::<()>().await;
            }
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = interrupt => {}
        _ = terminate => {}
    }
}
