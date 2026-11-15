use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::error::ZipJobError;
use super::plan::plan_renames;
use super::settings::ZipSettings;
use crate::metadata::is_valid_bucket_name;
use crate::service::{validate_deletable_object_key, validate_object_key};

pub const DEFAULT_DEFLATE_LEVEL: u32 = 6;
pub const MAX_DEFLATE_LEVEL: u32 = 9;
pub const DEFAULT_ARCHIVE_CONTENT_TYPE: &str = "application/zip";

/// Top-level names inside a bucket that archives may not be written to, so an archive can never
/// stand in for service state.
const RESERVED_DESTINATION_SEGMENTS: &[&str] = &[".metadata", ".uploads", ".bucket"];

const SPEC_HASH_DOMAIN: &[u8] = b"object-store/zip-job-spec/v1\n";

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ZipJobSpec {
    pub destination: ZipDestination,
    pub entries: Vec<ZipEntrySpec>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deflate_level: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_archive_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ZipDestination {
    pub bucket: String,
    pub key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ZipEntrySpec {
    pub path: String,
    pub source: ObjectRef,
    #[serde(default)]
    pub compression: CompressionHint,
    /// Expected source size; the job fails with `source_changed` if HEAD disagrees.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    /// Expected CRC-32 of the source. Lets large stored entries skip the data descriptor; the
    /// job fails with `crc_mismatch` if the data disagrees.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crc32: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ObjectRef {
    pub bucket: String,
    pub key: String,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CompressionHint {
    #[default]
    Auto,
    Store,
    Deflate,
}

impl ZipJobSpec {
    pub fn deflate_level(&self) -> u32 {
        self.deflate_level.unwrap_or(DEFAULT_DEFLATE_LEVEL)
    }

    pub fn content_type(&self) -> &str {
        self.destination
            .content_type
            .as_deref()
            .unwrap_or(DEFAULT_ARCHIVE_CONTENT_TYPE)
    }

    /// The tighter of the spec's and the service's archive size limit.
    pub fn archive_limit(&self, settings: &ZipSettings) -> u64 {
        self.max_archive_bytes
            .unwrap_or(u64::MAX)
            .min(settings.max_archive_bytes)
    }

    /// Checks everything that can be checked without touching storage: entry count, bucket
    /// names and keys, the destination (not a source, not under a reserved name), the Deflate
    /// level, `maxArchiveBytes`, and every entry path (`invalid_path` / `duplicate_path`).
    pub fn validate(&self, settings: &ZipSettings) -> Result<(), ZipJobError> {
        self.validate_fields(settings)?;

        let mut order: Vec<usize> = (0..self.entries.len()).collect();
        order.sort_unstable_by(|&a, &b| self.entries[a].path.cmp(&self.entries[b].path));
        plan_renames(order.len(), |rank| &self.entries[order[rank]].path, true)
            .map_err(ZipJobError::from_path)?;
        Ok(())
    }

    /// Everything [`validate`](Self::validate) checks except the entry paths.
    pub(crate) fn validate_fields(&self, settings: &ZipSettings) -> Result<(), ZipJobError> {
        if self.entries.is_empty() {
            return Err(ZipJobError::invalid_spec("the archive has no entries"));
        }

        if self.entries.len() > settings.max_entries {
            return Err(ZipJobError::invalid_spec(format!(
                "the archive has {} entries, more than the limit of {}",
                self.entries.len(),
                settings.max_entries
            )));
        }

        let level = self.deflate_level();
        if level > MAX_DEFLATE_LEVEL {
            return Err(ZipJobError::invalid_spec(format!(
                "deflateLevel {} is outside 0..={}",
                level, MAX_DEFLATE_LEVEL
            )));
        }

        if let Some(max) = self.max_archive_bytes {
            if max > settings.max_archive_bytes {
                return Err(ZipJobError::invalid_spec(format!(
                    "maxArchiveBytes {} is above the service limit of {} bytes",
                    max, settings.max_archive_bytes
                )));
            }
        }

        let destination = &self.destination;
        validate_bucket("destination", &destination.bucket)?;
        validate_deletable_object_key(&destination.key)
            .map_err(|error| ZipJobError::invalid_spec(format!("destination: {}", error)))?;
        if let Some(reserved) = reserved_segment(&destination.key) {
            return Err(ZipJobError::invalid_spec(format!(
                "destination key {:?} is under the reserved name {:?}",
                destination.key, reserved
            )));
        }
        let destination_key = comparable_key(&destination.key);

        for entry in &self.entries {
            let source = &entry.source;
            validate_bucket("source", &source.bucket)?;
            validate_object_key(&source.key).map_err(|error| {
                ZipJobError::invalid_spec(format!("source of {:?}: {}", entry.path, error))
            })?;

            if source.bucket == destination.bucket && comparable_key(&source.key) == destination_key
            {
                return Err(ZipJobError::invalid_spec(format!(
                    "entry {:?} reads the destination object {}/{}",
                    entry.path, destination.bucket, destination.key
                )));
            }
        }

        Ok(())
    }

    /// A hex SHA-256 identifying what the spec produces, for job idempotency. Entries are hashed
    /// in archive order (sorted by path), since request order does not change the output; every
    /// other field, including defaults made explicit, is hashed as given.
    ///
    /// The canonical JSON is streamed into the hash, so hashing a spec of a million entries
    /// allocates one pointer per entry rather than a copy of the spec.
    pub fn spec_hash(&self) -> String {
        let mut entries: Vec<&ZipEntrySpec> = self.entries.iter().collect();
        entries.sort_by(|a, b| {
            a.path
                .cmp(&b.path)
                .then_with(|| canonical_entry_json(a).cmp(&canonical_entry_json(b)))
        });

        let canonical = CanonicalSpec {
            deflate_level: self.deflate_level(),
            destination: CanonicalDestination {
                bucket: &self.destination.bucket,
                content_type: self.content_type(),
                key: &self.destination.key,
            },
            entries: CanonicalEntries(&entries),
            max_archive_bytes: self.max_archive_bytes,
        };

        let mut hasher = HashWriter(Sha256::new());
        hasher.0.update(SPEC_HASH_DOMAIN);
        serde_json::to_writer(&mut hasher, &canonical)
            .expect("serializing a spec into a hash cannot fail");
        hex::encode(hasher.0.finalize())
    }
}

// Field order is part of the hash: keys are sorted, as serde_json's default map sorts them.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CanonicalSpec<'a> {
    deflate_level: u32,
    destination: CanonicalDestination<'a>,
    entries: CanonicalEntries<'a>,
    max_archive_bytes: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CanonicalDestination<'a> {
    bucket: &'a str,
    content_type: &'a str,
    key: &'a str,
}

struct CanonicalEntries<'a>(&'a [&'a ZipEntrySpec]);

impl Serialize for CanonicalEntries<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_seq(self.0.iter().map(|entry| canonical_entry(entry)))
    }
}

type CanonicalEntry<'a> = (
    &'a str,
    &'a str,
    &'a str,
    CompressionHint,
    Option<u64>,
    Option<u32>,
);

