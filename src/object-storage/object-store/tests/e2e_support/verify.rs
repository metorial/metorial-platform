use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use std::time::Instant;

use bytes::Bytes;
use serde_json::Value;
use tempfile::TempDir;

use super::api::Api;
use crate::zip_support::tools::{self, hash_reader};
use crate::zip_support::{command_exists, run_ok};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Method {
    Stored,
    Deflated,
}

/// One archive entry as the test expects it, in archive order.
#[derive(Debug, Clone)]
pub struct Expected {
    pub path: String,
    pub size: u64,
    pub crc32: u32,
    /// Compared byte for byte when present; otherwise size and CRC-32 only.
    pub data: Option<Bytes>,
    pub method: Option<Method>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tools {
    /// The `zip` crate only.
    ZipCrate,
    /// The `zip` crate, unzip, zipinfo, Python, ditto and bsdtar (Java when installed).
    All,
}

/// A downloaded archive in a temp directory.
pub struct ArchiveFile {
    pub dir: TempDir,
    pub path: PathBuf,
    pub size: u64,
    pub sha256: String,
}

pub async fn download_archive(api: &Api, bucket: &str, key: &str) -> ArchiveFile {
    let dir = tempfile::Builder::new()
        .prefix("e2e-zip-archive-")
        .tempdir()
        .unwrap();
    let path = dir.path().join("archive.zip");
    let (size, sha256) = api.download(bucket, key, &path).await;
    ArchiveFile {
        dir,
        path,
        size,
        sha256,
    }
}

/// Checks a completed job's archive end to end: downloads it through the object API, matches
/// size and SHA-256 against the job result, reads every entry back with the `zip` crate and,
/// with `Tools::All`, with every external tool, extracting it twice.
pub async fn verify_job_archive(
    api: &Api,
    job: &Value,
    bucket: &str,
    key: &str,
    expected: &[Expected],
    tools: Tools,
) -> ArchiveFile {
    assert_eq!(job["state"], "completed", "job did not complete: {job}");
    let archive = download_archive(api, bucket, key).await;
    assert_eq!(
        archive.size,
        job["result"]["size"].as_u64().unwrap(),
        "downloaded size differs from the job result"
    );
    assert_eq!(
        archive.sha256,
        job["result"]["sha256"].as_str().unwrap(),
        "downloaded SHA-256 differs from the job result"
    );
    assert_eq!(
        job["progress"]["entriesDone"].as_u64(),
        Some(expected.len() as u64)
    );
    verify_archive_file(&archive.path, expected, tools);
    archive
}

pub fn verify_archive_file(path: &Path, expected: &[Expected], tools: Tools) {
    let started = Instant::now();
    check_with_zip_crate(path, expected);
    if tools == Tools::All {
        check_with_external_tools(path, expected);
    }
    crate::report!(
        "verified {} entries of {} ({:.1} MiB) with {:?} in {:.1} s",
        expected.len(),
        path.display(),
        fs::metadata(path).unwrap().len() as f64 / (1 << 20) as f64,
        tools,
        started.elapsed().as_secs_f64()
    );
}

pub fn check_with_zip_crate(path: &Path, expected: &[Expected]) {
    let file = BufReader::with_capacity(1 << 20, File::open(path).unwrap());
    let mut zip = zip::ZipArchive::new(file).unwrap();
    assert_eq!(zip.len(), expected.len(), "entry count");

    for (index, expected) in expected.iter().enumerate() {
        let mut entry = zip.by_index(index).unwrap();
        assert_eq!(entry.name().unwrap(), expected.path, "entry {index}");
        assert_eq!(entry.size(), expected.size, "{}", expected.path);
        assert_eq!(entry.crc32(), expected.crc32, "{}", expected.path);
        if let Some(method) = expected.method {
            let actual = match entry.compression() {
                zip::CompressionMethod::Stored => Method::Stored,
                zip::CompressionMethod::Deflated => Method::Deflated,
                other => panic!("{}: unexpected method {other:?}", expected.path),
            };
            assert_eq!(actual, method, "compression of {}", expected.path);
        }
        match &expected.data {
            Some(data) => {
                let mut read = Vec::with_capacity(data.len());
                entry.read_to_end(&mut read).unwrap();
                assert!(read == data.as_ref(), "{} differs", expected.path);
            }
            None => {
                let (size, crc32) = hash_reader(&mut entry);
                assert_eq!(
                    (size, crc32),
                    (expected.size, expected.crc32),
                    "{}",
                    expected.path
                );
            }
        }
    }
}

fn as_tool_expectations(expected: &[Expected]) -> Vec<tools::Expected> {
    expected
        .iter()
        .map(|entry| tools::Expected {
            path: entry.path.clone(),
            size: entry.size,
            crc32: entry.crc32,
        })
        .collect()
}

pub fn check_with_external_tools(path: &Path, expected: &[Expected]) {
    let listed = as_tool_expectations(expected);

    if command_exists("unzip") {
        tools::check_unzip(path);
    }
    if command_exists("zipinfo") {
        tools::check_zipinfo(path, &listed);
    }
    if command_exists("python3") {
        tools::check_python(path, &listed);
    }
    if command_exists("ditto") {
        extract_and_compare("ditto -x -k", path, &listed, |archive, into| {
            run_ok(
                "ditto",
                &[
                    "-x",
                    "-k",
                    archive.to_str().unwrap(),
                    into.to_str().unwrap(),
                ],
            );
        });
    }
    if command_exists("bsdtar") {
        extract_and_compare("bsdtar -x", path, &listed, |archive, into| {
            run_ok(
                "bsdtar",
                &[
                    "-xf",
                    archive.to_str().unwrap(),
                    "-C",
                    into.to_str().unwrap(),
                ],
            );
        });
    }
    tools::check_java(path, &listed);
}

/// Extracts into `<tmp>/out` and checks that exactly the expected files appeared, with the
/// expected contents, and that nothing was written next to `out` or as a link.
fn extract_and_compare(
    tool: &str,
    archive: &Path,
    expected: &[tools::Expected],
    extract: impl Fn(&Path, &Path),
) {
    let outer = tempfile::Builder::new()
        .prefix("e2e-zip-extract-")
        .tempdir()
        .unwrap();
    let into = outer.path().join("out");
    fs::create_dir(&into).unwrap();
    extract(archive, &into);

    let beside: Vec<_> = fs::read_dir(outer.path())
        .unwrap()
        .map(|entry| entry.unwrap().file_name())
        .collect();
    assert_eq!(
        beside,
        vec![std::ffi::OsString::from("out")],
        "{tool} wrote outside the extraction directory"
    );

    let mut files = 0usize;
    let mut pending = vec![into.clone()];
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(&directory).unwrap() {
            let entry = entry.unwrap();
            let kind = entry.file_type().unwrap();
            assert!(
                !kind.is_symlink(),
                "{tool} created a link: {:?}",
                entry.path()
            );
            if kind.is_dir() {
                pending.push(entry.path());
            } else {
                files += 1;
            }
        }
    }
    assert_eq!(files, expected.len(), "{tool}: extracted file count");

    for entry in expected {
        let mut file = File::open(into.join(&entry.path))
            .unwrap_or_else(|error| panic!("{tool}: {}: {error}", entry.path));
        assert_eq!(
            hash_reader(&mut file),
            (entry.size, entry.crc32),
            "{tool}: {}",
            entry.path
        );
    }
    tools::report(
        tool,
        archive,
        &format!("{files} files extracted, none outside"),
    );
}

/// Asserts the job failed with `code`, and that its destination still holds `previous` (or
/// nothing).
pub async fn assert_failed_cleanly(
    api: &Api,
    job: &Value,
    code: &str,
    destination: (&str, &str),
    previous: Option<&[u8]>,
) {
    assert_eq!(job["state"], "failed", "{job}");
    assert_eq!(job["error"]["code"], code, "{job}");
    assert!(job["result"].is_null(), "{job}");
    let (status, body) = api.get_object(destination.0, destination.1).await;
    match previous {
        Some(previous) => {
            assert_eq!(status, 200);
            assert!(body.as_ref() == previous, "the destination was changed");
        }
        None => assert_eq!(status, 404, "a failed job left an archive behind"),
    }
}
