mod zip_support;

use object_store::zip::{
    deflate_upper_bound, DeclaredSizes, EntryHeader, EntrySizes, Method, PathErrorReason,
    SizeField, ZipError, ZipWriter,
};
use zip_support::{parse_local_header, parse_trailer, Trailer, U32_SENTINEL};

const MAX32: u64 = 0xFFFF_FFFF;

fn known(path: &str, method: Method, sizes: EntrySizes) -> EntryHeader {
    EntryHeader {
        path: path.to_string(),
        method,
        sizes: DeclaredSizes::Known(sizes),
    }
}

fn unknown(path: &str, method: Method, max_uncompressed_size: u64) -> EntryHeader {
    EntryHeader {
        path: path.to_string(),
        method,
        sizes: DeclaredSizes::Unknown {
            max_uncompressed_size,
        },
    }
}

fn stored_sizes(size: u64) -> EntrySizes {
    EntrySizes {
        crc32: 0x1234_5678,
        compressed_size: size,
        uncompressed_size: size,
    }
}

fn add_entry(writer: &mut ZipWriter, header: EntryHeader, actual: EntrySizes) {
    writer.begin_entry(header).unwrap();
    writer.end_entry(actual).unwrap();
}

fn finish_and_parse(writer: ZipWriter) -> Trailer {
    let offset = writer.bytes_written();
    let bytes = writer.finish().unwrap();
    parse_trailer(&bytes, offset)
}

/// Adds a known-size stored entry "pad" sized so that the next entry starts at `offset`.
fn pad_to(writer: &mut ZipWriter, offset: u64) {
    let start = writer.bytes_written();
    let mut header_len = 30 + 3;
    if offset - start - header_len >= MAX32 {
        header_len += 20;
    }
    let size = offset - start - header_len;
    add_entry(
        writer,
        known("pad", Method::Stored, stored_sizes(size)),
        stored_sizes(size),
    );
    assert_eq!(writer.bytes_written(), offset);
}

#[test]
fn end_without_begin_is_an_error_and_leaves_writer_usable() {
    let mut writer = ZipWriter::new();
    assert_eq!(
        writer.end_entry(stored_sizes(0)).unwrap_err(),
        ZipError::NoOpenEntry
    );

    add_entry(
        &mut writer,
        known("a", Method::Stored, stored_sizes(1)),
        stored_sizes(1),
    );
    assert_eq!(finish_and_parse(writer).records.len(), 1);
}

#[test]
fn begin_twice_is_an_error_and_keeps_the_open_entry() {
    let mut writer = ZipWriter::new();
    writer
        .begin_entry(known("a", Method::Stored, stored_sizes(1)))
        .unwrap();
    let written = writer.bytes_written();

    assert_eq!(
        writer
            .begin_entry(known("b", Method::Stored, stored_sizes(1)))
            .unwrap_err(),
        ZipError::EntryAlreadyOpen {
            open: "a".to_string()
        }
    );
    assert_eq!(writer.bytes_written(), written);

    writer.end_entry(stored_sizes(1)).unwrap();
    let trailer = finish_and_parse(writer);
    assert_eq!(trailer.records.len(), 1);
    assert_eq!(trailer.records[0].path, "a");
}

#[test]
fn finish_with_open_entry_is_an_error() {
    let mut writer = ZipWriter::new();
    writer
        .begin_entry(unknown("a", Method::Deflate, 10))
        .unwrap();

    assert_eq!(
        writer.finish().unwrap_err(),
        ZipError::FinishWithOpenEntry {
            open: "a".to_string()
        }
    );
}

#[test]
fn invalid_path_is_rejected_before_any_bytes() {
    let mut writer = ZipWriter::new();

    for path in ["../evil", "/abs", "a\\b", "dir/", ""] {
        let error = writer
            .begin_entry(known(path, Method::Stored, stored_sizes(0)))
            .unwrap_err();
        assert!(
            matches!(&error, ZipError::InvalidPath(e) if e.path == path),
            "{path}: {error:?}"
        );
        assert_eq!(writer.bytes_written(), 0);
    }

    add_entry(
        &mut writer,
        known("ok", Method::Stored, stored_sizes(0)),
        stored_sizes(0),
    );
}

