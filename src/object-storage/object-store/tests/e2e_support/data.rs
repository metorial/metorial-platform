use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use bytes::{Bytes, BytesMut};
use futures::StreamExt;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use super::api::Api;
use super::verify::{Expected, Method};
use super::{KIB, MIB};

/// Deterministic xorshift64*.
#[derive(Clone)]
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15).max(1))
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

    pub fn range(&mut self, low: u64, high: u64) -> u64 {
        low + self.below(high - low + 1)
    }

    pub fn fill(&mut self, buffer: &mut [u8]) {
        let mut chunks = buffer.chunks_exact_mut(8);
        for chunk in &mut chunks {
            chunk.copy_from_slice(&self.next_u64().to_le_bytes());
        }
        let rest = chunks.into_remainder();
        let last = self.next_u64().to_le_bytes();
        rest.copy_from_slice(&last[..rest.len()]);
    }

    pub fn shuffle<T>(&mut self, items: &mut [T]) {
        for index in (1..items.len()).rev() {
            let other = self.below(index as u64 + 1) as usize;
            items.swap(index, other);
        }
    }
}

const WORDS: &[&str] = &[
    "skill",
    "metorial",
    "export",
    "agent",
    "tool",
    "server",
    "request",
    "response",
    "context",
    "prompt",
    "model",
    "token",
    "stream",
    "archive",
    "bucket",
    "object",
    "upload",
    "deploy",
    "config",
    "secret",
    "handler",
    "router",
    "client",
    "session",
    "cursor",
    "plugin",
    "manifest",
    "schema",
    "validate",
    "result",
    "error",
    "retry",
    "lease",
    "worker",
    "queue",
    "cron",
    "index",
    "search",
    "vector",
    "embedding",
    "markdown",
    "python",
    "script",
    "shell",
    "docker",
    "build",
    "test",
    "release",
    "the",
    "a",
    "of",
    "and",
    "to",
    "in",
    "is",
    "for",
    "with",
    "on",
    "that",
    "this",
    "be",
    "by",
    "from",
    "as",
];

pub fn random_bytes(seed: u64, len: usize) -> Vec<u8> {
    let mut data = vec![0; len];
    Rng::new(seed).fill(&mut data);
    data
}

/// Prose-like text that Deflate shrinks to roughly a quarter.
pub struct TextGen {
    rng: Rng,
    line: u64,
}

impl TextGen {
    pub fn new(seed: u64) -> Self {
        TextGen {
            rng: Rng::new(seed),
            line: 0,
        }
    }

    pub fn fill(&mut self, out: &mut Vec<u8>, len: usize) {
        while out.len() < len {
            self.line += 1;
            let words = self.rng.range(5, 12);
            for index in 0..words {
                if index > 0 {
                    out.push(b' ');
                }
                let word = WORDS[self.rng.below(WORDS.len() as u64) as usize];
                out.extend_from_slice(word.as_bytes());
            }
            out.extend_from_slice(format!(" #{}\n", self.line).as_bytes());
        }
        out.truncate(len);
    }
}

pub fn text_bytes(seed: u64, len: usize) -> Vec<u8> {
    let mut out = Vec::with_capacity(len + 128);
    TextGen::new(seed).fill(&mut out, len);
    out
}

pub fn sha256_hex(data: &[u8]) -> String {
    hex::encode(Sha256::digest(data))
}

/// One file of an archive: the path asked for, its bytes, and how it is stored as a source.
#[derive(Debug, Clone)]
pub struct Fixture {
    pub path: String,
    pub data: Bytes,
    /// Content-addressed by default, like Metorial's stores.
    pub key: String,
    pub content_type: Option<String>,
    pub compression: Option<&'static str>,
    pub size: Option<u64>,
    pub crc32: Option<u32>,
    /// The method the service should pick, when the test cares.
    pub expect: Option<Method>,
}

impl Fixture {
    pub fn new(path: &str, data: impl Into<Bytes>) -> Self {
        let data = data.into();
        Fixture {
            path: path.to_string(),
            key: format!("cas/{}", sha256_hex(&data)),
            data,
            content_type: None,
            compression: None,
            size: None,
            crc32: None,
            expect: None,
        }
    }

    pub fn expect(mut self, method: Method) -> Self {
        self.expect = Some(method);
        self
    }

    pub fn content_type(mut self, content_type: &str) -> Self {
        self.content_type = Some(content_type.to_string());
        self
    }

    pub fn compression(mut self, compression: &'static str) -> Self {
        self.compression = Some(compression);
        self
    }

