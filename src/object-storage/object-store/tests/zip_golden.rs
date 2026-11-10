mod zip_support;

use std::fs;

use object_store::zip::{DeclaredSizes, EntryHeader, EntrySizes, Method, ZipWriter};
use sha2::{Digest, Sha256};
use zip_support::{build_archive, deflate_raw, fixture_path, mixed_entries};

const HELLO_CRC32: [u8; 4] = [0x86, 0xa6, 0x10, 0x36];
const HELLO_DEFLATED: [u8; 7] = [0xcb, 0x48, 0xcd, 0xc9, 0xc9, 0x07, 0x00];
const MIXED_FIXTURE_SHA256: &str =
    "86fba275947fa5b6d4a073924d1ceb2c3edeae168ef1c2f6aea5d065c954045b";

fn concat(parts: &[&[u8]]) -> Vec<u8> {
    parts.concat()
}

#[test]
fn empty_archive_is_a_bare_end_of_central_directory_record() {
    let bytes = ZipWriter::new().finish().unwrap();

    #[rustfmt::skip]
    let expected: [u8; 22] = [
        0x50, 0x4b, 0x05, 0x06, // EOCD signature
        0x00, 0x00,             // this disk
        0x00, 0x00,             // central directory disk
        0x00, 0x00,             // entries on this disk
        0x00, 0x00,             // entries total
        0x00, 0x00, 0x00, 0x00, // central directory size
        0x00, 0x00, 0x00, 0x00, // central directory offset
        0x00, 0x00,             // comment length
    ];

    assert_eq!(&bytes[..], &expected);
}

#[test]
fn stored_entry_with_known_sizes() {
    let mut writer = ZipWriter::new();
    let header = writer
        .begin_entry(EntryHeader {
            path: "a.txt".to_string(),
            method: Method::Stored,
            sizes: DeclaredSizes::Known(EntrySizes::stored(b"hello")),
        })
        .unwrap();
    let descriptor = writer.end_entry(EntrySizes::stored(b"hello")).unwrap();
    assert!(descriptor.is_empty());
    assert_eq!(writer.bytes_written(), 40);
    let trailer = writer.finish().unwrap();

    #[rustfmt::skip]
    let expected_header = concat(&[
        &[0x50, 0x4b, 0x03, 0x04], // local file header signature
        &[0x14, 0x00],             // version needed: 2.0
        &[0x00, 0x08],             // flags: bit 11 (UTF-8)
        &[0x00, 0x00],             // method: stored
        &[0x00, 0x00],             // time 00:00:00
        &[0x21, 0x00],             // date 1980-01-01
        &HELLO_CRC32,
        &[0x05, 0x00, 0x00, 0x00], // compressed size
        &[0x05, 0x00, 0x00, 0x00], // uncompressed size
        &[0x05, 0x00],             // name length
        &[0x00, 0x00],             // extra length
        b"a.txt",
    ]);

    #[rustfmt::skip]
    let expected_trailer = concat(&[
        &[0x50, 0x4b, 0x01, 0x02], // central directory header signature
        &[0x14, 0x03],             // made by: Unix, 2.0
        &[0x14, 0x00],             // version needed: 2.0
        &[0x00, 0x08],             // flags: bit 11 (UTF-8)
        &[0x00, 0x00],             // method: stored
        &[0x00, 0x00],             // time
        &[0x21, 0x00],             // date
        &HELLO_CRC32,
        &[0x05, 0x00, 0x00, 0x00], // compressed size
        &[0x05, 0x00, 0x00, 0x00], // uncompressed size
        &[0x05, 0x00],             // name length
        &[0x00, 0x00],             // extra length
        &[0x00, 0x00],             // comment length
        &[0x00, 0x00],             // disk number start
        &[0x00, 0x00],             // internal attributes
        &[0x00, 0x00, 0xa4, 0x81], // external attributes: 0o100644 << 16
        &[0x00, 0x00, 0x00, 0x00], // local header offset
        b"a.txt",
        &[0x50, 0x4b, 0x05, 0x06], // EOCD signature
        &[0x00, 0x00, 0x00, 0x00], // disks
        &[0x01, 0x00, 0x01, 0x00], // entries on disk, total
        &[0x33, 0x00, 0x00, 0x00], // central directory size: 46 + 5
        &[0x28, 0x00, 0x00, 0x00], // central directory offset: 30 + 5 + 5
        &[0x00, 0x00],             // comment length
    ]);

    assert_eq!(&header[..], &expected_header[..]);
    assert_eq!(&trailer[..], &expected_trailer[..]);
}