#[test]
fn known_sizes_mismatch_is_an_error_and_poisons_the_writer() {
    let declared = EntrySizes {
        crc32: 1,
        compressed_size: 10,
        uncompressed_size: 20,
    };

    let mut writer = ZipWriter::new();
    writer
        .begin_entry(known("a", Method::Deflate, declared))
        .unwrap();
    let actual = EntrySizes {
        compressed_size: 11,
        ..declared
    };
    assert_eq!(
        writer.end_entry(actual).unwrap_err(),
        ZipError::SizeMismatch {
            path: "a".to_string(),
            declared,
            actual
        }
    );
    assert!(writer.end_entry(actual).unwrap_err() == ZipError::Poisoned);
    assert_eq!(
        writer
            .begin_entry(known("b", Method::Stored, stored_sizes(1)))
            .unwrap_err(),
        ZipError::Poisoned
    );
    assert_eq!(writer.finish().unwrap_err(), ZipError::Poisoned);

    let mut writer = ZipWriter::new();
    writer
        .begin_entry(known("a", Method::Deflate, declared))
        .unwrap();
    let error = writer
        .end_entry(EntrySizes {
            uncompressed_size: 19,
            ..declared
        })
        .unwrap_err();
    assert!(matches!(error, ZipError::SizeMismatch { .. }));
    assert!(error.is_data_mismatch());
}

#[test]
fn known_crc_mismatch_is_reported_separately() {
    let declared = stored_sizes(5);
    let mut writer = ZipWriter::new();
    writer
        .begin_entry(known("a", Method::Stored, declared))
        .unwrap();

    let error = writer
        .end_entry(EntrySizes {
            crc32: 0xffff_0000,
            ..declared
        })
        .unwrap_err();
    assert_eq!(
        error,
        ZipError::CrcMismatch {
            path: "a".to_string(),
            declared: 0x1234_5678,
            actual: 0xffff_0000
        }
    );
    assert!(error.is_data_mismatch());
}

#[test]
fn stored_entries_must_have_equal_sizes() {
    let mut writer = ZipWriter::new();
    let uneven = EntrySizes {
        crc32: 0,
        compressed_size: 4,
        uncompressed_size: 5,
    };

    assert!(matches!(
        writer.begin_entry(known("a", Method::Stored, uneven)),
        Err(ZipError::StoredSizesDiffer { .. })
    ));
    assert_eq!(writer.bytes_written(), 0);

    writer.begin_entry(unknown("a", Method::Stored, 5)).unwrap();
    assert!(matches!(
        writer.end_entry(uneven),
        Err(ZipError::StoredSizesDiffer { .. })
    ));
}

#[test]
fn actual_size_above_declared_bound_is_an_error() {
    let mut writer = ZipWriter::new();
    writer
        .begin_entry(unknown("a", Method::Stored, 100))
        .unwrap();
    assert_eq!(
        writer.end_entry(stored_sizes(101)).unwrap_err(),
        ZipError::ExceedsDeclaredBound {
            path: "a".to_string(),
            field: SizeField::Uncompressed,
            bound: 100,
            actual: 101
        }
    );

    let mut writer = ZipWriter::new();
    writer
        .begin_entry(unknown("a", Method::Deflate, 100))
        .unwrap();
    let bound = deflate_upper_bound(100);
    assert_eq!(
        writer
            .end_entry(EntrySizes {
                crc32: 0,
                compressed_size: bound + 1,
                uncompressed_size: 100
            })
            .unwrap_err(),
        ZipError::ExceedsDeclaredBound {
            path: "a".to_string(),
            field: SizeField::Compressed,
            bound,
            actual: bound + 1
        }
    );

    let mut writer = ZipWriter::new();
    writer
        .begin_entry(unknown("a", Method::Deflate, 100))
        .unwrap();
    writer
        .end_entry(EntrySizes {
            crc32: 0,
            compressed_size: bound,
            uncompressed_size: 100,
        })
        .unwrap();
}

#[test]
fn entry_that_would_have_needed_zip64_but_declared_less_is_rejected() {
    let mut writer = ZipWriter::new();
    let header = writer
        .begin_entry(unknown("a", Method::Stored, MAX32 - 1))
        .unwrap();
    assert_eq!(parse_local_header(&header).extra, Vec::<u8>::new());

    assert!(matches!(
        writer.end_entry(stored_sizes(MAX32)),
        Err(ZipError::ExceedsDeclaredBound {
            field: SizeField::Uncompressed,
            ..
        })
    ));
}