    pub fn key(mut self, key: &str) -> Self {
        self.key = key.to_string();
        self
    }

    pub fn crc32(&self) -> u32 {
        crc32fast::hash(&self.data)
    }

    pub fn with_checks(mut self) -> Self {
        self.size = Some(self.data.len() as u64);
        self.crc32 = Some(crc32fast::hash(&self.data));
        self
    }

    pub fn entry(&self, source_bucket: &str) -> Value {
        let mut entry = json!({
            "path": self.path,
            "source": { "bucket": source_bucket, "key": self.key },
        });
        if let Some(compression) = self.compression {
            entry["compression"] = json!(compression);
        }
        if let Some(size) = self.size {
            entry["size"] = json!(size);
        }
        if let Some(crc32) = self.crc32 {
            entry["crc32"] = json!(crc32);
        }
        entry
    }
}

/// Uploads every distinct source once, 32 at a time.
pub async fn upload_fixtures(api: &Api, bucket: &str, fixtures: &[Fixture]) {
    let mut distinct: BTreeMap<&str, &Fixture> = BTreeMap::new();
    for fixture in fixtures {
        distinct.entry(fixture.key.as_str()).or_insert(fixture);
    }
    futures::stream::iter(distinct.into_values())
        .map(|fixture| async move {
            api.put_object(
                bucket,
                &fixture.key,
                fixture.data.clone(),
                fixture.content_type.as_deref(),
            )
            .await
        })
        .buffer_unordered(32)
        .collect::<Vec<_>>()
        .await;
}

pub fn spec_for(
    destination_bucket: &str,
    destination_key: &str,
    source_bucket: &str,
    fixtures: &[Fixture],
) -> Value {
    json!({
        "destination": { "bucket": destination_bucket, "key": destination_key },
        "entries": fixtures.iter().map(|fixture| fixture.entry(source_bucket)).collect::<Vec<_>>(),
    })
}

/// What the archive should hold, in archive order (requested paths sorted bytewise), with the
/// archive paths the job reported in `renamedEntries`.
pub fn expected_entries(fixtures: &[Fixture], job: &Value) -> Vec<Expected> {
    let renamed = renamed_map(job);
    let mut sorted: Vec<&Fixture> = fixtures.iter().collect();
    sorted.sort_by(|a, b| a.path.as_bytes().cmp(b.path.as_bytes()));
    sorted
        .into_iter()
        .map(|fixture| Expected {
            path: renamed
                .get(&fixture.path)
                .cloned()
                .unwrap_or_else(|| fixture.path.clone()),
            size: fixture.data.len() as u64,
            crc32: fixture.crc32(),
            data: Some(fixture.data.clone()),
            method: fixture.expect,
        })
        .collect()
}

pub fn renamed_map(job: &Value) -> BTreeMap<String, String> {
    job["result"]["renamedEntries"]
        .as_array()
        .map(|entries| {
            entries
                .iter()
                .map(|entry| {
                    (
                        entry["path"].as_str().unwrap().to_string(),
                        entry["archivePath"].as_str().unwrap().to_string(),
                    )
                })
                .collect()
        })
        .unwrap_or_default()
}

fn png_like(seed: u64, len: usize) -> Vec<u8> {
    let mut data = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
    data.extend(random_bytes(seed, len.saturating_sub(data.len())));
    data
}

fn gzip_like(seed: u64, len: usize) -> Vec<u8> {
    let mut data = vec![0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0, 0x03];
    data.extend(random_bytes(seed, len.saturating_sub(data.len())));
    data
}

fn zip_like(seed: u64, len: usize) -> Vec<u8> {
    let mut data = b"PK\x03\x04".to_vec();
    data.extend(random_bytes(seed, len.saturating_sub(data.len())));
    data
}

