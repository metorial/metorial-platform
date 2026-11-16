mod zip_support;

use std::io::{Cursor, Read, Write};

use flate2::read::DeflateDecoder;
use flate2::write::DeflateEncoder;
use flate2::Compression;
use object_store::zip::{
    archive_size_upper_bound, deflate_block, deflate_block_upper_bound, deflate_upper_bound,
    Method, DEFLATE_BLOCK_BYTES,
};
use proptest::prelude::*;
use zip::CompressionMethod;
use zip_support::{build_archive, deflate_raw, mixed_entries, TestEntry, TestRng};

fn assert_reads_back(bytes: &[u8], entries: &[TestEntry]) {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
    assert_eq!(archive.len(), entries.len());

    for (index, expected) in entries.iter().enumerate() {
        let mut file = archive.by_index(index).unwrap();
        assert_eq!(file.name().unwrap(), expected.path);
        assert_eq!(
            file.compression(),
            match expected.method {
                Method::Stored => CompressionMethod::Stored,
                Method::Deflate => CompressionMethod::Deflated,
            }
        );
        assert_eq!(file.size(), expected.data.len() as u64);
        assert_eq!(file.crc32(), crc32fast::hash(&expected.data));
        assert_eq!(file.unix_mode(), Some(0o100644));
        assert!(!file.is_dir());

        let mut contents = Vec::new();
        file.read_to_end(&mut contents).unwrap();
        assert_eq!(contents, expected.data, "{}", expected.path);
    }
}

fn random_entries(rng: &mut TestRng, count: usize) -> Vec<TestEntry> {
    let names = [
        "SKILL.md",
        "README",
        "データ.json",
        "émoji 🎉.txt",
        ".hidden",
        "a b c",
    ];

    (0..count)
        .map(|index| {
            let len = match rng.below(4) {
                0 => 0,
                1 => rng.below(64) as usize,
                _ => rng.below(20_000) as usize,
            };
            let data = if rng.below(2) == 0 {
                rng.bytes(len)
            } else {
                "abcabcabd".repeat(len / 9 + 1).into_bytes()[..len].to_vec()
            };
            let method = if rng.below(2) == 0 {
                Method::Stored
            } else {
                Method::Deflate
            };
            let path = format!(
                "dir{}/{index:04}-{}",
                rng.below(5),
                names[rng.below(names.len() as u64) as usize]
            );

            TestEntry::new(&path, data, method, rng.below(2) == 0)
        })
        .collect()
}

#[test]
fn mixed_archive_round_trips() {
    let entries = mixed_entries();
    assert_reads_back(&build_archive(&entries), &entries);
}

#[test]
fn many_random_entries_round_trip() {
    let mut rng = TestRng::new(42);
    let entries = random_entries(&mut rng, 400);
    let bytes = build_archive(&entries);

    assert_reads_back(&bytes, &entries);
    assert!(
        archive_size_upper_bound(
            entries
                .iter()
                .map(|entry| (entry.path.len(), entry.data.len() as u64))
        ) >= bytes.len() as u64
    );
}

#[test]
fn seventy_thousand_entries_round_trip() {
    let entries: Vec<_> = (0..70_000)
        .map(|index| {
            TestEntry::new(
                &format!("d{}/{index:05}.txt", index % 7),
                format!("{index}"),
                if index % 2 == 0 {
                    Method::Stored
                } else {
                    Method::Deflate
                },
                index % 3 != 0,
            )
        })
        .collect();

    assert_reads_back(&build_archive(&entries), &entries);
}

#[test]
fn deflate_bound_holds_at_every_level_for_incompressible_data() {
    let mut rng = TestRng::new(1);

    for len in [0usize, 1, 100, 65_535, 65_536, 1 << 20] {
        let random = rng.bytes(len);
        for level in 0..=9 {
            let compressed = deflate_raw(&random, level);
            assert!(
                compressed.len() as u64 <= deflate_upper_bound(len as u64),
                "len {len} level {level}: {} bytes",
                compressed.len()
            );
        }
    }
}