#[test]
fn offsets_overflowing_u64_are_errors_not_wraparounds() {
    let mut writer = ZipWriter::new();
    let huge = stored_sizes(u64::MAX - 10);
    writer
        .begin_entry(known("a", Method::Stored, huge))
        .unwrap();
    assert_eq!(
        writer.end_entry(huge).unwrap_err(),
        ZipError::ArchiveTooLarge
    );
    assert_eq!(writer.finish().unwrap_err(), ZipError::Poisoned);

    let half = stored_sizes(u64::MAX / 2);
    let mut writer = ZipWriter::new();
    add_entry(&mut writer, known("a", Method::Stored, half), half);
    writer
        .begin_entry(known("b", Method::Stored, half))
        .unwrap();
    assert_eq!(
        writer.end_entry(half).unwrap_err(),
        ZipError::ArchiveTooLarge
    );

    let mut writer = ZipWriter::new();
    pad_to(&mut writer, u64::MAX - 30);
    assert_eq!(
        writer
            .begin_entry(known("b", Method::Stored, stored_sizes(0)))
            .unwrap_err(),
        ZipError::ArchiveTooLarge
    );
    assert_eq!(writer.bytes_written(), u64::MAX - 30);
    assert_eq!(writer.finish().unwrap_err(), ZipError::ArchiveTooLarge);

    let mut writer = ZipWriter::new();
    pad_to(&mut writer, u64::MAX - 100);
    assert_eq!(writer.finish().unwrap_err(), ZipError::ArchiveTooLarge);
}

#[test]
fn duplicate_and_colliding_paths_fail_finish() {
    for (first, second, expected) in [
        ("a.txt", "a.txt", PathErrorReason::Duplicate),
        (
            "Readme.md",
            "README.md",
            PathErrorReason::CaseCollision {
                other: "Readme.md".to_string(),
            },
        ),
        (
            "a",
            "a/b",
            PathErrorReason::FileDirectoryConflict {
                other: "a".to_string(),
            },
        ),
    ] {
        let mut writer = ZipWriter::new();
        add_entry(
            &mut writer,
            known(first, Method::Stored, stored_sizes(0)),
            stored_sizes(0),
        );
        add_entry(
            &mut writer,
            known(second, Method::Stored, stored_sizes(0)),
            stored_sizes(0),
        );

        match writer.finish().unwrap_err() {
            ZipError::InvalidPath(error) => {
                assert_eq!(error.path, second);
                assert_eq!(error.reason, expected);
                assert!(error.reason.is_conflict());
            }
            other => panic!("unexpected {other:?}"),
        }
    }
}

#[test]
fn chunked_trailer_matches_finish() {
    let build = || {
        let mut writer = ZipWriter::new();
        for index in 0..500 {
            add_entry(
                &mut writer,
                known(
                    &format!("dir/{index:04}.txt"),
                    Method::Stored,
                    stored_sizes(index),
                ),
                stored_sizes(index),
            );
        }
        writer
    };

    let whole = build().finish().unwrap();

    for chunk_size in [0, 1, 50, 64, 1000, 4096, whole.len(), usize::MAX] {
        let trailer = build().finish_chunked(chunk_size).unwrap();
        assert_eq!(trailer.total_len(), whole.len() as u64);

        let chunks: Vec<_> = trailer.collect();
        assert!(chunks.iter().all(|chunk| !chunk.is_empty()));
        assert!(chunks
            .iter()
            .all(|chunk| chunk.len() <= chunk_size.max(1).saturating_add(98 + 100)));
        assert_eq!(chunks.concat(), whole.to_vec(), "chunk size {chunk_size}");
    }
}

#[test]
fn bytes_written_tracks_headers_data_and_descriptors() {
    let mut writer = ZipWriter::new();
    let header = writer
        .begin_entry(unknown("abc", Method::Deflate, 1000))
        .unwrap();
    assert_eq!(header.len(), 33);
    assert_eq!(writer.bytes_written(), 33);

    let descriptor = writer
        .end_entry(EntrySizes {
            crc32: 9,
            compressed_size: 400,
            uncompressed_size: 1000,
        })
        .unwrap();
    assert_eq!(descriptor.len(), 16);
    assert_eq!(writer.bytes_written(), 33 + 400 + 16);
    assert_eq!(writer.entry_count(), 1);

    let trailer = finish_and_parse(writer);
    assert_eq!(trailer.records[0].crc32, 9);
    assert_eq!(trailer.records[0].compressed_size, 400);
    assert_eq!(trailer.records[0].uncompressed_size, 1000);
}

