//! Drives the shared uploader against an in-memory backend that validates every multipart upload
//! and can inject failures and delays.

mod common;

use common::*;
use object_store_backends::{
    Backend, BackendError, PutOptions, UploadLimits, UploadSettings, Uploader,
};
use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

fn hinted(size_hint: Option<u64>) -> PutOptions {
    PutOptions {
        size_hint,
        ..Default::default()
    }
}

async fn upload(
    backend: &FakeBackend,
    key: &str,
    data: &[u8],
    opts: PutOptions,
) -> Result<object_store_backends::UploadedObject, BackendError> {
    backend
        .put_object_stream(key, chunks_of(data, 100_003), opts)
        .await
}

fn stored(backend: &FakeBackend, key: &str) -> Vec<u8> {
    backend.state.object(key).expect("object stored").1.to_vec()
}

fn part_sizes(backend: &FakeBackend) -> Vec<u64> {
    let calls = backend.state.calls();
    calls
        .completed_parts
        .last()
        .expect("a completed upload")
        .iter()
        .map(|part| part.size)
        .collect()
}

async fn eventually(what: &str, condition: impl Fn() -> bool) {
    for _ in 0..500 {
        if condition() {
            return;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    panic!("timed out waiting for {}", what);
}

#[tokio::test]
async fn writes_small_objects_with_one_request() {
    for size in [0, 1, 4096, MIB as usize] {
        let backend = FakeBackend::new(test_settings());
        let data = pattern(size, size as u64);

        let uploaded = upload(&backend, "small", &data, PutOptions::default())
            .await
            .unwrap();

        assert_eq!(uploaded.metadata.size, size as u64);
        assert_eq!(uploaded.sha256, sha256_hex(&data));
        assert_eq!(stored(&backend, "small"), data);

        let calls = backend.state.calls();
        assert_eq!(calls.single_puts, 1, "size {}", size);
        assert_eq!(calls.starts, 0, "size {}", size);
    }
}

#[tokio::test]
async fn switches_to_multipart_just_over_the_threshold() {
    let backend = FakeBackend::new(test_settings());
    let data = pattern(MIB as usize + 1, 1);

    let uploaded = upload(&backend, "edge", &data, PutOptions::default())
        .await
        .unwrap();

    assert_eq!(uploaded.metadata.size, MIB + 1);
    assert_eq!(stored(&backend, "edge"), data);
    assert_eq!(part_sizes(&backend), vec![MIB + 1]);

    let calls = backend.state.calls();
    assert_eq!(calls.single_puts, 0);
    assert_eq!(calls.starts, 1);
    assert_eq!(calls.aborts, 0);
}

#[tokio::test]
async fn reassembles_parts_in_order() {
    let backend = FakeBackend::new(test_settings());
    let data = pattern(10 * MIB as usize + 12_345, 2);

    let uploaded = upload(&backend, "ordered", &data, PutOptions::default())
        .await
        .unwrap();

    assert_eq!(uploaded.metadata.size, data.len() as u64);
    assert_eq!(uploaded.sha256, sha256_hex(&data));
    assert_eq!(stored(&backend, "ordered"), data);

    let sizes = part_sizes(&backend);
    assert_eq!(sizes.len(), 11);
    assert_eq!(sizes[0], MIB + 1);
    assert!(sizes[1..sizes.len() - 1].iter().all(|size| *size == MIB));
    assert_eq!(sizes.iter().sum::<u64>(), data.len() as u64);
}

#[tokio::test]
async fn reassembles_parts_when_early_parts_finish_last() {
    let backend = FakeBackend::new(test_settings());
    {
        let mut faults = backend.state.faults();
        faults.part_delays.insert(1, Duration::from_millis(300));
        faults.part_delays.insert(2, Duration::from_millis(150));
    }
    let data = pattern(6 * MIB as usize, 3);

    upload(&backend, "slow-head", &data, PutOptions::default())
        .await
        .unwrap();

    assert_eq!(stored(&backend, "slow-head"), data);
    assert!(backend.state.max_parts_in_flight.load(Ordering::SeqCst) > 1);
}

#[tokio::test]
async fn preserves_content_type_and_metadata() {
    let backend = FakeBackend::new(test_settings());
    let data = pattern(3 * MIB as usize, 4);
    let opts = PutOptions {
        content_type: Some("application/zip".to_string()),
        metadata: HashMap::from([("origin".to_string(), "test".to_string())]),
        size_hint: None,
    };

    let uploaded = upload(&backend, "typed", &data, opts).await.unwrap();

    assert_eq!(
        uploaded.metadata.content_type.as_deref(),
        Some("application/zip")
    );
    assert_eq!(uploaded.metadata.custom_metadata["origin"], "test");
}

#[tokio::test]
async fn uploads_correctly_whatever_the_hint_says() {
    let size = 9 * MIB as usize + 7;
    let data = pattern(size, 5);

    for hint in [
        None,
        Some(0),
        Some(1),
        Some(MIB),
        Some(size as u64),
        Some(size as u64 * 3),
        Some(u64::MAX),
    ] {
        let backend = FakeBackend::new(test_settings());

        let uploaded = upload(&backend, "hinted", &data, hinted(hint))
            .await
            .unwrap_or_else(|e| panic!("hint {:?}: {}", hint, e));

        assert_eq!(uploaded.metadata.size, size as u64, "hint {:?}", hint);
        assert_eq!(uploaded.sha256, sha256_hex(&data), "hint {:?}", hint);
        assert_eq!(stored(&backend, "hinted"), data, "hint {:?}", hint);
        assert_eq!(backend.state.calls().size_hints, vec![hint]);
    }
}

#[tokio::test]
async fn sizes_parts_from_the_hint() {
    let limits = UploadLimits {
        max_parts: 20,
        ..FAKE_LIMITS
    };
    let backend = FakeBackend::new(test_settings()).limits(limits);
    let data = pattern(40 * MIB as usize, 6);

    upload(&backend, "hinted", &data, hinted(Some(40 * MIB)))
        .await
        .unwrap();

    let sizes = part_sizes(&backend);
    assert!(sizes.len() <= 18, "{:?}", sizes);
    assert!(sizes[1..sizes.len() - 1]
        .iter()
        .all(|size| *size == 3 * MIB));
}

#[tokio::test]
async fn grows_parts_past_a_hint_that_was_too_small() {
    let limits = UploadLimits {
        max_parts: 20,
        ..FAKE_LIMITS
    };
    let backend = FakeBackend::new(test_settings()).limits(limits);
    let data = pattern(60 * MIB as usize, 7);

    upload(&backend, "underestimated", &data, hinted(Some(4 * MIB)))
        .await
        .unwrap();

    let sizes = part_sizes(&backend);
    assert!(sizes.len() <= 20, "{:?}", sizes);
    assert!(sizes.iter().any(|size| *size > 4 * MIB), "{:?}", sizes);
    assert_eq!(stored(&backend, "underestimated"), data);
}

#[tokio::test]
async fn caps_part_buffers_at_the_memory_budget_for_huge_hints() {
    let settings = UploadSettings {
        memory_budget_bytes: 4 * MIB,
        ..test_settings()
    };
    let backend = FakeBackend::new(settings).limits(UploadLimits {
        max_part_size: u64::MAX,
        ..FAKE_LIMITS
    });
    let data = pattern(12 * MIB as usize, 8);

    upload(&backend, "huge-hint", &data, hinted(Some(u64::MAX)))
        .await
        .unwrap();

    assert!(part_sizes(&backend).iter().all(|size| *size <= 4 * MIB));
    assert!(backend.uploader.peak_reserved_bytes() <= 4 * MIB);
}

#[tokio::test]
async fn retries_retryable_part_failures() {
    let backend = FakeBackend::new(test_settings());
    backend
        .state
        .faults()
        .parts
        .insert(2, (3, Failure::Retryable));
    let data = pattern(5 * MIB as usize, 9);

    upload(&backend, "flaky", &data, PutOptions::default())
        .await
        .unwrap();

    assert_eq!(stored(&backend, "flaky"), data);
    let calls = backend.state.calls();
    assert_eq!(calls.part_attempts[&2], 4);
    assert_eq!(calls.part_attempts[&1], 1);
    assert_eq!(calls.aborts, 0);
}

#[tokio::test]
async fn gives_up_after_the_last_attempt() {
    let backend = FakeBackend::new(test_settings());
    backend
        .state
        .faults()
        .parts
        .insert(3, (u32::MAX, Failure::Retryable));
    let data = pattern(5 * MIB as usize, 10);

    let error = upload(&backend, "down", &data, PutOptions::default())
        .await
        .unwrap_err();

    assert!(matches!(error, BackendError::Retryable(_)), "{:?}", error);
    assert!(backend.state.object("down").is_none());
    let calls = backend.state.calls();
    assert_eq!(calls.part_attempts[&3], 6);
    assert_eq!(calls.aborts, 1);
    assert_eq!(calls.completes, 0);
}

#[tokio::test]
async fn does_not_retry_permanent_failures() {
    let backend = FakeBackend::new(test_settings());
    backend
        .state
        .faults()
        .parts
        .insert(2, (1, Failure::Permanent));
    let data = pattern(5 * MIB as usize, 11);

    let error = upload(&backend, "rejected", &data, PutOptions::default())
        .await
        .unwrap_err();

    assert!(matches!(error, BackendError::Provider(_)), "{:?}", error);
    assert!(backend.state.object("rejected").is_none());
    let calls = backend.state.calls();
    assert_eq!(calls.part_attempts[&2], 1);
    assert_eq!(calls.aborts, 1);
    assert_eq!(calls.completes, 0);
}

#[tokio::test]
async fn retries_starting_completing_and_single_requests() {
    let backend = FakeBackend::new(test_settings());
    {
        let mut faults = backend.state.faults();
        faults.start = Some((2, Failure::Retryable));
        faults.complete = Some((2, Failure::Retryable));
        faults.single = Some((2, Failure::Retryable));
    }

    let large = pattern(3 * MIB as usize, 12);
    upload(&backend, "large", &large, PutOptions::default())
        .await
        .unwrap();
    let small = pattern(1000, 13);
    upload(&backend, "small", &small, PutOptions::default())
        .await
        .unwrap();

    assert_eq!(stored(&backend, "large"), large);
    assert_eq!(stored(&backend, "small"), small);
    let calls = backend.state.calls();
    assert_eq!(calls.start_attempts, 3);
    assert_eq!(calls.complete_attempts, 3);
    assert_eq!(calls.single_attempts, 3);
    assert_eq!(calls.aborts, 0);
}

#[tokio::test]
async fn aborts_when_completing_fails() {
    let backend = FakeBackend::new(test_settings());
    backend.state.faults().complete = Some((1, Failure::Permanent));
    let data = pattern(3 * MIB as usize, 14);

    upload(&backend, "uncommitted", &data, PutOptions::default())
        .await
        .unwrap_err();

    assert!(backend.state.object("uncommitted").is_none());
    assert_eq!(backend.state.calls().aborts, 1);
}

#[tokio::test]
async fn accepts_a_completion_whose_response_was_lost() {
    let backend = FakeBackend::new(test_settings());
    backend.state.faults().complete = Some((1, Failure::LostResponse));
    let data = pattern(3 * MIB as usize, 30);

    let uploaded = upload(&backend, "committed", &data, PutOptions::default())
        .await
        .unwrap();

    assert_eq!(uploaded.metadata.size, data.len() as u64);
    assert_eq!(
        uploaded.metadata.etag,
        backend.state.object("committed").unwrap().0.etag
    );
    assert_eq!(stored(&backend, "committed"), data);
    let calls = backend.state.calls();
    assert_eq!(calls.complete_attempts, 2);
    assert_eq!(calls.aborts, 0);
}

#[tokio::test]
async fn fails_when_a_vanished_upload_left_another_object() {
    let backend = FakeBackend::new(test_settings());
    let previous = pattern(1000, 31);
    upload(&backend, "replaced", &previous, PutOptions::default())
        .await
        .unwrap();
    backend.state.faults().complete = Some((1, Failure::Discarded));

    let error = upload(
        &backend,
        "replaced",
        &pattern(3 * MIB as usize, 32),
        PutOptions::default(),
    )
    .await
    .unwrap_err();

    assert!(matches!(error, BackendError::Provider(_)), "{:?}", error);
    assert_eq!(stored(&backend, "replaced"), previous);
    let calls = backend.state.calls();
    assert_eq!(calls.complete_attempts, 2);
    assert_eq!(calls.aborts, 1);
}

#[tokio::test]
async fn fails_when_a_vanished_upload_left_no_object() {
    let backend = FakeBackend::new(test_settings());
    backend.state.faults().complete = Some((1, Failure::Discarded));

    let error = upload(
        &backend,
        "discarded",
        &pattern(3 * MIB as usize, 33),
        PutOptions::default(),
    )
    .await
    .unwrap_err();

    assert!(matches!(error, BackendError::Provider(_)), "{:?}", error);
    assert!(backend.state.object("discarded").is_none());
    assert_eq!(backend.state.calls().aborts, 1);
}

#[tokio::test]
async fn does_not_retry_permanent_single_request_failures() {
    let backend = FakeBackend::new(test_settings());
    backend.state.faults().single = Some((1, Failure::Permanent));

    upload(&backend, "small", b"tiny", PutOptions::default())
        .await
        .unwrap_err();

    assert_eq!(backend.state.calls().single_attempts, 1);
    assert!(backend.state.object("small").is_none());
}

#[tokio::test]
async fn aborts_when_the_input_fails_mid_upload() {
    let backend = FakeBackend::new(test_settings());
    let data = pattern(5 * MIB as usize, 15);

    let error = backend
        .put_object_stream(
            "broken",
            failing_after(&data, 64 * 1024),
            PutOptions::default(),
        )
        .await
        .unwrap_err();

    assert!(error.to_string().contains("client went away"), "{}", error);
    assert!(backend.state.object("broken").is_none());
    let calls = backend.state.calls();
    assert_eq!(calls.starts, 1);
    assert_eq!(calls.completes, 0);
    assert_eq!(calls.aborts, 1);
    assert_eq!(backend.uploader.reserved_bytes(), 0);
}

#[tokio::test]
async fn writes_nothing_when_the_input_fails_before_the_first_part() {
    let backend = FakeBackend::new(test_settings());
    let data = pattern(100_000, 16);

    backend
        .put_object_stream(
            "broken",
            failing_after(&data, 10_000),
            PutOptions::default(),
        )
        .await
        .unwrap_err();

    assert!(backend.state.object("broken").is_none());
    let calls = backend.state.calls();
    assert_eq!(calls.single_attempts, 0);
    assert_eq!(calls.start_attempts, 0);
}

#[tokio::test]
async fn aborts_when_the_upload_is_cancelled() {
    let backend = Arc::new(FakeBackend::new(test_settings()));
    backend.state.faults().part_delay = Duration::from_secs(30);
    let data = pattern(8 * MIB as usize, 17);

    let started = backend.state.part_started.notified();
    let task = tokio::spawn({
        let backend = backend.clone();
        async move { upload(&backend, "cancelled", &data, PutOptions::default()).await }
    });

    tokio::time::timeout(Duration::from_secs(5), started)
        .await
        .expect("a part started");
    task.abort();
    assert!(task.await.unwrap_err().is_cancelled());

    eventually("the upload to be aborted", || {
        backend.state.calls().aborts == 1
    })
    .await;
    eventually("part tasks to stop", || {
        backend.state.parts_in_flight.load(Ordering::SeqCst) == 0
    })
    .await;
    eventually("the budget to be released", || {
        backend.uploader.reserved_bytes() == 0
    })
    .await;

    assert!(backend.state.object("cancelled").is_none());
    assert_eq!(backend.state.calls().completes, 0);
}

#[tokio::test]
async fn limits_parts_in_flight() {
    let settings = UploadSettings {
        part_concurrency: 3,
        ..test_settings()
    };
    let backend = FakeBackend::new(settings);
    backend.state.faults().part_delay = Duration::from_millis(20);
    let data = pattern(20 * MIB as usize, 18);

    upload(&backend, "parallel", &data, PutOptions::default())
        .await
        .unwrap();

    assert_eq!(backend.state.max_parts_in_flight.load(Ordering::SeqCst), 3);
    assert_eq!(stored(&backend, "parallel"), data);
}

#[tokio::test]
async fn respects_the_backend_concurrency_limit() {
    let backend = FakeBackend::new(test_settings()).limits(UploadLimits {
        max_concurrency: 1,
        ..FAKE_LIMITS
    });
    backend.state.faults().part_delay = Duration::from_millis(5);
    let data = pattern(8 * MIB as usize, 19);

    upload(&backend, "sequential", &data, PutOptions::default())
        .await
        .unwrap();

    assert_eq!(backend.state.max_parts_in_flight.load(Ordering::SeqCst), 1);
    assert_eq!(stored(&backend, "sequential"), data);
}

#[tokio::test]
async fn stays_within_the_memory_budget() {
    let settings = UploadSettings {
        part_concurrency: 16,
        memory_budget_bytes: 4 * MIB,
        ..test_settings()
    };
    let backend = FakeBackend::new(settings);
    backend.state.faults().part_delay = Duration::from_millis(10);
    let data = pattern(24 * MIB as usize, 20);

    upload(&backend, "budgeted", &data, PutOptions::default())
        .await
        .unwrap();

    assert!(backend.uploader.peak_reserved_bytes() <= 4 * MIB);
    assert!(backend.state.max_bytes_in_flight.load(Ordering::SeqCst) <= 4 * MIB);
    assert!(backend.state.max_parts_in_flight.load(Ordering::SeqCst) >= 2);
    assert_eq!(backend.uploader.reserved_bytes(), 0);
}

#[tokio::test]
async fn shares_a_small_budget_between_many_uploads() {
    let settings = UploadSettings {
        memory_budget_bytes: 4 * MIB,
        ..test_settings()
    };
    let uploader = Arc::new(Uploader::new(settings));
    let backend = Arc::new(FakeBackend::with_uploader(uploader.clone()));
    backend.state.faults().part_delay = Duration::from_millis(2);

    let uploads = (0..32).map(|index| {
        let backend = backend.clone();
        tokio::spawn(async move {
            let data = pattern(3 * MIB as usize + index * 1000, index as u64);
            let key = format!("upload-{}", index);
            upload(&backend, &key, &data, PutOptions::default())
                .await
                .unwrap();
            assert_eq!(stored(&backend, &key), data);
        })
    });

    tokio::time::timeout(
        Duration::from_secs(60),
        futures::future::try_join_all(uploads),
    )
    .await
    .expect("uploads finished without deadlocking")
    .unwrap();

    assert!(uploader.peak_reserved_bytes() <= uploader.budget_bytes());
    assert!(backend.state.max_bytes_in_flight.load(Ordering::SeqCst) <= 4 * MIB);
    assert_eq!(uploader.reserved_bytes(), 0);
    assert_eq!(backend.state.calls().completes, 32);
}

#[tokio::test]
async fn fails_cleanly_when_the_object_needs_too_many_parts() {
    let backend = FakeBackend::new(test_settings()).limits(UploadLimits {
        max_parts: 4,
        max_part_size: 2 * MIB,
        ..FAKE_LIMITS
    });
    let data = pattern(20 * MIB as usize, 21);

    let error = upload(&backend, "too-many", &data, PutOptions::default())
        .await
        .unwrap_err();

    assert!(matches!(error, BackendError::TooLarge(_)), "{:?}", error);
    assert!(backend.state.object("too-many").is_none());
    assert_eq!(backend.state.calls().aborts, 1);
    assert_eq!(backend.uploader.reserved_bytes(), 0);
}

#[tokio::test]
async fn fails_cleanly_when_the_object_exceeds_the_maximum_size() {
    let backend = FakeBackend::new(test_settings()).limits(UploadLimits {
        max_object_size: 3 * MIB,
        ..FAKE_LIMITS
    });
    let data = pattern(4 * MIB as usize, 22);

    let error = upload(&backend, "too-big", &data, PutOptions::default())
        .await
        .unwrap_err();

    assert!(matches!(error, BackendError::TooLarge(_)), "{:?}", error);
    assert!(backend.state.object("too-big").is_none());
    assert_eq!(backend.state.calls().aborts, 1);
}

#[tokio::test]
async fn honours_part_alignment() {
    let backend = FakeBackend::new(UploadSettings {
        min_part_size: MIB + 5,
        ..test_settings()
    })
    .limits(UploadLimits {
        part_alignment: 256 * KIB,
        min_part_size: 256 * KIB,
        max_concurrency: 1,
        ..FAKE_LIMITS
    });
    let data = pattern(7 * MIB as usize + 3, 23);

    upload(&backend, "aligned", &data, PutOptions::default())
        .await
        .unwrap();

    let sizes = part_sizes(&backend);
    assert!(sizes[..sizes.len() - 1]
        .iter()
        .all(|size| size % (256 * KIB) == 0));
    assert_eq!(stored(&backend, "aligned"), data);
}

#[tokio::test]
async fn copies_through_a_stream_with_the_source_size_as_hint() {
    let backend = FakeBackend::new(test_settings());
    let data = pattern(5 * MIB as usize, 24);
    let opts = PutOptions {
        content_type: Some("text/plain".to_string()),
        metadata: HashMap::from([("a".to_string(), "b".to_string())]),
        size_hint: None,
    };
    upload(&backend, "source", &data, opts).await.unwrap();

    let copied = backend.copy_object("source", "dest").await.unwrap();

    assert_eq!(copied.size, data.len() as u64);
    assert_eq!(copied.content_type.as_deref(), Some("text/plain"));
    assert_eq!(copied.custom_metadata["a"], "b");
    assert_eq!(stored(&backend, "dest"), data);
    assert_eq!(
        backend.state.calls().size_hints.last(),
        Some(&Some(data.len() as u64))
    );
}

#[tokio::test]
async fn put_object_reports_the_streamed_size() {
    let backend = FakeBackend::new(test_settings());
    let data = pattern(2 * MIB as usize + 1, 25);

    let metadata = backend
        .put_object("plain", chunks_of(&data, 4096), None, HashMap::new())
        .await
        .unwrap();

    assert_eq!(metadata.size, data.len() as u64);
    assert_eq!(stored(&backend, "plain"), data);
}

fn trickling(byte_every: Duration) -> object_store_backends::ByteStream {
    Box::pin(futures::stream::unfold((), move |()| async move {
        tokio::time::sleep(byte_every).await;
        Some((Ok(bytes::Bytes::from_static(b"x")), ()))
    }))
}

#[tokio::test]
async fn trickling_uploads_do_not_hold_up_a_normal_upload() {
    let backend = Arc::new(FakeBackend::new(UploadSettings {
        memory_budget_bytes: 16 * MIB,
        ..test_settings()
    }));

    let tricklers: Vec<_> = (0..200)
        .map(|i| {
            let backend = backend.clone();
            tokio::spawn(async move {
                backend
                    .put_object_stream(
                        &format!("slow-{}", i),
                        trickling(Duration::from_millis(20)),
                        PutOptions::default(),
                    )
                    .await
            })
        })
        .collect();
    eventually("every trickling upload to hold a buffer", || {
        backend.uploader.reserved_bytes() >= 200 * 4 * KIB
    })
    .await;
    assert!(backend.uploader.reserved_bytes() <= 200 * 8 * KIB);

    let data = pattern(10 * MIB as usize, 26);
    tokio::time::timeout(
        Duration::from_secs(10),
        upload(&backend, "normal", &data, PutOptions::default()),
    )
    .await
    .expect("the normal upload must not wait on the trickling ones")
    .unwrap();
    assert_eq!(stored(&backend, "normal"), data);

    for trickler in &tricklers {
        trickler.abort();
    }
    for trickler in tricklers {
        let _ = trickler.await;
    }
    assert_eq!(backend.uploader.reserved_bytes(), 0);
}

#[tokio::test]
async fn reserves_little_for_a_small_upload() {
    for hint in [Some(1000), None] {
        let backend = FakeBackend::new(test_settings());
        let data = pattern(1000, 27);

        upload(&backend, "small", &data, hinted(hint))
            .await
            .unwrap();

        let peak = backend.uploader.peak_reserved_bytes();
        assert!(peak <= 4 * KIB, "hint {:?} reserved {} bytes", hint, peak);
        assert_eq!(backend.uploader.reserved_bytes(), 0);
    }

    let backend = FakeBackend::new(test_settings());
    upload(&backend, "small", &pattern(1000, 28), hinted(Some(1000)))
        .await
        .unwrap();
    assert_eq!(backend.uploader.peak_reserved_bytes(), KIB);
}

#[tokio::test]
async fn reserves_no_more_than_the_hint_for_a_short_part() {
    let backend = FakeBackend::new(test_settings());
    let data = pattern(MIB as usize + 300 * KIB as usize, 29);

    upload(&backend, "short", &data, hinted(Some(data.len() as u64)))
        .await
        .unwrap();

    assert_eq!(stored(&backend, "short"), data);
    assert!(
        backend.uploader.peak_reserved_bytes() <= data.len() as u64 + 2 * KIB,
        "reserved {} bytes",
        backend.uploader.peak_reserved_bytes()
    );
}