/// A realistic skills-marketplace export: `skills` skills of about ten files each across
/// plugins, with nested directories, dotfiles, empty files, binaries, already-compressed
/// images and archives, unicode and emoji names, files shared by many skills (one source each),
/// and a few files above the 1 MiB small-entry limit that stream.
pub fn marketplace(skills: usize, seed: u64) -> Vec<Fixture> {
    let mut rng = Rng::new(seed);
    let license = text_bytes(seed ^ 0x11c3, 1070);
    let mut fixtures = Vec::new();

    for index in 0..skills {
        let plugin = format!("plugins/plugin-{:02}", index / 12);
        let skill = format!("{plugin}/skills/skill-{index:03}");
        let s = seed.wrapping_mul(1000).wrapping_add(index as u64);

        fixtures.push(
            Fixture::new(
                &format!("{skill}/SKILL.md"),
                text_bytes(s, rng.range(600, 6 * KIB) as usize),
            )
            .expect(Method::Deflated),
        );
        fixtures.push(
            Fixture::new(
                &format!("{skill}/scripts/run.sh"),
                text_bytes(s + 1, rng.range(200, 2 * KIB) as usize),
            )
            .expect(Method::Deflated),
        );
        fixtures.push(
            Fixture::new(
                &format!("{skill}/scripts/lib/helper.py"),
                text_bytes(s + 2, rng.range(300, 3 * KIB) as usize),
            )
            .expect(Method::Deflated),
        );
        fixtures.push(
            Fixture::new(&format!("{skill}/LICENSE"), license.clone()).expect(Method::Deflated),
        );
        fixtures.push(
            Fixture::new(&format!("{skill}/scripts/__init__.py"), Vec::new())
                .expect(Method::Stored),
        );
        fixtures.push(
            Fixture::new(
                &format!("{skill}/assets/icon.png"),
                png_like(s + 3, rng.range(512, 24 * KIB) as usize),
            )
            .content_type("image/png")
            .expect(Method::Stored),
        );
        fixtures.push(
            Fixture::new(
                &format!("{skill}/assets/weights.bin"),
                random_bytes(s + 4, rng.range(64, 40 * KIB) as usize),
            )
            .expect(Method::Stored),
        );
        fixtures.push(
            Fixture::new(
                &format!("{skill}/references/deep/nested/dir/notes-{index}.md"),
                text_bytes(s + 5, rng.range(KIB, 8 * KIB) as usize),
            )
            .expect(Method::Deflated),
        );

        match index % 6 {
            0 => fixtures.push(
                Fixture::new(
                    &format!("{skill}/.github/workflows/ci.yml"),
                    format!("name: ci-{index}\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ./scripts/run.sh --skill {index} --verbose --check\n").into_bytes(),
                )
                .expect(Method::Deflated),
            ),
            1 => fixtures.push(
                Fixture::new(&format!("{skill}/.env.example"), b"API_KEY=\n".to_vec()).expect(Method::Stored),
            ),
            2 => fixtures.push(
                Fixture::new(
                    &format!("{skill}/docs/日本語ガイド.md"),
                    text_bytes(s + 6, 2000),
                )
                .expect(Method::Deflated),
            ),
            3 => fixtures.push(
                Fixture::new(
                    &format!("{skill}/notes/émoji 🎉 résumé.md"),
                    text_bytes(s + 7, 900),
                )
                .expect(Method::Deflated),
            ),
            4 => fixtures.push(
                Fixture::new(
                    &format!("{skill}/dist/bundle.tar.gz"),
                    gzip_like(s + 8, rng.range(KIB, 30 * KIB) as usize),
                )
                .expect(Method::Stored),
            ),
            _ => fixtures.push(
                Fixture::new(
                    &format!("{skill}/dist/package.zip"),
                    zip_like(s + 9, rng.range(KIB, 30 * KIB) as usize),
                )
                .expect(Method::Stored),
            ),
        }

        if index % 3 == 0 {
            fixtures.push(
                Fixture::new(
                    &format!("{skill}/references/api.md"),
                    text_bytes(s + 10, rng.range(4 * KIB, 20 * KIB) as usize),
                )
                .expect(Method::Deflated),
            );
        }

        if index % 60 == 7 {
            fixtures.push(
                Fixture::new(
                    &format!("{skill}/assets/model.onnx"),
                    random_bytes(s + 11, (MIB + 300 * KIB) as usize),
                )
                .expect(Method::Stored),
            );
            fixtures.push(
                Fixture::new(
                    &format!("{skill}/logs/eval.log"),
                    text_bytes(s + 12, (MIB + 100 * KIB) as usize),
                )
                .expect(Method::Deflated),
            );
        }
    }

    fixtures
}