#[test]
fn deflate_entry_with_data_descriptor() {
    assert_eq!(
        deflate_raw(b"hello", 6),
        HELLO_DEFLATED,
        "flate2 must use the deterministic miniz_oxide backend"
    );

    let sizes = EntrySizes::deflated(b"hello", HELLO_DEFLATED.len() as u64);
    let mut writer = ZipWriter::new();
    let header = writer
        .begin_entry(EntryHeader {
            path: "a.txt".to_string(),
            method: Method::Deflate,
            sizes: DeclaredSizes::Unknown {
                max_uncompressed_size: 5,
            },
        })
        .unwrap();
    let descriptor = writer.end_entry(sizes).unwrap();
    assert_eq!(writer.bytes_written(), 35 + 7 + 16);
    let trailer = writer.finish().unwrap();

    #[rustfmt::skip]
    let expected_header = concat(&[
        &[0x50, 0x4b, 0x03, 0x04],
        &[0x14, 0x00],             // version needed: 2.0
        &[0x08, 0x08],             // flags: bit 3 (data descriptor) | bit 11 (UTF-8)
        &[0x08, 0x00],             // method: deflate
        &[0x00, 0x00],
        &[0x21, 0x00],
        &[0x00, 0x00, 0x00, 0x00], // CRC-32 deferred to the descriptor
        &[0x00, 0x00, 0x00, 0x00], // compressed size deferred
        &[0x00, 0x00, 0x00, 0x00], // uncompressed size deferred
        &[0x05, 0x00],
        &[0x00, 0x00],
        b"a.txt",
    ]);

    #[rustfmt::skip]
    let expected_descriptor = concat(&[
        &[0x50, 0x4b, 0x07, 0x08], // data descriptor signature
        &HELLO_CRC32,
        &[0x07, 0x00, 0x00, 0x00], // compressed size
        &[0x05, 0x00, 0x00, 0x00], // uncompressed size
    ]);

    #[rustfmt::skip]
    let expected_trailer = concat(&[
        &[0x50, 0x4b, 0x01, 0x02],
        &[0x14, 0x03],
        &[0x14, 0x00],
        &[0x08, 0x08],
        &[0x08, 0x00],
        &[0x00, 0x00],
        &[0x21, 0x00],
        &HELLO_CRC32,
        &[0x07, 0x00, 0x00, 0x00],
        &[0x05, 0x00, 0x00, 0x00],
        &[0x05, 0x00],
        &[0x00, 0x00],
        &[0x00, 0x00],
        &[0x00, 0x00],
        &[0x00, 0x00],
        &[0x00, 0x00, 0xa4, 0x81],
        &[0x00, 0x00, 0x00, 0x00],
        b"a.txt",
        &[0x50, 0x4b, 0x05, 0x06],
        &[0x00, 0x00, 0x00, 0x00],
        &[0x01, 0x00, 0x01, 0x00],
        &[0x33, 0x00, 0x00, 0x00], // central directory size: 46 + 5
        &[0x3a, 0x00, 0x00, 0x00], // central directory offset: 35 + 7 + 16
        &[0x00, 0x00],
    ]);

    assert_eq!(&header[..], &expected_header[..]);
    assert_eq!(&descriptor[..], &expected_descriptor[..]);
    assert_eq!(&trailer[..], &expected_trailer[..]);
}