#[test]
fn local_header_offset_boundaries() {
    for (offset, zip64) in [
        (MAX32 - 1, false),
        (MAX32, true),
        (MAX32 + 1, true),
        (1 << 40, true),
    ] {
        let mut writer = ZipWriter::new();
        pad_to(&mut writer, offset);

        let header = parse_local_header(
            &writer
                .begin_entry(known("next", Method::Stored, stored_sizes(3)))
                .unwrap(),
        );
        writer.end_entry(stored_sizes(3)).unwrap();

        let descriptor_offset = writer.bytes_written();
        let streamed = parse_local_header(
            &writer
                .begin_entry(unknown("streamed", Method::Deflate, 1000))
                .unwrap(),
        );
        let descriptor = writer
            .end_entry(EntrySizes {
                crc32: 7,
                compressed_size: 0,
                uncompressed_size: 0,
            })
            .unwrap();

        for header in [&header, &streamed] {
            assert!(header.extra.is_empty(), "{offset:#x}");
            assert_eq!(header.version_needed, 20, "{offset:#x}");
        }
        assert_eq!(header.compressed_size, 3);
        assert_eq!(descriptor.len(), 16, "{offset:#x}");

        assert!(descriptor_offset >= MAX32);
        let trailer = finish_and_parse(writer);
        for (record, offset, zip64) in [
            (&trailer.records[1], offset, zip64),
            (&trailer.records[2], descriptor_offset, true),
        ] {
            assert_eq!(record.local_header_offset, offset);
            assert_eq!(record.version_needed, if zip64 { 45 } else { 20 });
            assert_eq!(record.version_made_by & 0xff, record.version_needed);
            assert_eq!(record.version_made_by >> 8, 3);
            if zip64 {
                assert_eq!(record.raw_local_header_offset, U32_SENTINEL);
                assert_eq!(record.zip64_fields, vec![offset]);
            } else {
                assert_eq!(record.raw_local_header_offset, offset as u32);
                assert!(record.extra.is_empty());
            }
        }
        let record = &trailer.records[1];
        assert_eq!(record.path, "next");
        assert_eq!(record.raw_compressed_size, 3);
        assert_eq!(record.raw_uncompressed_size, 3);

        assert!(
            trailer.zip64.is_some(),
            "central directory starts past 4 GiB"
        );
    }
}

#[test]
fn known_size_boundaries() {
    for (size, zip64) in [(MAX32 - 1, false), (MAX32, true), (MAX32 + 1, true)] {
        let mut writer = ZipWriter::new();
        let header = parse_local_header(
            &writer
                .begin_entry(known("a", Method::Stored, stored_sizes(size)))
                .unwrap(),
        );
        assert!(writer.end_entry(stored_sizes(size)).unwrap().is_empty());

        assert_eq!(header.extra.len(), if zip64 { 20 } else { 0 }, "{size:#x}");
        assert_eq!(header.crc32, 0x1234_5678);
        assert_eq!(header.flags, 0x0800);

        let trailer = finish_and_parse(writer);
        let record = &trailer.records[0];
        assert_eq!(record.uncompressed_size, size);
        assert_eq!(record.compressed_size, size);
        assert_eq!(record.local_header_offset, 0);
        if zip64 {
            assert_eq!(record.raw_uncompressed_size, U32_SENTINEL);
            assert_eq!(record.raw_compressed_size, U32_SENTINEL);
            assert_eq!(record.zip64_fields, vec![size, size]);
            assert_eq!(record.version_needed, 45);
        } else {
            assert!(record.extra.is_empty());
            assert_eq!(record.version_needed, 20);
        }
    }
}

