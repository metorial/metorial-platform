#![allow(dead_code)]

pub mod tools;

use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use flate2::write::DeflateEncoder;
use flate2::Compression;
use object_store::zip::{DeclaredSizes, EntryHeader, EntrySizes, Method, ZipWriter};

pub const U32_SENTINEL: u32 = 0xFFFF_FFFF;
pub const U16_SENTINEL: u16 = 0xFFFF;

pub fn deflate_raw(data: &[u8], level: u32) -> Vec<u8> {
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::new(level));
    encoder.write_all(data).unwrap();
    encoder.finish().unwrap()
}

/// Deterministic xorshift64* so tests don't need a `rand` dependency.
pub struct TestRng(u64);

impl TestRng {
    pub fn new(seed: u64) -> Self {
        TestRng(seed.max(1))
    }

    pub fn next_u64(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }

    pub fn below(&mut self, n: u64) -> u64 {
        self.next_u64() % n
    }

    pub fn bytes(&mut self, len: usize) -> Vec<u8> {
        (0..len).map(|_| self.next_u64() as u8).collect()
    }
}

#[derive(Debug, Clone)]
pub struct TestEntry {
    pub path: String,
    pub data: Vec<u8>,
    pub method: Method,
    pub known: bool,
    /// Declared upper bound for unknown-size entries; defaults to the data length.
    pub max_uncompressed_size: Option<u64>,
}

impl TestEntry {
    pub fn new(path: &str, data: impl Into<Vec<u8>>, method: Method, known: bool) -> Self {
        TestEntry {
            path: path.to_string(),
            data: data.into(),
            method,
            known,
            max_uncompressed_size: None,
        }
    }

    pub fn with_max(mut self, max_uncompressed_size: u64) -> Self {
        self.max_uncompressed_size = Some(max_uncompressed_size);
        self
    }
}

pub fn build_archive(entries: &[TestEntry]) -> Vec<u8> {
    let mut writer = ZipWriter::new();
    let mut out = Vec::new();

    for entry in entries {
        let payload = match entry.method {
            Method::Stored => entry.data.clone(),
            Method::Deflate => deflate_raw(&entry.data, 6),
        };
        let sizes = EntrySizes::deflated(&entry.data, payload.len() as u64);
        let declared = if entry.known {
            DeclaredSizes::Known(sizes)
        } else {
            DeclaredSizes::Unknown {
                max_uncompressed_size: entry
                    .max_uncompressed_size
                    .unwrap_or(entry.data.len() as u64),
            }
        };

        out.extend_from_slice(
            &writer
                .begin_entry(EntryHeader {
                    path: entry.path.clone(),
                    method: entry.method,
                    sizes: declared,
                })
                .unwrap(),
        );
        out.extend_from_slice(&payload);
        out.extend_from_slice(&writer.end_entry(sizes).unwrap());
        assert_eq!(writer.bytes_written(), out.len() as u64);
    }

    out.extend_from_slice(&writer.finish().unwrap());
    out
}

