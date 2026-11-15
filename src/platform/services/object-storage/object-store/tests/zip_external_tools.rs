mod zip_support;

use std::collections::BTreeSet;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::Path;

use flate2::write::DeflateEncoder;
use flate2::Compression;
use object_store::zip::{
    plan_entry_names, DeclaredSizes, EntryDigest, EntryHeader, EntrySizes, Method, ZipWriter,
};
use unicode_normalization::UnicodeNormalization;
use zip_support::tools::{check_all_tools, report, Expected};
use zip_support::{
    build_archive, command_exists, mixed_entries, read_tree, run_ok, temp_dir, TestEntry,
};

const FOUR_GIB_PLUS_ONE: u64 = (4 << 30) + 1;
static ZERO_CHUNK: [u8; 1 << 20] = [0; 1 << 20];

#[test]
fn mixed_archive_passes_external_tools() {
    let entries = mixed_entries();
    let directory = temp_dir();
    let archive = directory.path().join("mixed.zip");
    fs::write(&archive, build_archive(&entries)).unwrap();

    check_all_tools(&archive, &Expected::from_entries(&entries));

    if !command_exists("ditto") {
        return;
    }

    let destination = temp_dir();
    run_ok(
        "ditto",
        &[
            "-x",
            "-k",
            archive.to_str().unwrap(),
            destination.path().to_str().unwrap(),
        ],
    );
    let extracted = read_tree(destination.path());
    for entry in &entries {
        let found = extracted
            .iter()
            .find(|(path, _)| path.nfc().eq(entry.path.nfc()))
            .unwrap_or_else(|| panic!("{} missing", entry.path));
        assert_eq!(found.1, &entry.data, "{}", entry.path);
    }
}

#[test]
fn seventy_thousand_entries_pass_external_tools() {
    let entries: Vec<_> = (0..70_000)
        .map(|index| {
            TestEntry::new(
                &format!("d{}/{index:05}.txt", index % 7),
                format!("entry {index}\n"),
                if index % 2 == 0 {
                    Method::Stored
                } else {
                    Method::Deflate
                },
                index % 3 != 0,
            )
        })
        .collect();

    let directory = temp_dir();
    let archive = directory.path().join("seventy-thousand.zip");
    fs::write(&archive, build_archive(&entries)).unwrap();

    check_all_tools(&archive, &Expected::from_entries(&entries));
}

fn assert_extracted_names(tool: &str, args: &[&str], archive: &Path, planned: &[String]) {
    if !command_exists(tool) {
        return;
    }

    let destination = temp_dir();
    let mut command_args: Vec<&str> = args.to_vec();
    command_args.push(archive.to_str().unwrap());
    let destination_arg = destination.path().to_str().unwrap();
    if tool == "bsdtar" {
        command_args.extend(["-C", destination_arg]);
    } else {
        command_args.push(destination_arg);
    }
    run_ok(tool, &command_args);

    let extracted: BTreeSet<String> = read_tree(destination.path())
        .into_keys()
        .map(|path| path.nfc().collect())
        .collect();
    let expected: BTreeSet<String> = planned.iter().map(|path| path.nfc().collect()).collect();
    assert_eq!(extracted, expected, "{tool} extracted different names");
    report(
        tool,
        archive,
        &format!("extracted exactly the {} planned names", expected.len()),
    );
}