/// Odd but legal file names, the archive path each must get, and unique content per file.
pub fn awkward_names() -> Vec<(Fixture, &'static str)> {
    let names: &[(&str, &str)] = &[
        ("what?.md", "what_.md"),
        ("CON", "CON_"),
        ("aux.md", "aux_.md"),
        ("COM1.txt", "COM1_.txt"),
        ("a:b", "a_b"),
        ("notes.", "notes_"),
        ("trailing space ", "trailing space_"),
        ("README.md", "README.md"),
        ("readme.md", "readme~2.md"),
        ("a", "a~2"),
        ("a/b", "a/b"),
        ("evil\u{202E}gpj.exe", "evil_gpj.exe"),
        ("SKILL\u{200B}.md", "SKILL_.md"),
        ("\u{FF0E}\u{FF0E}/x", "__/x"),
        ("dir\\file.txt", "dir_file.txt"),
        ("pipe|star*quote\"lt<gt>.txt", "pipe_star_quote_lt_gt_.txt"),
        ("cafe\u{301}.md", "cafe\u{301}.md"),
        ("caf\u{e9}.md", "caf\u{e9}~2.md"),
        ("🎉 party/日本語.md", "🎉 party/日本語.md"),
        (".github/workflows/ci.yml", ".github/workflows/ci.yml"),
        ("tab\there.txt", "tab_here.txt"),
    ];
    names
        .iter()
        .enumerate()
        .map(|(index, (path, archive_path))| {
            let data = format!("file {index}: {path:?}\n").into_bytes();
            (Fixture::new(path, data), *archive_path)
        })
        .collect()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Gen {
    Random,
    Text,
}

#[derive(Debug, Clone, Copy)]
pub struct Generated {
    pub size: u64,
    pub crc32: u32,
}

/// Streams `size` generated bytes into an object, without holding them, and returns their
/// CRC-32. The same `gen` and `seed` always produce the same bytes.
pub async fn put_generated(
    api: &Api,
    bucket: &str,
    key: &str,
    gen: Gen,
    seed: u64,
    size: u64,
) -> Generated {
    let crc = Arc::new(Mutex::new(crc32fast::Hasher::new()));
    let stream = generated_stream(gen, seed, size, Some(crc.clone()));
    api.put_object_stream(bucket, key, size, stream).await;
    let crc32 = crc.lock().unwrap().clone().finalize();
    Generated { size, crc32 }
}

pub fn generated_stream(
    gen: Gen,
    seed: u64,
    size: u64,
    crc: Option<Arc<Mutex<crc32fast::Hasher>>>,
) -> impl futures::Stream<Item = std::io::Result<Bytes>> + Send + Sync + 'static {
    const CHUNK: usize = 1 << 20;
    let state = (Rng::new(seed), TextGen::new(seed), 0u64, Vec::new());
    futures::stream::unfold(state, move |(mut rng, mut text, sent, mut carry)| {
        let crc = crc.clone();
        async move {
            if sent >= size {
                return None;
            }
            let len = CHUNK.min((size - sent) as usize);
            let chunk = match gen {
                Gen::Random => {
                    let mut buffer = BytesMut::zeroed(len);
                    rng.fill(&mut buffer);
                    buffer.freeze()
                }
                Gen::Text => {
                    let mut buffer = std::mem::take(&mut carry);
                    if buffer.len() < len {
                        text.fill(&mut buffer, len + 256);
                    }
                    let rest = buffer.split_off(len);
                    carry = rest;
                    Bytes::from(buffer)
                }
            };
            if let Some(crc) = &crc {
                crc.lock().unwrap().update(&chunk);
            }
            Some((Ok(chunk), (rng, text, sent + len as u64, carry)))
        }
    })
}

/// A 4 MiB text source and a spec that deflates it at level 9 `entries` times, under different
/// paths: a job that takes about `entries * slow_entry_seconds()` and reads it once per entry.
pub struct SlowSource {
    pub bucket: String,
    pub key: String,
    pub crc32: u32,
}

pub const SLOW_SOURCE_BYTES: u64 = 4 * MIB;

impl SlowSource {
    pub async fn upload(api: &Api, bucket: &str) -> SlowSource {
        let key = "slow/source.txt".to_string();
        let data = text_bytes(0x51_0e, SLOW_SOURCE_BYTES as usize);
        let crc32 = crc32fast::hash(&data);
        api.put_object(bucket, &key, data, Some("text/plain")).await;
        SlowSource {
            bucket: bucket.to_string(),
            key,
            crc32,
        }
    }

    pub fn spec(&self, destination_bucket: &str, destination_key: &str, entries: usize) -> Value {
        json!({
            "destination": { "bucket": destination_bucket, "key": destination_key },
            "entries": (0..entries).map(|index| json!({
                "path": format!("slow/{index:04}.txt"),
                "source": { "bucket": self.bucket, "key": self.key },
                "compression": "deflate",
            })).collect::<Vec<_>>(),
            "deflateLevel": 9,
        })
    }

    pub fn expected(&self, entries: usize) -> Vec<Expected> {
        (0..entries)
            .map(|index| Expected {
                path: format!("slow/{index:04}.txt"),
                size: SLOW_SOURCE_BYTES,
                crc32: self.crc32,
                data: None,
                method: Some(Method::Deflated),
            })
            .collect()
    }
}