#[test]
fn zip64_entry_header_descriptor_and_trailer() {
    let size = 0x1_0000_0000u64;
    let sizes = EntrySizes {
        crc32: 0xdead_beef,
        compressed_size: size,
        uncompressed_size: size,
    };

    let mut writer = ZipWriter::new();
    let header = writer
        .begin_entry(EntryHeader {
            path: "big.bin".to_string(),
            method: Method::Stored,
            sizes: DeclaredSizes::Unknown {
                max_uncompressed_size: size,
            },
        })
        .unwrap();
    let descriptor = writer.end_entry(sizes).unwrap();
    assert_eq!(writer.bytes_written(), 57 + size + 24);
    let trailer = writer.finish().unwrap();

    #[rustfmt::skip]
    let expected_header = concat(&[
        &[0x50, 0x4b, 0x03, 0x04],
        &[0x2d, 0x00],             // version needed: 4.5 (ZIP64)
        &[0x08, 0x08],             // flags: bit 3 | bit 11
        &[0x00, 0x00],             // method: stored
        &[0x00, 0x00],
        &[0x21, 0x00],
        &[0x00, 0x00, 0x00, 0x00], // CRC-32 deferred
        &[0xff, 0xff, 0xff, 0xff], // compressed size: in ZIP64 extra
        &[0xff, 0xff, 0xff, 0xff], // uncompressed size: in ZIP64 extra
        &[0x07, 0x00],             // name length
        &[0x14, 0x00],             // extra length: 20
        b"big.bin",
        &[0x01, 0x00, 0x10, 0x00], // ZIP64 extra tag, 16 bytes
        &[0x00; 8],                // uncompressed size deferred
        &[0x00; 8],                // compressed size deferred
    ]);

    #[rustfmt::skip]
    let expected_descriptor = concat(&[
        &[0x50, 0x4b, 0x07, 0x08],
        &[0xef, 0xbe, 0xad, 0xde],
        &[0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00], // compressed size (8 bytes)
        &[0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00], // uncompressed size (8 bytes)
    ]);

    #[rustfmt::skip]
    let expected_trailer = concat(&[
        &[0x50, 0x4b, 0x01, 0x02],
        &[0x2d, 0x03],             // made by: Unix, 4.5
        &[0x2d, 0x00],             // version needed: 4.5
        &[0x08, 0x08],
        &[0x00, 0x00],
        &[0x00, 0x00],
        &[0x21, 0x00],
        &[0xef, 0xbe, 0xad, 0xde],
        &[0xff, 0xff, 0xff, 0xff], // compressed size: in ZIP64 extra
        &[0xff, 0xff, 0xff, 0xff], // uncompressed size: in ZIP64 extra
        &[0x07, 0x00],
        &[0x14, 0x00],             // extra length: 4 + 2 * 8
        &[0x00, 0x00],
        &[0x00, 0x00],
        &[0x00, 0x00],
        &[0x00, 0x00, 0xa4, 0x81],
        &[0x00, 0x00, 0x00, 0x00], // local header offset 0 fits, so it is not in the extra
        b"big.bin",
        &[0x01, 0x00, 0x10, 0x00],
        &[0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00], // uncompressed first
        &[0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00], // then compressed
        // ZIP64 end of central directory record at 0x1_0000_0051 + 0x49
        &[0x50, 0x4b, 0x06, 0x06],
        &[0x2c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // remaining record size: 44
        &[0x2d, 0x03],             // made by
        &[0x2d, 0x00],             // version needed
        &[0x00, 0x00, 0x00, 0x00], // this disk
        &[0x00, 0x00, 0x00, 0x00], // central directory disk
        &[0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // entries on disk
        &[0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // entries total
        &[0x49, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // central directory size: 46 + 7 + 20
        &[0x51, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00], // central directory offset
        // ZIP64 end of central directory locator
        &[0x50, 0x4b, 0x06, 0x07],
        &[0x00, 0x00, 0x00, 0x00],
        &[0x9a, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00], // ZIP64 EOCD record offset
        &[0x01, 0x00, 0x00, 0x00], // total disks
        // End of central directory record
        &[0x50, 0x4b, 0x05, 0x06],
        &[0x00, 0x00, 0x00, 0x00],
        &[0x01, 0x00, 0x01, 0x00], // entry counts fit
        &[0x49, 0x00, 0x00, 0x00], // central directory size fits
        &[0xff, 0xff, 0xff, 0xff], // central directory offset: in ZIP64 record
        &[0x00, 0x00],
    ]);

    assert_eq!(&header[..], &expected_header[..]);
    assert_eq!(&descriptor[..], &expected_descriptor[..]);
    assert_eq!(&trailer[..], &expected_trailer[..]);
}

#[test]
fn zip64_header_with_known_sizes_carries_them_in_the_extra() {
    let sizes = EntrySizes {
        crc32: 0x0102_0304,
        compressed_size: 0x1_2345_6789,
        uncompressed_size: 0x2_0000_0000,
    };

    let mut writer = ZipWriter::new();
    let header = writer
        .begin_entry(EntryHeader {
            path: "x".to_string(),
            method: Method::Deflate,
            sizes: DeclaredSizes::Known(sizes),
        })
        .unwrap();

    #[rustfmt::skip]
    let expected_header = concat(&[
        &[0x50, 0x4b, 0x03, 0x04],
        &[0x2d, 0x00],
        &[0x00, 0x08],             // flags: bit 11 only, no data descriptor
        &[0x08, 0x00],
        &[0x00, 0x00],
        &[0x21, 0x00],
        &[0x04, 0x03, 0x02, 0x01], // CRC-32 in the header
        &[0xff, 0xff, 0xff, 0xff],
        &[0xff, 0xff, 0xff, 0xff],
        &[0x01, 0x00],
        &[0x14, 0x00],
        b"x",
        &[0x01, 0x00, 0x10, 0x00],
        &[0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00], // uncompressed
        &[0x89, 0x67, 0x45, 0x23, 0x01, 0x00, 0x00, 0x00], // compressed
    ]);

    assert_eq!(&header[..], &expected_header[..]);
    assert!(writer.end_entry(sizes).unwrap().is_empty());
}

#[test]
fn building_twice_is_byte_identical() {
    let entries = mixed_entries();
    assert_eq!(build_archive(&entries), build_archive(&entries));
}

#[test]
fn mixed_fixture_is_stable() {
    let bytes = build_archive(&mixed_entries());
    let path = fixture_path("mixed.zip");

    if std::env::var_os("UPDATE_ZIP_FIXTURES").is_some() {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, &bytes).unwrap();
    }

    assert_eq!(hex::encode(Sha256::digest(&bytes)), MIXED_FIXTURE_SHA256);
    assert_eq!(fs::read(&path).unwrap(), bytes);
}