#[test]
fn sanitized_and_deduplicated_names_extract_as_planned() {
    let mut requested = vec![
        "SKILL.md",
        "SKILL\u{200B}.md",
        ".github/workflows/ci.yml",
        "scripts/run.sh",
        "日本語/ファイル.txt",
        "family 👨\u{200D}👩\u{200D}👧.png",
        "..\\..\\evil",
        "C:\\Windows\\x",
        "C:foo",
        "\u{FF0E}\u{FF0E}/x",
        "invoice\u{202E}fdp.exe",
        "CON",
        "CON_",
        "CON .txt",
        "aux.md",
        "nul.tar.gz",
        "COM¹.md",
        "notes.",
        "trailing ",
        "what?.md",
        "what_.md",
        "a:b",
        "tab\there.txt",
        "README.md",
        "readme.md",
        "readme~2.md",
        "caf\u{e9}.md",
        "cafe\u{301}.md",
        "a.md",
        "A.md",
        "a.MD",
        "dir",
        "dir/inner.txt",
        "Docs",
        "docs/guide.md",
        "s.txt",
        "\u{17F}.txt",
        "\u{3C3}",
        "\u{3C2}",
        "\u{391}\u{3C3}",
        "\u{391}\u{3A3}",
        "\u{3BC}.txt",
        "\u{B5}.txt",
        "\u{3B2}.txt",
        "\u{3D0}.txt",
        "\u{3B8}.txt",
        "\u{3D1}.txt",
        "i.txt",
        "\u{131}.txt",
        "k.txt",
        "\u{212A}.txt",
        "stra\u{DF}e",
        "strasse",
        "a\u{2215}b.txt",
        "\u{A5}100.txt",
        "\u{20A9}100.txt",
        "blank\u{3164}.md",
    ];
    requested.sort();

    let planned: Vec<String> = plan_entry_names(requested.iter().copied())
        .unwrap()
        .into_iter()
        .map(|name| name.archive_path)
        .collect();
    let distinct: BTreeSet<String> = planned
        .iter()
        .map(|path| path.nfc().collect::<String>().to_lowercase())
        .collect();
    assert_eq!(distinct.len(), requested.len());

    let entries: Vec<TestEntry> = requested
        .iter()
        .zip(&planned)
        .enumerate()
        .map(|(index, (request, path))| {
            TestEntry::new(
                path,
                format!("requested as {request:?}\n"),
                if index % 2 == 0 {
                    Method::Deflate
                } else {
                    Method::Stored
                },
                index % 3 == 0,
            )
        })
        .collect();

    for (request, path) in requested.iter().zip(&planned) {
        println!("[plan] {request:?} -> {path:?}");
    }

    let directory = temp_dir();
    let archive = directory.path().join("sanitized.zip");
    fs::write(&archive, build_archive(&entries)).unwrap();

    check_all_tools(&archive, &Expected::from_entries(&entries));
    assert_extracted_names("ditto", &["-x", "-k"], &archive, &planned);
    assert_extracted_names("bsdtar", &["-xf"], &archive, &planned);
}

enum Data {
    Zeros(u64),
    Bytes(&'static [u8]),
}

impl Data {
    fn len(&self) -> u64 {
        match self {
            Data::Zeros(len) => *len,
            Data::Bytes(bytes) => bytes.len() as u64,
        }
    }

    fn for_each_chunk(&self, mut f: impl FnMut(&[u8])) {
        match self {
            Data::Zeros(len) => {
                let mut remaining = *len;
                while remaining > 0 {
                    let take = remaining.min(ZERO_CHUNK.len() as u64) as usize;
                    f(&ZERO_CHUNK[..take]);
                    remaining -= take as u64;
                }
            }
            Data::Bytes(bytes) => f(bytes),
        }
    }

    fn sizes_if_stored(&self) -> EntrySizes {
        let mut digest = EntryDigest::new();
        self.for_each_chunk(|chunk| {
            digest.update_uncompressed(chunk);
            digest.add_compressed(chunk.len() as u64);
        });
        digest.finish()
    }
}

struct LargeEntry {
    path: &'static str,
    method: Method,
    known: bool,
    data: Data,
}

struct CountingWriter<W> {
    inner: W,
    written: u64,
}

impl<W: Write> Write for CountingWriter<W> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let written = self.inner.write(buf)?;
        self.written += written as u64;
        Ok(written)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}

