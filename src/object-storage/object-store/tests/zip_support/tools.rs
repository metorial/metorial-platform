use std::fs::{self, File};
use std::io::Read;
use std::path::Path;

use object_store::zip::EntryDigest;

use super::{command_exists, command_works, fixture_path, run_ok, temp_dir, TestEntry};

#[derive(Debug, Clone)]
pub struct Expected {
    pub path: String,
    pub size: u64,
    pub crc32: u32,
}

impl Expected {
    pub fn from_entries(entries: &[TestEntry]) -> Vec<Expected> {
        entries
            .iter()
            .map(|entry| Expected {
                path: entry.path.clone(),
                size: entry.data.len() as u64,
                crc32: crc32fast::hash(&entry.data),
            })
            .collect()
    }
}

pub fn report(tool: &str, archive: &Path, detail: &str) {
    println!(
        "[external] {tool}: ok on {} ({detail})",
        archive.file_name().unwrap().to_string_lossy()
    );
}

pub fn check_unzip(archive: &Path) {
    let output = run_ok("unzip", &["-tq", archive.to_str().unwrap()]);
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("No errors detected"), "{stdout}");
    report("unzip -t", archive, stdout.trim());
}

pub fn check_zipinfo(archive: &Path, expected: &[Expected]) {
    let output = run_ok("zipinfo", &["-1", archive.to_str().unwrap()]);
    let names: Vec<_> = output
        .stdout
        .split(|byte| *byte == b'\n')
        .filter(|line| !line.is_empty())
        .collect();
    assert_eq!(names.len(), expected.len());
    for (name, expected) in names.iter().zip(expected) {
        if expected.path.is_ascii() {
            assert_eq!(*name, expected.path.as_bytes());
        }
    }

    let output = run_ok("zipinfo", &["-t", archive.to_str().unwrap()]);
    let summary = String::from_utf8_lossy(&output.stdout);
    let total: u64 = expected.iter().map(|entry| entry.size).sum();
    let files = if expected.len() == 1 { "file" } else { "files" };
    assert!(
        summary.starts_with(&format!(
            "{} {files}, {total} bytes uncompressed",
            expected.len()
        )),
        "{summary}"
    );
    report("zipinfo", archive, summary.trim());
}

pub fn check_python(archive: &Path, expected: &[Expected]) {
    let script = r#"
import json, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    bad = archive.testzip()
    if bad is not None:
        sys.exit("bad entry: " + bad)
    print(json.dumps([[i.filename, i.file_size, i.CRC] for i in archive.infolist()]))
"#;
    let output = run_ok("python3", &["-c", script, archive.to_str().unwrap()]);
    let listed: Vec<(String, u64, u32)> = serde_json::from_slice(&output.stdout).unwrap();

    assert_eq!(listed.len(), expected.len());
    for ((name, size, crc32), expected) in listed.iter().zip(expected) {
        assert_eq!(name, &expected.path);
        assert_eq!(*size, expected.size, "{name}");
        assert_eq!(*crc32, expected.crc32, "{name}");
    }
    report(
        "python3 zipfile.testzip",
        archive,
        &format!("{} entries", listed.len()),
    );
}

pub fn check_ditto(archive: &Path, expected: &[Expected]) {
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
    verify_extracted(destination.path(), expected);
    report(
        "ditto -x -k",
        archive,
        &format!("{} files extracted", expected.len()),
    );
}

pub fn check_bsdtar(archive: &Path, expected: &[Expected]) {
    let output = run_ok("bsdtar", &["-tf", archive.to_str().unwrap()]);
    let listed = String::from_utf8_lossy(&output.stdout).lines().count();
    assert_eq!(listed, expected.len());

    let destination = temp_dir();
    run_ok(
        "bsdtar",
        &[
            "-xf",
            archive.to_str().unwrap(),
            "-C",
            destination.path().to_str().unwrap(),
        ],
    );
    verify_extracted(destination.path(), expected);
    report(
        "bsdtar (libarchive)",
        archive,
        &format!("{listed} files extracted"),
    );
}

pub fn check_java(archive: &Path, expected: &[Expected]) {
    if !command_works("java", &["-version"]) {
        println!("[external] java: SKIPPED, no Java runtime installed");
        return;
    }

    let source = fixture_path("ZipCheck.java");
    let output = run_ok(
        "java",
        &[source.to_str().unwrap(), archive.to_str().unwrap()],
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    let total: u64 = expected.iter().map(|entry| entry.size).sum();
    assert_eq!(
        stdout.trim(),
        format!("entries={} bytes={total}", expected.len())
    );
    report("java.util.zip.ZipFile", archive, stdout.trim());
}

pub fn check_zip_crate(archive: &Path, expected: &[Expected]) {
    let mut zip = zip::ZipArchive::new(File::open(archive).unwrap()).unwrap();
    assert_eq!(zip.len(), expected.len());

    for (index, expected) in expected.iter().enumerate() {
        let mut file = zip.by_index(index).unwrap();
        assert_eq!(file.name(), expected.path);
        let (size, crc32) = hash_reader(&mut file);
        assert_eq!(size, expected.size);
        assert_eq!(crc32, expected.crc32);
    }
    report("zip crate", archive, &format!("{} entries", expected.len()));
}

pub fn check_all_tools(archive: &Path, expected: &[Expected]) {
    check_zip_crate(archive, expected);

    let tools: [(&str, &dyn Fn()); 5] = [
        ("unzip", &|| check_unzip(archive)),
        ("zipinfo", &|| check_zipinfo(archive, expected)),
        ("python3", &|| check_python(archive, expected)),
        ("ditto", &|| check_ditto(archive, expected)),
        ("bsdtar", &|| check_bsdtar(archive, expected)),
    ];
    for (program, check) in tools {
        if command_exists(program) {
            check();
        } else {
            println!("[external] {program}: SKIPPED, not installed");
        }
    }

    check_java(archive, expected);
}

pub fn hash_reader(reader: &mut impl Read) -> (u64, u32) {
    let mut digest = EntryDigest::new();
    let mut buffer = vec![0; 1 << 20];
    loop {
        let read = reader.read(&mut buffer).unwrap();
        if read == 0 {
            break;
        }
        digest.update_uncompressed(&buffer[..read]);
    }
    let sizes = digest.finish();
    (sizes.uncompressed_size, sizes.crc32)
}

pub fn verify_extracted(root: &Path, expected: &[Expected]) {
    let mut file_count = 0;
    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(&directory).unwrap() {
            let entry = entry.unwrap();
            if entry.file_type().unwrap().is_dir() {
                pending.push(entry.path());
            } else {
                file_count += 1;
            }
        }
    }
    assert_eq!(file_count, expected.len());

    for expected in expected {
        let mut file = File::open(root.join(&expected.path))
            .unwrap_or_else(|error| panic!("{}: {error}", expected.path));
        assert_eq!(
            hash_reader(&mut file),
            (expected.size, expected.crc32),
            "{}",
            expected.path
        );
    }
}