pub fn mixed_entries() -> Vec<TestEntry> {
    let text = "Metorial skills export.\n".repeat(200);
    let mut rng = TestRng::new(7);
    let random = rng.bytes(5000);

    vec![
        TestEntry::new(
            ".github/workflows/ci.yml",
            "on: push\n",
            Method::Stored,
            true,
        ),
        TestEntry::new("README.md", text.as_bytes(), Method::Deflate, true),
        TestEntry::new("empty-known.txt", "", Method::Stored, true),
        TestEntry::new("empty-unknown.txt", "", Method::Stored, false),
        TestEntry::new("empty-deflate.txt", "", Method::Deflate, false),
        TestEntry::new(
            "plugins/a/skills/b/SKILL.md",
            text.as_bytes(),
            Method::Deflate,
            false,
        ),
        TestEntry::new(
            "plugins/a/random.bin",
            random.clone(),
            Method::Stored,
            false,
        ),
        TestEntry::new(
            "plugins/a/random-deflated.bin",
            random,
            Method::Deflate,
            true,
        ),
        TestEntry::new(
            "unicode/日本語/ファイル.txt",
            "こんにちは",
            Method::Stored,
            true,
        ),
        TestEntry::new("unicode/émoji 🎉 name.md", "party", Method::Deflate, false),
        TestEntry::new("unicode/Ünïcödé café.txt", "ok", Method::Stored, false),
        TestEntry::new("with spaces/in the middle.txt", "x", Method::Stored, true),
        TestEntry::new(
            "zip64-header/stored-bound.bin",
            "small data, big bound",
            Method::Stored,
            false,
        )
        .with_max(5 << 30),
        TestEntry::new(
            "zip64-header/deflate-bound.txt",
            text.as_bytes(),
            Method::Deflate,
            false,
        )
        .with_max(5 << 30),
    ]
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalHeader {
    pub version_needed: u16,
    pub flags: u16,
    pub method: u16,
    pub time: u16,
    pub date: u16,
    pub crc32: u32,
    pub compressed_size: u32,
    pub uncompressed_size: u32,
    pub path: String,
    pub extra: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CentralRecord {
    pub version_made_by: u16,
    pub version_needed: u16,
    pub flags: u16,
    pub method: u16,
    pub crc32: u32,
    pub raw_compressed_size: u32,
    pub raw_uncompressed_size: u32,
    pub raw_local_header_offset: u32,
    pub external_attributes: u32,
    pub path: String,
    pub extra: Vec<u8>,
    pub zip64_fields: Vec<u64>,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
    pub local_header_offset: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Zip64End {
    pub entries: u64,
    pub central_directory_len: u64,
    pub central_directory_offset: u64,
    pub locator_record_offset: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EndOfCentralDirectory {
    pub entries: u16,
    pub central_directory_len: u32,
    pub central_directory_offset: u32,
}

#[derive(Debug, Clone)]
pub struct Trailer {
    pub records: Vec<CentralRecord>,
    pub zip64: Option<Zip64End>,
    pub end: EndOfCentralDirectory,
}

struct Reader<'a> {
    bytes: &'a [u8],
    position: usize,
}

impl<'a> Reader<'a> {
    fn u16(&mut self) -> u16 {
        u16::from_le_bytes(self.take(2).try_into().unwrap())
    }

    fn u32(&mut self) -> u32 {
        u32::from_le_bytes(self.take(4).try_into().unwrap())
    }

    fn u64(&mut self) -> u64 {
        u64::from_le_bytes(self.take(8).try_into().unwrap())
    }

    fn take(&mut self, len: usize) -> &'a [u8] {
        let slice = &self.bytes[self.position..self.position + len];
        self.position += len;
        slice
    }

    fn peek_u32(&self) -> Option<u32> {
        self.bytes
            .get(self.position..self.position + 4)
            .map(|slice| u32::from_le_bytes(slice.try_into().unwrap()))
    }
}

pub fn parse_local_header(bytes: &[u8]) -> LocalHeader {
    let mut reader = Reader { bytes, position: 0 };
    assert_eq!(reader.u32(), 0x0403_4b50);
    let version_needed = reader.u16();
    let flags = reader.u16();
    let method = reader.u16();
    let time = reader.u16();
    let date = reader.u16();
    let crc32 = reader.u32();
    let compressed_size = reader.u32();
    let uncompressed_size = reader.u32();
    let path_len = reader.u16() as usize;
    let extra_len = reader.u16() as usize;
    let path = String::from_utf8(reader.take(path_len).to_vec()).unwrap();
    let extra = reader.take(extra_len).to_vec();
    assert_eq!(
        reader.position,
        bytes.len(),
        "trailing bytes after local header"
    );

    LocalHeader {
        version_needed,
        flags,
        method,
        time,
        date,
        crc32,
        compressed_size,
        uncompressed_size,
        path,
        extra,
    }
}

/// Parses a trailer produced by `ZipWriter::finish`, which starts at archive offset
/// `trailer_offset`, and checks the end records agree with each other and with the records.
pub fn parse_trailer(bytes: &[u8], trailer_offset: u64) -> Trailer {
    let mut reader = Reader { bytes, position: 0 };
    let mut records = Vec::new();

    while reader.peek_u32() == Some(0x0201_4b50) {
        reader.u32();
        let version_made_by = reader.u16();
        let version_needed = reader.u16();
        let flags = reader.u16();
        let method = reader.u16();
        assert_eq!(reader.u16(), 0, "time");
        assert_eq!(reader.u16(), 0x21, "date");
        let crc32 = reader.u32();
        let raw_compressed_size = reader.u32();
        let raw_uncompressed_size = reader.u32();
        let path_len = reader.u16() as usize;
        let extra_len = reader.u16() as usize;
        assert_eq!(reader.u16(), 0, "comment length");
        assert_eq!(reader.u16(), 0, "disk number start");
        assert_eq!(reader.u16(), 0, "internal attributes");
        let external_attributes = reader.u32();
        let raw_local_header_offset = reader.u32();
        let path = String::from_utf8(reader.take(path_len).to_vec()).unwrap();
        let extra = reader.take(extra_len).to_vec();

        let zip64_fields = if extra.is_empty() {
            Vec::new()
        } else {
            let mut extra_reader = Reader {
                bytes: &extra,
                position: 0,
            };
            assert_eq!(extra_reader.u16(), 1, "only the ZIP64 extra is expected");
            let len = extra_reader.u16() as usize;
            assert_eq!(len + 4, extra.len());
            (0..len / 8).map(|_| extra_reader.u64()).collect()
        };

        let mut fields = zip64_fields.iter().copied();
        let mut resolve = |raw: u32| {
            if raw == U32_SENTINEL {
                fields.next().expect("sentinel without ZIP64 field")
            } else {
                raw as u64
            }
        };
        let uncompressed_size = resolve(raw_uncompressed_size);
        let compressed_size = resolve(raw_compressed_size);
        let local_header_offset = resolve(raw_local_header_offset);
        assert!(fields.next().is_none(), "ZIP64 field without sentinel");

        records.push(CentralRecord {
            version_made_by,
            version_needed,
            flags,
            method,
            crc32,
            raw_compressed_size,
            raw_uncompressed_size,
            raw_local_header_offset,
            external_attributes,
            path,
            extra,
            zip64_fields,
            compressed_size,
            uncompressed_size,
            local_header_offset,
        });
    }

    let central_directory_len = reader.position as u64;

    let zip64 = if reader.peek_u32() == Some(0x0606_4b50) {
        let record_offset = trailer_offset + reader.position as u64;
        reader.u32();
        assert_eq!(reader.u64(), 44);
        assert_eq!(reader.u16(), 0x032d);
        assert_eq!(reader.u16(), 45);
        assert_eq!(reader.u32(), 0);
        assert_eq!(reader.u32(), 0);
        let entries_on_disk = reader.u64();
        let entries = reader.u64();
        assert_eq!(entries_on_disk, entries);
        let zip64_central_directory_len = reader.u64();
        let central_directory_offset = reader.u64();

        assert_eq!(reader.u32(), 0x0706_4b50);
        assert_eq!(reader.u32(), 0);
        let locator_record_offset = reader.u64();
        assert_eq!(reader.u32(), 1);
        assert_eq!(locator_record_offset, record_offset);

        Some(Zip64End {
            entries,
            central_directory_len: zip64_central_directory_len,
            central_directory_offset,
            locator_record_offset,
        })
    } else {
        None
    };

    assert_eq!(reader.u32(), 0x0605_4b50);
    assert_eq!(reader.u16(), 0);
    assert_eq!(reader.u16(), 0);
    let entries_on_disk = reader.u16();
    let entries = reader.u16();
    assert_eq!(entries_on_disk, entries);
    let end = EndOfCentralDirectory {
        entries,
        central_directory_len: reader.u32(),
        central_directory_offset: reader.u32(),
    };
    assert_eq!(reader.u16(), 0, "comment length");
    assert_eq!(reader.position, bytes.len(), "trailing bytes after EOCD");

    let count = records.len() as u64;
    let expect_u16 = |value: u64| {
        if value >= U16_SENTINEL as u64 {
            U16_SENTINEL
        } else {
            value as u16
        }
    };
    let expect_u32 = |value: u64| {
        if value >= U32_SENTINEL as u64 {
            U32_SENTINEL
        } else {
            value as u32
        }
    };
    assert_eq!(end.entries, expect_u16(count));
    assert_eq!(end.central_directory_len, expect_u32(central_directory_len));
    assert_eq!(end.central_directory_offset, expect_u32(trailer_offset));

    let needs_zip64 = count >= U16_SENTINEL as u64
        || central_directory_len >= U32_SENTINEL as u64
        || trailer_offset >= U32_SENTINEL as u64;
    assert_eq!(zip64.is_some(), needs_zip64);

    if let Some(zip64) = &zip64 {
        assert_eq!(zip64.entries, count);
        assert_eq!(zip64.central_directory_len, central_directory_len);
        assert_eq!(zip64.central_directory_offset, trailer_offset);
    }

    Trailer {
        records,
        zip64,
        end,
    }
}

pub fn temp_dir() -> tempfile::TempDir {
    tempfile::Builder::new()
        .prefix("zip-writer-test-")
        .tempdir()
        .unwrap()
}

pub fn command_exists(program: &str) -> bool {
    match Command::new(program).arg("--version").output() {
        Ok(_) => true,
        Err(error) => error.kind() != std::io::ErrorKind::NotFound,
    }
}

pub fn command_works(program: &str, args: &[&str]) -> bool {
    Command::new(program)
        .args(args)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

pub fn run_ok(program: &str, args: &[&str]) -> Output {
    let output = Command::new(program)
        .args(args)
        .output()
        .unwrap_or_else(|error| panic!("failed to run {program}: {error}"));

    assert!(
        output.status.success(),
        "{program} {args:?} failed with {}\nstdout:\n{}\nstderr:\n{}",
        output.status,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    output
}

pub fn fixture_path(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/zip")
        .join(name)
}

/// Reads every regular file under `root` as `relative path -> contents`.
pub fn read_tree(root: &Path) -> BTreeMap<String, Vec<u8>> {
    let mut files = BTreeMap::new();
    let mut pending = vec![root.to_path_buf()];

    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(&directory).unwrap() {
            let entry = entry.unwrap();
            let file_type = entry.file_type().unwrap();
            if file_type.is_dir() {
                pending.push(entry.path());
            } else {
                assert!(file_type.is_file(), "unexpected {:?}", entry.path());
                let relative = entry.path().strip_prefix(root).unwrap().to_path_buf();
                files.insert(
                    relative.to_string_lossy().into_owned(),
                    fs::read(entry.path()).unwrap(),
                );
            }
        }
    }

    files
}