#[test]
fn deflate_bound_holds_with_a_sync_flush_per_chunk() {
    let mut rng = TestRng::new(2);
    let data = rng.bytes(4 << 20);

    for chunk_size in [64 << 10, 1 << 20] {
        let mut encoder = DeflateEncoder::new(Vec::new(), Compression::new(6));
        for chunk in data.chunks(chunk_size) {
            encoder.write_all(chunk).unwrap();
            encoder.flush().unwrap();
        }
        let compressed = encoder.finish().unwrap();
        assert!(compressed.len() as u64 <= deflate_upper_bound(data.len() as u64));
    }
}

fn deflate_input() -> impl Strategy<Value = Vec<u8>> {
    prop_oneof![
        proptest::collection::vec(any::<u8>(), 0..(1 << 20)),
        (0usize..(1 << 20)).prop_map(|len| vec![0; len]),
        (0usize..(1 << 20), any::<u64>()).prop_map(|(len, seed)| {
            let mut rng = TestRng::new(seed);
            let alphabet = rng.bytes(4);
            (0..len).map(|_| alphabet[rng.below(4) as usize]).collect()
        }),
    ]
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(48))]

    #[test]
    fn deflate_output_never_exceeds_bound(data in deflate_input(), level in 1u32..=9) {
        let compressed = deflate_raw(&data, level);
        prop_assert!(compressed.len() as u64 <= deflate_upper_bound(data.len() as u64));
    }
}

fn block_input() -> impl Strategy<Value = Vec<u8>> {
    let tail = prop_oneof![Just(0usize), 1usize..64, 0..DEFLATE_BLOCK_BYTES];
    (0usize..=3, tail, 0u8..3, any::<u64>()).prop_map(|(blocks, tail, kind, seed)| {
        let len = blocks * DEFLATE_BLOCK_BYTES + tail;
        let mut rng = TestRng::new(seed);
        match kind {
            0 => rng.bytes(len),
            1 => vec![0; len],
            _ => {
                let alphabet = rng.bytes(4);
                (0..len).map(|_| alphabet[rng.below(4) as usize]).collect()
            }
        }
    })
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(24))]

    #[test]
    fn independent_blocks_inflate_as_one_stream_within_the_bound(
        data in block_input(),
        level in 1u32..=9,
    ) {
        let full = data.len() / DEFLATE_BLOCK_BYTES;
        let mut inputs: Vec<&[u8]> = data.chunks(DEFLATE_BLOCK_BYTES).take(full).collect();
        inputs.push(&data[full * DEFLATE_BLOCK_BYTES..]);

        let mut stream = Vec::new();
        for (index, input) in inputs.iter().enumerate() {
            let block = deflate_block(level, input, index == full).unwrap();
            prop_assert!(block.len() as u64 <= deflate_block_upper_bound(input.len() as u64));
            stream.extend(block);
        }
        prop_assert!(stream.len() as u64 <= deflate_upper_bound(data.len() as u64));

        let mut inflated = Vec::new();
        DeflateDecoder::new(&stream[..]).read_to_end(&mut inflated).unwrap();
        prop_assert!(inflated == data);
    }
}

fn test_entry() -> impl Strategy<Value = TestEntry> {
    (
        "f[a-z]{0,5}(/d[a-zé日]{0,5}){0,3}",
        prop_oneof![
            proptest::collection::vec(any::<u8>(), 0..3000),
            (0usize..3000).prop_map(|len| vec![b'x'; len]),
        ],
        any::<bool>(),
        any::<bool>(),
        0u64..100,
    )
        .prop_map(|(path, data, deflate, known, slack)| {
            let method = if deflate {
                Method::Deflate
            } else {
                Method::Stored
            };
            let max = data.len() as u64 + slack;
            TestEntry::new(&path, data, method, known).with_max(max)
        })
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(128))]

    #[test]
    fn random_archives_round_trip_within_the_size_bound(
        raw_entries in proptest::collection::vec(test_entry(), 0..16)
    ) {
        let mut entries: Vec<TestEntry> = Vec::new();
        for (index, mut entry) in raw_entries.into_iter().enumerate() {
            entry.path = format!("{index}/{}", entry.path);
            entries.push(entry);
        }

        let bytes = build_archive(&entries);
        assert_reads_back(&bytes, &entries);

        let bound = archive_size_upper_bound(
            entries.iter().map(|entry| (entry.path.len(), entry.max_uncompressed_size.unwrap())),
        );
        prop_assert!(bound >= bytes.len() as u64, "bound {bound} < {}", bytes.len());
    }
}
