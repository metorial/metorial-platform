//! Client uploads and archive builds draw on separate upload memory budgets, so either can be
//! exhausted without holding up the other.

mod pipeline_support;

use std::sync::Arc;
use std::time::Duration;

use bytes::Bytes;
use object_store::zip::{build_archive, ZipJobSpec, ZipProgress};
use object_store_backends::{ByteStream, PutOptions, UploadSettings, Uploader};
use pipeline_support::*;
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

const BUDGET: u64 = 16 * MIB;

fn budgeted() -> UploadSettings {
    UploadSettings {
        memory_budget_bytes: BUDGET,
        ..upload_settings()
    }
}

/// Sends a whole head and most of the next part, then nothing, so the upload keeps both
/// reserved.
fn stalling() -> ByteStream {
    let sent = futures::stream::iter(
        (0..12).map(|index| Ok(Bytes::from(vec![index as u8; MIB as usize]))),
    );
    Box::pin(futures::StreamExt::chain(sent, futures::stream::pending()))
}

fn exhaust(uploader: &Arc<Uploader>, backend: &Arc<TestBackend>) -> Vec<JoinHandle<()>> {
    (0..3)
        .map(|index| {
            let uploader = uploader.clone();
            let backend = backend.clone();
            tokio::spawn(async move {
                let key = format!("{SOURCE_BUCKET}/stalled-{index}");
                let _ = uploader
                    .upload(&*backend, &key, stalling(), PutOptions::default())
                    .await;
            })
        })
        .collect()
}

async fn until_exhausted(uploader: &Uploader) {
    for _ in 0..500 {
        if uploader.reserved_bytes() >= 10 * MIB {
            return;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    panic!(
        "the budget never filled: {} bytes",
        uploader.reserved_bytes()
    );
}

fn archive_spec(harness: &Harness, key: &str) -> ZipJobSpec {
    let name = format!("{key}.bin");
    harness.add_generated(&name, Synthetic::new(Content::Random, 7, 10 * MIB));
    spec(
        ARCHIVE_BUCKET,
        key,
        vec![entry(&name, GENERATED_BUCKET, &name)],
    )
}

async fn archive(harness: &Harness, spec: &ZipJobSpec) {
    build_archive(
        &harness.service,
        spec,
        &zip_settings(),
        CancellationToken::new(),
        Arc::new(ZipProgress::new()),
        None,
    )
    .await
    .unwrap();
}

async fn client_upload(harness: &Harness, key: &str) {
    let data = Bytes::from(vec![9u8; 10 * MIB as usize]);
    let stream: ByteStream = Box::pin(futures::stream::once(async move { Ok(data) }));
    harness
        .service
        .put_object_stream(SOURCE_BUCKET, key, stream, PutOptions::default())
        .await
        .unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn archives_are_built_while_client_uploads_hold_their_whole_budget() {
    let archive_uploader = Arc::new(Uploader::new(budgeted()));
    let harness =
        Harness::with_archive_uploader(budgeted(), local_limits(), archive_uploader.clone()).await;
    let client_uploader = harness.backend.uploader_handle();

    let stalled = exhaust(&harness.backend.shared_uploader(), &harness.backend);
    until_exhausted(client_uploader).await;
    assert!(
        tokio::time::timeout(
            Duration::from_millis(300),
            client_upload(&harness, "blocked")
        )
        .await
        .is_err(),
        "client uploads must be out of budget"
    );

    let spec = archive_spec(&harness, "while-clients-wait.zip");
    tokio::time::timeout(Duration::from_secs(20), archive(&harness, &spec))
        .await
        .expect("the archive must not wait on client uploads");
    assert!(archive_uploader.peak_reserved_bytes() > 0);

    for task in stalled {
        task.abort();
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn client_uploads_go_through_while_archives_hold_their_whole_budget() {
    let archive_uploader = Arc::new(Uploader::new(budgeted()));
    let harness =
        Harness::with_archive_uploader(budgeted(), local_limits(), archive_uploader.clone()).await;

    let stalled = exhaust(&archive_uploader, &harness.backend);
    until_exhausted(&archive_uploader).await;
    let spec = archive_spec(&harness, "blocked.zip");
    assert!(
        tokio::time::timeout(Duration::from_millis(300), archive(&harness, &spec))
            .await
            .is_err(),
        "archives must be out of budget"
    );

    tokio::time::timeout(
        Duration::from_secs(20),
        client_upload(&harness, "unblocked"),
    )
    .await
    .expect("client uploads must not wait on archives");
    assert!(harness.exists(SOURCE_BUCKET, "unblocked").await);

    for task in stalled {
        task.abort();
    }
}