#[test]
fn only_the_overflowing_central_fields_are_in_the_zip64_extra() {
    let mut writer = ZipWriter::new();
    add_entry(
        &mut writer,
        known(
            "deflated",
            Method::Deflate,
            EntrySizes {
                crc32: 1,
                compressed_size: 1000,
                uncompressed_size: MAX32,
            },
        ),
        EntrySizes {
            crc32: 1,
            compressed_size: 1000,
            uncompressed_size: MAX32,
        },
    );
    pad_to(&mut writer, 1 << 33);
    add_entry(
        &mut writer,
        known("late", Method::Stored, stored_sizes(MAX32)),
        stored_sizes(MAX32),
    );

    let trailer = finish_and_parse(writer);

    let deflated = &trailer.records[0];
    assert_eq!(deflated.raw_uncompressed_size, U32_SENTINEL);
    assert_eq!(deflated.raw_compressed_size, 1000);
    assert_eq!(deflated.raw_local_header_offset, 0);
    assert_eq!(deflated.zip64_fields, vec![MAX32]);

    let late = &trailer.records[2];
    assert_eq!(late.zip64_fields, vec![MAX32, MAX32, 1 << 33]);
}

#[test]
fn unknown_size_bound_boundaries() {
    for (max, zip64) in [(MAX32 - 1, false), (MAX32, true)] {
        let mut writer = ZipWriter::new();
        let header = parse_local_header(
            &writer
                .begin_entry(unknown("a", Method::Stored, max))
                .unwrap(),
        );
        assert_eq!(header.extra.len(), if zip64 { 20 } else { 0 });
    }

    let mut largest_small = 0u64;
    let mut high = MAX32;
    while largest_small < high {
        let mid = largest_small + (high - largest_small).div_ceil(2);
        if deflate_upper_bound(mid) < MAX32 {
            largest_small = mid;
        } else {
            high = mid - 1;
        }
    }
    assert!(deflate_upper_bound(largest_small) < MAX32);
    assert!(deflate_upper_bound(largest_small + 1) >= MAX32);

    for (max, zip64) in [(largest_small, false), (largest_small + 1, true)] {
        let mut writer = ZipWriter::new();
        let header = parse_local_header(
            &writer
                .begin_entry(unknown("a", Method::Deflate, max))
                .unwrap(),
        );
        assert_eq!(header.extra.len(), if zip64 { 20 } else { 0 }, "{max}");
        assert_eq!(header.flags, 0x0808);
        assert_eq!(header.crc32, 0);

        let actual = EntrySizes {
            crc32: 5,
            compressed_size: 10,
            uncompressed_size: 20,
        };
        let descriptor = writer.end_entry(actual).unwrap();
        assert_eq!(descriptor.len(), if zip64 { 24 } else { 16 });

        let trailer = finish_and_parse(writer);
        let record = &trailer.records[0];
        assert!(
            record.extra.is_empty(),
            "small actual sizes need no ZIP64 in the CD"
        );
        assert_eq!(record.version_needed, if zip64 { 45 } else { 20 });
    }
}

#[test]
fn central_directory_offset_boundaries() {
    for (offset, zip64) in [(MAX32 - 1, false), (MAX32, true), (MAX32 + 1, true)] {
        let mut writer = ZipWriter::new();
        pad_to(&mut writer, offset);

        let trailer = finish_and_parse(writer);
        assert_eq!(trailer.zip64.is_some(), zip64, "{offset:#x}");
        assert_eq!(trailer.records[0].local_header_offset, 0);
        if zip64 {
            assert_eq!(trailer.end.central_directory_offset, U32_SENTINEL);
            let zip64 = trailer.zip64.unwrap();
            assert_eq!(zip64.central_directory_offset, offset);
            assert_eq!(zip64.entries, 1);
            assert_eq!(trailer.end.entries, 1);
        } else {
            assert_eq!(trailer.end.central_directory_offset, offset as u32);
        }
    }
}

#[test]
fn entry_count_boundaries() {
    for (count, zip64) in [(0xFFFEu64, false), (0xFFFF, true), (0x1_0000, true)] {
        let mut writer = ZipWriter::new();
        for index in 0..count {
            add_entry(
                &mut writer,
                known(&format!("{index:05x}"), Method::Stored, stored_sizes(0)),
                stored_sizes(0),
            );
        }

        let trailer = finish_and_parse(writer);
        assert_eq!(trailer.records.len() as u64, count);
        assert_eq!(trailer.zip64.is_some(), zip64, "{count:#x}");
        if zip64 {
            assert_eq!(trailer.end.entries, 0xFFFF);
            assert_eq!(trailer.zip64.unwrap().entries, count);
            assert_ne!(trailer.end.central_directory_offset, U32_SENTINEL);
        } else {
            assert_eq!(trailer.end.entries, count as u16);
        }
    }
}