fn canonical_entry(entry: &ZipEntrySpec) -> CanonicalEntry<'_> {
    (
        &entry.path,
        &entry.source.bucket,
        &entry.source.key,
        entry.compression,
        entry.size,
        entry.crc32,
    )
}

fn canonical_entry_json(entry: &ZipEntrySpec) -> String {
    serde_json::to_string(&canonical_entry(entry)).expect("serializing an entry cannot fail")
}

struct HashWriter(Sha256);

impl std::io::Write for HashWriter {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        self.0.update(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

fn validate_bucket(role: &str, bucket: &str) -> Result<(), ZipJobError> {
    if is_valid_bucket_name(bucket) {
        Ok(())
    } else {
        Err(ZipJobError::invalid_spec(format!(
            "{} bucket name {:?} is invalid",
            role, bucket
        )))
    }
}

fn reserved_segment(key: &str) -> Option<&'static str> {
    let first = key.split('/').find(|segment| !segment.is_empty())?;
    RESERVED_DESTINATION_SEGMENTS
        .iter()
        .copied()
        .find(|reserved| first.eq_ignore_ascii_case(reserved))
}

// Some backends map keys onto file paths, where empty segments collapse.
fn comparable_key(key: &str) -> Vec<&str> {
    key.split('/')
        .filter(|segment| !segment.is_empty())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::zip::ZipErrorCode;

    fn entry(path: &str, key: &str) -> ZipEntrySpec {
        ZipEntrySpec {
            path: path.to_string(),
            source: ObjectRef {
                bucket: "files".to_string(),
                key: key.to_string(),
            },
            compression: CompressionHint::Auto,
            size: None,
            crc32: None,
        }
    }

    fn spec(entries: Vec<ZipEntrySpec>) -> ZipJobSpec {
        ZipJobSpec {
            destination: ZipDestination {
                bucket: "files".to_string(),
                key: "exports/a.zip".to_string(),
                content_type: None,
            },
            entries,
            deflate_level: None,
            max_archive_bytes: None,
        }
    }

    fn code(spec: &ZipJobSpec) -> ZipErrorCode {
        spec.validate(&ZipSettings::default()).unwrap_err().code
    }

    #[test]
    fn parses_the_documented_shape() {
        let parsed: ZipJobSpec = serde_json::from_value(serde_json::json!({
            "destination": { "bucket": "cargo-files", "key": "exports/x.zip", "contentType": "application/zip" },
            "entries": [
                { "path": "a/SKILL.md", "source": { "bucket": "cargo-files", "key": "store-1" },
                  "compression": "store", "size": 1834, "crc32": 2771534123u32 },
                { "path": "b.txt", "source": { "bucket": "cargo-files", "key": "store-2" } }
            ],
            "deflateLevel": 9,
            "maxArchiveBytes": null
        }))
        .unwrap();

        assert_eq!(parsed.deflate_level(), 9);
        assert_eq!(parsed.max_archive_bytes, None);
        assert_eq!(parsed.entries[0].compression, CompressionHint::Store);
        assert_eq!(parsed.entries[0].crc32, Some(2_771_534_123));
        assert_eq!(parsed.entries[1].compression, CompressionHint::Auto);
        parsed.validate(&ZipSettings::default()).unwrap();
    }

    #[test]
    fn rejects_unknown_fields() {
        for value in [
            serde_json::json!({ "destination": { "bucket": "files", "key": "a.zip" }, "entries": [], "level": 3 }),
            serde_json::json!({ "destination": { "bucket": "files", "key": "a.zip", "acl": "x" }, "entries": [] }),
            serde_json::json!({ "destination": { "bucket": "files", "key": "a.zip" },
                "entries": [{ "path": "a", "source": { "bucket": "files", "key": "k" }, "mode": 1 }] }),
            serde_json::json!({ "destination": { "bucket": "files", "key": "a.zip" },
                "entries": [{ "path": "a", "source": { "bucket": "files", "key": "k" }, "compression": "zstd" }] }),
        ] {
            assert!(serde_json::from_value::<ZipJobSpec>(value).is_err());
        }
    }

    #[test]
    fn rejects_invalid_specs() {
        assert_eq!(code(&spec(vec![])), ZipErrorCode::InvalidSpec);

        let settings = ZipSettings {
            max_entries: 2,
            ..ZipSettings::default()
        };
        let three = spec(vec![entry("a", "1"), entry("b", "2"), entry("c", "3")]);
        assert_eq!(
            three.validate(&settings).unwrap_err().code,
            ZipErrorCode::InvalidSpec
        );

        let mut level = spec(vec![entry("a", "1")]);
        level.deflate_level = Some(10);
        assert_eq!(code(&level), ZipErrorCode::InvalidSpec);
        level.deflate_level = Some(0);
        level.validate(&ZipSettings::default()).unwrap();

        let mut limit = spec(vec![entry("a", "1")]);
        limit.max_archive_bytes = Some(ZipSettings::default().max_archive_bytes + 1);
        assert_eq!(code(&limit), ZipErrorCode::InvalidSpec);

        for key in [
            ".metadata/buckets/files.json",
            ".METADATA/x",
            ".uploads/abc",
            ".bucket",
            "x/.bucket",
            "../escape.zip",
            "/abs.zip",
            "",
        ] {
            let mut destination = spec(vec![entry("a", "1")]);
            destination.destination.key = key.to_string();
            assert_eq!(code(&destination), ZipErrorCode::InvalidSpec, "{key}");
        }

        let mut bucket = spec(vec![entry("a", "1")]);
        bucket.destination.bucket = "Bad_Bucket".to_string();
        assert_eq!(code(&bucket), ZipErrorCode::InvalidSpec);

        for key in ["exports/a.zip", "exports//a.zip"] {
            let reads_itself = spec(vec![entry("a", "1"), entry("b", key)]);
            assert_eq!(code(&reads_itself), ZipErrorCode::InvalidSpec, "{key}");
        }

        let bad_source = spec(vec![entry("a", "../x")]);
        assert_eq!(code(&bad_source), ZipErrorCode::InvalidSpec);
    }

    #[test]
    fn reports_path_errors_by_kind() {
        for path in ["", "/abs", "a/../b", "a//b", "dir/"] {
            assert_eq!(
                code(&spec(vec![entry(path, "1")])),
                ZipErrorCode::InvalidPath,
                "{path}"
            );
        }

        assert_eq!(
            code(&spec(vec![entry("same", "1"), entry("same", "2")])),
            ZipErrorCode::DuplicatePath
        );

        spec(vec![entry("README.md", "1"), entry("readme.md", "2")])
            .validate(&ZipSettings::default())
            .unwrap();
    }

    #[test]
    fn hashes_independently_of_entry_order_and_explicit_defaults() {
        let a = spec(vec![entry("x", "1"), entry("y", "2")]);
        let mut b = spec(vec![entry("y", "2"), entry("x", "1")]);
        assert_eq!(a.spec_hash(), b.spec_hash());

        b.deflate_level = Some(DEFAULT_DEFLATE_LEVEL);
        b.destination.content_type = Some(DEFAULT_ARCHIVE_CONTENT_TYPE.to_string());
        assert_eq!(a.spec_hash(), b.spec_hash());

        let parsed: ZipJobSpec = serde_json::from_str(&serde_json::to_string(&a).unwrap()).unwrap();
        assert_eq!(parsed.spec_hash(), a.spec_hash());
    }

    /// The hash as first defined, through a `serde_json::Value`; stored jobs carry it, so the
    /// streamed form must stay byte-identical.
    fn reference_hash(spec: &ZipJobSpec) -> String {
        let entry_value = |entry: &ZipEntrySpec| {
            serde_json::json!([
                entry.path,
                entry.source.bucket,
                entry.source.key,
                entry.compression,
                entry.size,
                entry.crc32,
            ])
        };
        let mut entries: Vec<&ZipEntrySpec> = spec.entries.iter().collect();
        entries.sort_by(|a, b| {
            a.path
                .cmp(&b.path)
                .then_with(|| entry_value(a).to_string().cmp(&entry_value(b).to_string()))
        });
        let canonical = serde_json::json!({
            "destination": {
                "bucket": spec.destination.bucket,
                "key": spec.destination.key,
                "contentType": spec.content_type(),
            },
            "deflateLevel": spec.deflate_level(),
            "maxArchiveBytes": spec.max_archive_bytes,
            "entries": entries.iter().map(|entry| entry_value(entry)).collect::<Vec<_>>(),
        });
        let mut hasher = Sha256::new();
        hasher.update(SPEC_HASH_DOMAIN);
        hasher.update(canonical.to_string().as_bytes());
        hex::encode(hasher.finalize())
    }

    #[test]
    fn streamed_hash_matches_the_reference_form() {
        let mut full = spec(vec![
            entry("b/\"quoted\"\\path", "k\u{1}"),
            entry("a/caf\u{e9}.md", "2"),
            entry("same", "1"),
            entry("same", "0"),
        ]);
        full.entries[0].compression = CompressionHint::Deflate;
        full.entries[0].size = Some(u64::MAX);
        full.entries[0].crc32 = Some(u32::MAX);
        full.entries[1].compression = CompressionHint::Store;
        full.deflate_level = Some(9);
        full.max_archive_bytes = Some(12345);
        full.destination.content_type = Some("application/x-zip; q=\"1\"".to_string());

        for spec in [spec(vec![entry("x", "1")]), full] {
            assert_eq!(spec.spec_hash(), reference_hash(&spec));
        }
    }

    #[test]
    fn hashes_every_field_that_changes_the_output() {
        let base = spec(vec![entry("x", "1"), entry("y", "2")]);
        let hash = base.spec_hash();

        let variants: [fn(&mut ZipJobSpec); 12] = [
            |s| s.destination.bucket = "other".to_string(),
            |s| s.destination.key = "exports/b.zip".to_string(),
            |s| s.destination.content_type = Some("application/octet-stream".into()),
            |s| s.deflate_level = Some(1),
            |s| s.max_archive_bytes = Some(10),
            |s| s.entries[0].path = "z".to_string(),
            |s| s.entries[0].source.key = "3".to_string(),
            |s| s.entries[0].source.bucket = "other".to_string(),
            |s| s.entries[0].compression = CompressionHint::Store,
            |s| s.entries[0].size = Some(1),
            |s| s.entries[0].crc32 = Some(1),
            |s| s.entries.truncate(1),
        ];

        for (index, change) in variants.iter().enumerate() {
            let mut changed = base.clone();
            change(&mut changed);
            assert_ne!(changed.spec_hash(), hash, "variant {index}");
        }
    }
}