/// Streams an archive straight to disk without holding entry data in memory.
fn write_large_archive(archive: &Path, entries: &[LargeEntry]) -> Vec<Expected> {
    let mut out = CountingWriter {
        inner: BufWriter::with_capacity(4 << 20, File::create(archive).unwrap()),
        written: 0,
    };
    let mut writer = ZipWriter::new();
    let mut expected = Vec::new();

    for entry in entries {
        let declared = if entry.known {
            assert_eq!(entry.method, Method::Stored);
            DeclaredSizes::Known(entry.data.sizes_if_stored())
        } else {
            DeclaredSizes::Unknown {
                max_uncompressed_size: entry.data.len(),
            }
        };

        out.write_all(
            &writer
                .begin_entry(EntryHeader {
                    path: entry.path.to_string(),
                    method: entry.method,
                    sizes: declared,
                })
                .unwrap(),
        )
        .unwrap();

        let mut digest = EntryDigest::new();
        match entry.method {
            Method::Stored => entry.data.for_each_chunk(|chunk| {
                digest.update_uncompressed(chunk);
                digest.add_compressed(chunk.len() as u64);
                out.write_all(chunk).unwrap();
            }),
            Method::Deflate => {
                let before = out.written;
                let mut encoder = DeflateEncoder::new(&mut out, Compression::new(1));
                entry.data.for_each_chunk(|chunk| {
                    digest.update_uncompressed(chunk);
                    encoder.write_all(chunk).unwrap();
                });
                encoder.finish().unwrap();
                digest.add_compressed(out.written - before);
            }
        }
        let sizes = digest.finish();

        out.write_all(&writer.end_entry(sizes).unwrap()).unwrap();
        assert_eq!(writer.bytes_written(), out.written);

        expected.push(Expected {
            path: entry.path.to_string(),
            size: sizes.uncompressed_size,
            crc32: sizes.crc32,
        });
    }

    out.write_all(&writer.finish().unwrap()).unwrap();
    out.flush().unwrap();
    drop(out);

    println!(
        "[external] wrote {} ({} bytes)",
        archive.display(),
        fs::metadata(archive).unwrap().len()
    );
    expected
}

#[test]
#[ignore = "writes a 4 GiB archive; run with --ignored --release"]
fn zip64_stored_entry_with_descriptor_over_4gib_passes_external_tools() {
    let directory = temp_dir();
    let archive = directory.path().join("zip64-stored-descriptor.zip");
    let expected = write_large_archive(
        &archive,
        &[
            LargeEntry {
                path: "a-before.txt",
                method: Method::Stored,
                known: true,
                data: Data::Bytes(b"before\n"),
            },
            LargeEntry {
                path: "big/zeros.bin",
                method: Method::Stored,
                known: false,
                data: Data::Zeros(FOUR_GIB_PLUS_ONE),
            },
            LargeEntry {
                path: "z-after.txt",
                method: Method::Deflate,
                known: false,
                data: Data::Bytes(b"after the big entry, past the 4 GiB offset\n"),
            },
        ],
    );

    check_all_tools(&archive, &expected);
}

#[test]
#[ignore = "writes a 4 GiB archive; run with --ignored --release"]
fn zip64_stored_entry_with_known_sizes_over_4gib_passes_external_tools() {
    let directory = temp_dir();
    let archive = directory.path().join("zip64-stored-known.zip");
    let expected = write_large_archive(
        &archive,
        &[
            LargeEntry {
                path: "big.bin",
                method: Method::Stored,
                known: true,
                data: Data::Zeros(FOUR_GIB_PLUS_ONE),
            },
            LargeEntry {
                path: "after.txt",
                method: Method::Stored,
                known: true,
                data: Data::Bytes(b"after\n"),
            },
        ],
    );

    check_all_tools(&archive, &expected);
}

#[test]
#[ignore = "extracts a 4 GiB entry; run with --ignored --release"]
fn zip64_deflate_entry_over_4gib_passes_external_tools() {
    let directory = temp_dir();
    let archive = directory.path().join("zip64-deflate.zip");
    let expected = write_large_archive(
        &archive,
        &[
            LargeEntry {
                path: "big.txt",
                method: Method::Deflate,
                known: false,
                data: Data::Zeros(FOUR_GIB_PLUS_ONE),
            },
            LargeEntry {
                path: "small.txt",
                method: Method::Deflate,
                known: false,
                data: Data::Bytes(b"small\n"),
            },
        ],
    );

    check_all_tools(&archive, &expected);
}
