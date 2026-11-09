use object_store_backends::{
    azure::{AzureAuth, AzureBackend, AzureOptions},
    gcs::{GcsBackend, GcsOptions},
    local::LocalBackend,
    s3::{S3Backend, S3Options},
    Backend, UploadSettings, Uploader,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use crate::router::RouterOptions;
use crate::service::DEFAULT_MAX_CONCURRENT_DIGESTS;
use crate::zip::{ZipSettings, MAX_FETCH_CONCURRENCY, MAX_SMALL_ENTRY_BYTES};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub backend: BackendConfig,
    #[serde(default)]
    pub uploads: UploadsConfig,
    #[serde(default)]
    pub zip: ZipConfig,
    #[serde(default)]
    pub digests: DigestsConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DigestsConfig {
    /// Stored objects hashed at once by the digests route; further requests wait.
    #[serde(default = "default_max_concurrent_digests")]
    pub max_concurrent: usize,
}

impl Default for DigestsConfig {
    fn default() -> Self {
        Self {
            max_concurrent: default_max_concurrent_digests(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ZipConfig {
    #[serde(default = "default_zip_max_concurrent_jobs")]
    pub max_concurrent_jobs: usize,
    #[serde(default = "default_zip_max_queued_jobs")]
    pub max_queued_jobs: usize,
    #[serde(default = "default_zip_fetch_concurrency")]
    pub fetch_concurrency: usize,
    #[serde(default = "default_zip_small_entry_bytes")]
    pub small_entry_bytes: u64,
    #[serde(default = "default_zip_max_entries")]
    pub max_entries: usize,
    #[serde(default = "default_zip_max_spec_bytes")]
    pub max_spec_bytes: usize,
    #[serde(default = "default_zip_max_parsing_spec_bytes")]
    pub max_parsing_spec_bytes: usize,
    #[serde(default = "default_zip_max_archive_bytes")]
    pub max_archive_bytes: u64,
    #[serde(default = "default_zip_max_wait_seconds")]
    pub max_wait_seconds: u64,
    #[serde(default = "default_zip_job_retention_hours")]
    pub job_retention_hours: u64,
    #[serde(default = "default_zip_heartbeat_seconds")]
    pub heartbeat_seconds: u64,
    #[serde(default = "default_zip_lease_seconds")]
    pub lease_seconds: u64,
    #[serde(default = "default_zip_lease_skew_grace_seconds")]
    pub lease_skew_grace_seconds: u64,
    #[serde(default = "default_zip_shutdown_grace_seconds")]
    pub shutdown_grace_seconds: u64,
    #[serde(default = "default_zip_upload_memory_budget_bytes")]
    pub upload_memory_budget_bytes: u64,
    #[serde(default)]
    pub compression_parallelism: Option<usize>,
}

impl Default for ZipConfig {
    fn default() -> Self {
        Self {
            max_concurrent_jobs: default_zip_max_concurrent_jobs(),
            max_queued_jobs: default_zip_max_queued_jobs(),
            fetch_concurrency: default_zip_fetch_concurrency(),
            small_entry_bytes: default_zip_small_entry_bytes(),
            max_entries: default_zip_max_entries(),
            max_spec_bytes: default_zip_max_spec_bytes(),
            max_parsing_spec_bytes: default_zip_max_parsing_spec_bytes(),
            max_archive_bytes: default_zip_max_archive_bytes(),
            max_wait_seconds: default_zip_max_wait_seconds(),
            job_retention_hours: default_zip_job_retention_hours(),
            heartbeat_seconds: default_zip_heartbeat_seconds(),
            lease_seconds: default_zip_lease_seconds(),
            lease_skew_grace_seconds: default_zip_lease_skew_grace_seconds(),
            shutdown_grace_seconds: default_zip_shutdown_grace_seconds(),
            upload_memory_budget_bytes: default_zip_upload_memory_budget_bytes(),
            compression_parallelism: None,
        }
    }
}

impl ZipConfig {
    pub fn settings(&self) -> ZipSettings {
        ZipSettings {
            max_concurrent_jobs: self.max_concurrent_jobs.max(1),
            max_queued_jobs: self.max_queued_jobs,
            fetch_concurrency: self.fetch_concurrency.clamp(1, MAX_FETCH_CONCURRENCY),
            small_entry_bytes: self.small_entry_bytes.min(MAX_SMALL_ENTRY_BYTES),
            max_entries: self.max_entries,
            max_spec_bytes: self.max_spec_bytes,
            max_parsing_spec_bytes: self.max_parsing_spec_bytes,
            max_archive_bytes: self.max_archive_bytes,
            max_wait: Duration::from_secs(self.max_wait_seconds),
            job_retention: Duration::from_secs(self.job_retention_hours.saturating_mul(3600)),
            heartbeat_interval: Duration::from_secs(self.heartbeat_seconds.max(1)),
            lease: Duration::from_secs(self.lease_seconds.max(1)),
            lease_skew_grace: Duration::from_secs(self.lease_skew_grace_seconds),
            shutdown_grace: Duration::from_secs(self.shutdown_grace_seconds),
            compression_parallelism: self.compression_parallelism,
            ..ZipSettings::default()
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UploadsConfig {
    #[serde(default = "default_part_concurrency")]
    pub part_concurrency: u32,
    #[serde(default = "default_min_part_size_bytes")]
    pub min_part_size_bytes: u64,
    #[serde(default = "default_memory_budget_bytes")]
    pub memory_budget_bytes: u64,
}

impl Default for UploadsConfig {
    fn default() -> Self {
        Self {
            part_concurrency: default_part_concurrency(),
            min_part_size_bytes: default_min_part_size_bytes(),
            memory_budget_bytes: default_memory_budget_bytes(),
        }
    }
}

impl UploadsConfig {
    pub fn settings(&self) -> UploadSettings {
        UploadSettings {
            part_concurrency: self.part_concurrency.max(1),
            min_part_size: self.min_part_size_bytes,
            memory_budget_bytes: self.memory_budget_bytes,
            ..UploadSettings::default()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_request_timeout_secs")]
    pub request_timeout_secs: u64,
    #[serde(default = "default_upload_idle_timeout_secs")]
    pub upload_idle_timeout_secs: u64,
    #[serde(default = "default_upload_min_bytes_per_sec")]
    pub upload_min_bytes_per_sec: u64,
    #[serde(default = "default_upload_min_rate_grace_secs")]
    pub upload_min_rate_grace_secs: u64,
}

impl ServerConfig {
    pub fn router_options(&self) -> RouterOptions {
        RouterOptions {
            request_timeout: Duration::from_secs(self.request_timeout_secs),
            upload_idle_timeout: Duration::from_secs(self.upload_idle_timeout_secs),
            upload_min_bytes_per_sec: self.upload_min_bytes_per_sec,
            upload_min_rate_grace: Duration::from_secs(self.upload_min_rate_grace_secs),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AzureAuthMode {
    AccessKey,
    Default,
    WorkloadIdentity,
    ManagedIdentity,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum BackendConfig {
    Local {
        root_path: PathBuf,
        #[serde(default = "default_physical_bucket")]
        physical_bucket: String,
        public_url: Option<String>,
    },
    S3 {
        region: String,
        physical_bucket: String,
        endpoint: Option<String>,
        public_endpoint: Option<String>,
        force_path_style: Option<bool>,
    },
    Gcs {
        physical_bucket: String,
        endpoint: Option<String>,
        public_endpoint: Option<String>,
        credentials_file: Option<String>,
    },
    Azure {
        account: Option<String>,
        access_key: Option<String>,
        connection_string: Option<String>,
        physical_bucket: String,
        endpoint: Option<String>,
        public_endpoint: Option<String>,
        auth: Option<AzureAuthMode>,
    },
}

impl std::fmt::Debug for BackendConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BackendConfig::Local {
                root_path,
                physical_bucket,
                ..
            } => write!(f, "Local({:?}, {})", root_path, physical_bucket),
            BackendConfig::S3 {
                region,
                physical_bucket,
                endpoint,
                ..
            } => write!(f, "S3({}, {}, {:?})", physical_bucket, region, endpoint),
            BackendConfig::Gcs {
                physical_bucket,
                endpoint,
                ..
            } => write!(f, "Gcs({}, {:?})", physical_bucket, endpoint),
            BackendConfig::Azure {
                account,
                physical_bucket,
                endpoint,
                ..
            } => write!(
                f,
                "Azure({:?}, {}, {:?})",
                account, physical_bucket, endpoint
            ),
        }
    }
}

fn default_host() -> String {
    "127.0.0.1".to_string()
}

fn default_port() -> u16 {
    8080
}

fn default_request_timeout_secs() -> u64 {
    RouterOptions::default().request_timeout.as_secs()
}

fn default_upload_idle_timeout_secs() -> u64 {
    RouterOptions::default().upload_idle_timeout.as_secs()
}

fn default_upload_min_bytes_per_sec() -> u64 {
    RouterOptions::default().upload_min_bytes_per_sec
}

fn default_upload_min_rate_grace_secs() -> u64 {
    RouterOptions::default().upload_min_rate_grace.as_secs()
}

fn default_physical_bucket() -> String {
    "object-store-data".to_string()
}

fn default_part_concurrency() -> u32 {
    UploadSettings::default().part_concurrency
}

fn default_min_part_size_bytes() -> u64 {
    UploadSettings::default().min_part_size
}

fn default_memory_budget_bytes() -> u64 {
    UploadSettings::default().memory_budget_bytes
}

fn default_max_concurrent_digests() -> usize {
    DEFAULT_MAX_CONCURRENT_DIGESTS
}

fn default_zip_max_concurrent_jobs() -> usize {
    ZipSettings::default().max_concurrent_jobs
}

fn default_zip_max_queued_jobs() -> usize {
    ZipSettings::default().max_queued_jobs
}

fn default_zip_fetch_concurrency() -> usize {
    ZipSettings::default().fetch_concurrency
}

fn default_zip_small_entry_bytes() -> u64 {
    ZipSettings::default().small_entry_bytes
}

fn default_zip_max_entries() -> usize {
    ZipSettings::default().max_entries
}

fn default_zip_max_spec_bytes() -> usize {
    ZipSettings::default().max_spec_bytes
}

fn default_zip_max_parsing_spec_bytes() -> usize {
    ZipSettings::default().max_parsing_spec_bytes
}

fn default_zip_max_archive_bytes() -> u64 {
    ZipSettings::default().max_archive_bytes
}

fn default_zip_max_wait_seconds() -> u64 {
    ZipSettings::default().max_wait.as_secs()
}

fn default_zip_job_retention_hours() -> u64 {
    ZipSettings::default().job_retention.as_secs() / 3600
}

fn default_zip_heartbeat_seconds() -> u64 {
    ZipSettings::default().heartbeat_interval.as_secs()
}

fn default_zip_lease_seconds() -> u64 {
    ZipSettings::default().lease.as_secs()
}

fn default_zip_lease_skew_grace_seconds() -> u64 {
    ZipSettings::default().lease_skew_grace.as_secs()
}

fn default_zip_shutdown_grace_seconds() -> u64 {
    ZipSettings::default().shutdown_grace.as_secs()
}

fn default_zip_upload_memory_budget_bytes() -> u64 {
    256 * 1024 * 1024
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: default_host(),
                port: default_port(),
                request_timeout_secs: default_request_timeout_secs(),
                upload_idle_timeout_secs: default_upload_idle_timeout_secs(),
                upload_min_bytes_per_sec: default_upload_min_bytes_per_sec(),
                upload_min_rate_grace_secs: default_upload_min_rate_grace_secs(),
            },
            backend: BackendConfig::Local {
                root_path: PathBuf::from("./data"),
                physical_bucket: default_physical_bucket(),
                public_url: None,
            },
            uploads: UploadsConfig::default(),
            zip: ZipConfig::default(),
            digests: DigestsConfig::default(),
        }
    }
}

/// Time a waiting zip job request keeps in hand below the request timeout, to read the record
/// and answer.
const WAIT_TIMEOUT_MARGIN: Duration = Duration::from_secs(5);

impl Config {
    /// The zip settings, with `max_wait` lowered if needed so a waiting request always answers
    /// before the request timeout cuts it off.
    pub fn zip_settings(&self) -> ZipSettings {
        let mut settings = self.zip.settings();
        settings.max_wait = settings
            .max_wait
            .min(wait_limit(self.server.router_options().request_timeout));
        settings
    }

    /// Archives are written through an uploader of their own, with its own memory budget, so zip
    /// jobs and client uploads can't starve each other.
    pub fn archive_upload_settings(&self) -> UploadSettings {
        UploadSettings {
            memory_budget_bytes: self.zip.upload_memory_budget_bytes,
            ..self.uploads.settings()
        }
    }

    pub fn from_file(path: &str) -> Result<Self, config::ConfigError> {
        let settings = config::Config::builder()
            .add_source(config::File::with_name(path))
            .add_source(environment())
            .build()?;

        settings.try_deserialize()
    }

    pub fn from_env() -> Result<Self, config::ConfigError> {
        let settings = config::Config::builder()
            .add_source(environment())
            .build()?;

        settings.try_deserialize()
    }
}

fn wait_limit(request_timeout: Duration) -> Duration {
    if request_timeout > WAIT_TIMEOUT_MARGIN * 2 {
        request_timeout - WAIT_TIMEOUT_MARGIN
    } else {
        request_timeout / 2
    }
}

fn environment() -> config::Environment {
    config::Environment::with_prefix("OBJECT_STORE").separator("__")
}

impl BackendConfig {
    pub async fn build(self, uploader: Arc<Uploader>) -> anyhow::Result<Arc<dyn Backend>> {
        Ok(match self {
            BackendConfig::Local {
                root_path,
                physical_bucket,
                public_url,
            } => Arc::new(
                LocalBackend::new(root_path, physical_bucket)
                    .with_public_base_url(public_url)
                    .with_uploader(uploader),
            ),
            BackendConfig::S3 {
                region,
                physical_bucket,
                endpoint,
                public_endpoint,
                force_path_style,
            } => Arc::new(
                S3Backend::new_with_options(
                    physical_bucket,
                    S3Options {
                        region,
                        endpoint,
                        public_endpoint,
                        force_path_style,
                    },
                )
                .await?
                .with_uploader(uploader),
            ),
            BackendConfig::Gcs {
                physical_bucket,
                endpoint,
                public_endpoint,
                credentials_file,
            } => Arc::new(
                GcsBackend::new_with_options(
                    physical_bucket,
                    GcsOptions {
                        endpoint,
                        public_endpoint,
                        credentials_file,
                    },
                )
                .await?
                .with_uploader(uploader),
            ),
            BackendConfig::Azure {
                account,
                access_key,
                connection_string,
                physical_bucket,
                endpoint,
                public_endpoint,
                auth,
            } => Arc::new(
                AzureBackend::new_with_options(
                    azure_options(
                        account,
                        access_key,
                        connection_string,
                        endpoint,
                        public_endpoint,
                        auth,
                    )?,
                    physical_bucket,
                )?
                .with_uploader(uploader),
            ),
        })
    }
}

pub fn azure_options(
    account: Option<String>,
    access_key: Option<String>,
    connection_string: Option<String>,
    endpoint: Option<String>,
    public_endpoint: Option<String>,
    auth: Option<AzureAuthMode>,
) -> anyhow::Result<AzureOptions> {
    let mut options = match connection_string {
        Some(connection_string) => AzureOptions::from_connection_string(&connection_string)?,
        None => {
            let account = account.ok_or_else(|| {
                anyhow::anyhow!("Azure backend needs `account` or `connection_string`")
            })?;

            let auth = match (auth, access_key) {
                (Some(AzureAuthMode::AccessKey) | None, Some(key)) => AzureAuth::AccessKey(key),
                (Some(AzureAuthMode::AccessKey), None) => {
                    anyhow::bail!("Azure auth `access_key` needs `access_key`")
                }
                (Some(AzureAuthMode::Default) | None, None) => AzureAuth::Default,
                (Some(AzureAuthMode::WorkloadIdentity), _) => AzureAuth::WorkloadIdentity,
                (Some(AzureAuthMode::ManagedIdentity), _) => AzureAuth::ManagedIdentity,
                (Some(AzureAuthMode::Default), Some(_)) => AzureAuth::Default,
            };

            AzureOptions::new(account, auth)
        }
    };

    if endpoint.is_some() {
        options.endpoint = endpoint;
    }
    options.public_endpoint = public_endpoint;

    Ok(options)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn from_environment(vars: &[(&str, &str)]) -> Config {
        let vars = vars
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();

        config::Config::builder()
            .add_source(environment().source(Some(vars)))
            .build()
            .unwrap()
            .try_deserialize()
            .unwrap()
    }

    const BASE: &[(&str, &str)] = &[
        ("OBJECT_STORE__SERVER__HOST", "0.0.0.0"),
        ("OBJECT_STORE__BACKEND__TYPE", "local"),
        ("OBJECT_STORE__BACKEND__ROOT_PATH", "/data"),
    ];

    #[test]
    fn defaults_the_upload_settings() {
        let config = from_environment(BASE);

        assert_eq!(config.uploads, UploadsConfig::default());
        assert_eq!(config.uploads.part_concurrency, 4);
        assert_eq!(config.uploads.min_part_size_bytes, 16 * 1024 * 1024);
        assert_eq!(config.uploads.memory_budget_bytes, 1024 * 1024 * 1024);
        assert_eq!(config.server.router_options(), RouterOptions::default());
        assert_eq!(config.digests.max_concurrent, 16);
    }

    #[test]
    fn reads_the_digest_concurrency_from_the_environment() {
        let mut vars = BASE.to_vec();
        vars.push(("OBJECT_STORE__DIGESTS__MAX_CONCURRENT", "4"));

        assert_eq!(from_environment(&vars).digests.max_concurrent, 4);
    }

    #[test]
    fn reads_upload_settings_from_the_environment() {
        let mut vars = BASE.to_vec();
        vars.extend([
            ("OBJECT_STORE__UPLOADS__PART_CONCURRENCY", "8"),
            ("OBJECT_STORE__UPLOADS__MEMORY_BUDGET_BYTES", "268435456"),
        ]);

        let config = from_environment(&vars);

        assert_eq!(config.uploads.part_concurrency, 8);
        assert_eq!(config.uploads.memory_budget_bytes, 256 * 1024 * 1024);
        assert_eq!(config.uploads.min_part_size_bytes, 16 * 1024 * 1024);
    }

    #[test]
    fn reads_upload_settings_from_a_file() {
        let toml = r#"
            [server]
            port = 9000

            [backend]
            type = "local"
            root_path = "./data"

            [uploads]
            part_concurrency = 1
            min_part_size_bytes = 33554432
        "#;

        let config: Config = config::Config::builder()
            .add_source(config::File::from_str(toml, config::FileFormat::Toml))
            .build()
            .unwrap()
            .try_deserialize()
            .unwrap();

        assert_eq!(config.uploads.part_concurrency, 1);
        assert_eq!(config.uploads.min_part_size_bytes, 32 * 1024 * 1024);
        assert_eq!(config.uploads.memory_budget_bytes, 1024 * 1024 * 1024);

        let settings = config.uploads.settings();
        assert_eq!(settings.part_concurrency, 1);
        assert_eq!(settings.min_part_size, 32 * 1024 * 1024);
    }

    #[test]
    fn defaults_the_zip_settings() {
        let config = from_environment(BASE);

        assert_eq!(config.zip, ZipConfig::default());
        assert_eq!(config.zip.settings(), ZipSettings::default());

        let settings = config.zip.settings();
        assert_eq!(settings.max_concurrent_jobs, 2);
        assert_eq!(settings.fetch_concurrency, 16);
        assert_eq!(settings.small_entry_bytes, 1024 * 1024);
        assert_eq!(settings.max_entries, 1_000_000);
        assert_eq!(settings.max_spec_bytes, 64 * 1024 * 1024);
        assert_eq!(settings.max_parsing_spec_bytes, 64 * 1024 * 1024);
        assert_eq!(settings.compression_parallelism, None);
        assert_eq!(settings.max_archive_bytes, 1 << 40);
        assert_eq!(settings.max_wait, Duration::from_secs(30));
        assert_eq!(settings.job_retention, Duration::from_secs(168 * 3600));
        assert_eq!(settings.heartbeat_interval, Duration::from_secs(15));
        assert_eq!(settings.lease, Duration::from_secs(60));
        assert_eq!(settings.lease_skew_grace, Duration::from_secs(10));
        assert_eq!(settings.shutdown_grace, Duration::from_secs(10));
    }

    #[test]
    fn reads_zip_settings_from_the_environment_and_files() {
        let mut vars = BASE.to_vec();
        vars.extend([
            ("OBJECT_STORE__ZIP__MAX_CONCURRENT_JOBS", "4"),
            ("OBJECT_STORE__ZIP__FETCH_CONCURRENCY", "8"),
            ("OBJECT_STORE__ZIP__MAX_ARCHIVE_BYTES", "1000"),
            ("OBJECT_STORE__ZIP__LEASE_SECONDS", "90"),
        ]);
        let config = from_environment(&vars);
        assert_eq!(config.zip.max_concurrent_jobs, 4);
        assert_eq!(config.zip.fetch_concurrency, 8);
        assert_eq!(config.zip.max_archive_bytes, 1000);
        assert_eq!(config.zip.settings().lease, Duration::from_secs(90));
        assert_eq!(config.zip.max_entries, 1_000_000);

        let toml = r#"
            [backend]
            type = "local"
            root_path = "./data"

            [server]

            [zip]
            small_entry_bytes = 2097152
            max_wait_seconds = 5
        "#;
        let config: Config = config::Config::builder()
            .add_source(config::File::from_str(toml, config::FileFormat::Toml))
            .build()
            .unwrap()
            .try_deserialize()
            .unwrap();
        assert_eq!(config.zip.settings().small_entry_bytes, 2 * 1024 * 1024);
        assert_eq!(config.zip.settings().max_wait, Duration::from_secs(5));
        assert_eq!(config.zip.heartbeat_seconds, 15);
    }

    #[test]
    fn reads_spec_admission_and_compression_settings() {
        let mut vars = BASE.to_vec();
        vars.extend([
            ("OBJECT_STORE__ZIP__MAX_PARSING_SPEC_BYTES", "1048576"),
            ("OBJECT_STORE__ZIP__COMPRESSION_PARALLELISM", "3"),
        ]);
        let settings = from_environment(&vars).zip_settings();
        assert_eq!(settings.max_parsing_spec_bytes, 1024 * 1024);
        assert_eq!(settings.compression_parallelism, Some(3));

        let toml = r#"
            [backend]
            type = "local"
            root_path = "./data"

            [server]

            [zip]
            compression_parallelism = 12
            max_parsing_spec_bytes = 134217728
        "#;
        let config: Config = config::Config::builder()
            .add_source(config::File::from_str(toml, config::FileFormat::Toml))
            .build()
            .unwrap()
            .try_deserialize()
            .unwrap();
        let settings = config.zip_settings();
        assert_eq!(settings.compression_parallelism, Some(12));
        assert_eq!(settings.max_parsing_spec_bytes, 128 * 1024 * 1024);
    }

    #[test]
    fn clamps_zip_settings_that_would_break_the_pipeline() {
        let zip = ZipConfig {
            max_concurrent_jobs: 0,
            fetch_concurrency: 0,
            small_entry_bytes: u64::MAX,
            heartbeat_seconds: 0,
            ..ZipConfig::default()
        };
        let settings = zip.settings();
        assert_eq!(settings.max_concurrent_jobs, 1);
        assert_eq!(settings.fetch_concurrency, 1);
        assert_eq!(settings.small_entry_bytes, MAX_SMALL_ENTRY_BYTES);
        assert_eq!(settings.heartbeat_interval, Duration::from_secs(1));

        let zip = ZipConfig {
            fetch_concurrency: 100_000,
            ..ZipConfig::default()
        };
        assert_eq!(zip.settings().fetch_concurrency, MAX_FETCH_CONCURRENCY);
    }

    #[test]
    fn keeps_the_zip_wait_below_the_request_timeout() {
        let mut config = from_environment(BASE);
        assert_eq!(config.zip.max_queued_jobs, 64);
        assert_eq!(config.zip_settings().max_wait, Duration::from_secs(30));

        config.server.request_timeout_secs = 20;
        assert_eq!(config.zip_settings().max_wait, Duration::from_secs(15));

        config.server.request_timeout_secs = 6;
        assert_eq!(config.zip_settings().max_wait, Duration::from_secs(3));

        config.zip.max_wait_seconds = 1;
        assert_eq!(config.zip_settings().max_wait, Duration::from_secs(1));
    }

    #[test]
    fn keeps_the_heartbeat_well_inside_the_lease() {
        let zip = ZipConfig {
            heartbeat_seconds: 60,
            lease_seconds: 60,
            ..ZipConfig::default()
        };
        assert_eq!(zip.settings().heartbeat_interval(), Duration::from_secs(30));
        assert_eq!(
            ZipConfig::default().settings().heartbeat_interval(),
            Duration::from_secs(15)
        );
    }

    #[test]
    fn the_example_config_matches_the_defaults() {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../config.example.toml");
        let config = Config::from_file(path).unwrap();
        let defaults = ZipConfig::default();

        assert_eq!(config.zip.max_queued_jobs, defaults.max_queued_jobs);
        assert_eq!(config.zip.max_concurrent_jobs, defaults.max_concurrent_jobs);
        assert_eq!(config.zip.max_wait_seconds, defaults.max_wait_seconds);
        assert_eq!(config.zip.lease_seconds, defaults.lease_seconds);
        assert_eq!(
            config.zip.shutdown_grace_seconds,
            defaults.shutdown_grace_seconds
        );
        assert_eq!(
            config.zip.upload_memory_budget_bytes,
            defaults.upload_memory_budget_bytes
        );
        assert_eq!(
            config.zip.max_parsing_spec_bytes,
            defaults.max_parsing_spec_bytes
        );
        assert_eq!(
            config.zip.compression_parallelism,
            defaults.compression_parallelism
        );
        assert_eq!(config.server.router_options(), RouterOptions::default());
    }

    #[test]
    fn guards_upload_bodies_against_trickling_clients() {
        let config = from_environment(BASE);
        let options = config.server.router_options();
        assert_eq!(options.upload_min_bytes_per_sec, 16 * 1024);
        assert_eq!(options.upload_min_rate_grace, Duration::from_secs(60));

        let mut vars = BASE.to_vec();
        vars.extend([
            ("OBJECT_STORE__SERVER__UPLOAD_MIN_BYTES_PER_SEC", "0"),
            ("OBJECT_STORE__SERVER__UPLOAD_MIN_RATE_GRACE_SECS", "5"),
        ]);
        let options = from_environment(&vars).server.router_options();
        assert_eq!(options.upload_min_bytes_per_sec, 0);
        assert_eq!(options.upload_min_rate_grace, Duration::from_secs(5));
    }

    #[test]
    fn gives_archives_an_upload_budget_of_their_own() {
        let mut config = from_environment(BASE);
        assert_eq!(config.zip.upload_memory_budget_bytes, 256 * 1024 * 1024);

        config.uploads.part_concurrency = 3;
        let settings = config.archive_upload_settings();
        assert_eq!(settings.memory_budget_bytes, 256 * 1024 * 1024);
        assert_eq!(settings.part_concurrency, 3);
        assert_eq!(
            config.uploads.settings().memory_budget_bytes,
            1024 * 1024 * 1024
        );

        let mut vars = BASE.to_vec();
        vars.push(("OBJECT_STORE__ZIP__UPLOAD_MEMORY_BUDGET_BYTES", "1048576"));
        assert_eq!(
            from_environment(&vars)
                .archive_upload_settings()
                .memory_budget_bytes,
            1024 * 1024
        );
    }

    #[test]
    fn never_runs_uploads_without_concurrency() {
        let uploads = UploadsConfig {
            part_concurrency: 0,
            ..UploadsConfig::default()
        };
        assert_eq!(uploads.settings().part_concurrency, 1);
    }
}
