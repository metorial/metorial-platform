use object_store_backends::{
    azure::{AzureAuth, AzureBackend, AzureOptions},
    gcs::{GcsBackend, GcsOptions},
    local::LocalBackend,
    s3::{S3Backend, S3Options},
    Backend,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub backend: BackendConfig,
    #[serde(default)]
    pub public: PublicConfig,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PublicUrlMode {
    /// Public URLs come from the backend (presigned S3/GCS/Azure URLs, local `public_url`).
    #[default]
    Backend,
    /// Public URLs point at this service's public listener, which checks the signature and streams
    /// to and from the backend.
    Proxy,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PublicConfig {
    #[serde(default)]
    pub mode: PublicUrlMode,
    pub base_url: Option<String>,
    pub signing_secret: Option<String>,
    #[serde(default = "default_public_host")]
    pub host: String,
    #[serde(default = "default_public_port")]
    pub port: u16,
    #[serde(default = "default_public_request_timeout_secs")]
    pub request_timeout_secs: u64,
}

impl Default for PublicConfig {
    fn default() -> Self {
        Self {
            mode: PublicUrlMode::Backend,
            base_url: None,
            signing_secret: None,
            host: default_public_host(),
            port: default_public_port(),
            request_timeout_secs: default_public_request_timeout_secs(),
        }
    }
}

impl std::fmt::Debug for PublicConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PublicConfig")
            .field("mode", &self.mode)
            .field("base_url", &self.base_url)
            .field(
                "signing_secret",
                &self.signing_secret.as_ref().map(|_| "<redacted>"),
            )
            .field("host", &self.host)
            .field("port", &self.port)
            .field("request_timeout_secs", &self.request_timeout_secs)
            .finish()
    }
}

impl PublicConfig {
    pub fn signer(&self) -> anyhow::Result<Option<crate::public::PublicUrlSigner>> {
        if self.mode != PublicUrlMode::Proxy {
            return Ok(None);
        }

        let base_url = self
            .base_url
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("public.mode `proxy` needs public.base_url"))?;
        let secret = self
            .signing_secret
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("public.mode `proxy` needs public.signing_secret"))?;

        Ok(Some(crate::public::PublicUrlSigner::new(base_url, secret)?))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    /// Port of the health listener used by orchestrators; 0 disables it.
    #[serde(default = "default_health_port")]
    pub health_port: u16,
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
        #[serde(default, deserialize_with = "flexible_bool::optional")]
        force_path_style: Option<bool>,
        #[serde(default, deserialize_with = "flexible_bool::required")]
        create_bucket: bool,
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

fn default_health_port() -> u16 {
    12121
}

fn default_public_host() -> String {
    "0.0.0.0".to_string()
}

fn default_public_port() -> u16 {
    8081
}

fn default_public_request_timeout_secs() -> u64 {
    60 * 60
}

fn default_physical_bucket() -> String {
    "object-store-data".to_string()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: default_host(),
                port: default_port(),
                health_port: default_health_port(),
            },
            backend: BackendConfig::Local {
                root_path: PathBuf::from("./data"),
                physical_bucket: default_physical_bucket(),
                public_url: None,
            },
            public: PublicConfig::default(),
        }
    }
}

fn environment() -> config::Environment {
    config::Environment::with_prefix("OBJECT_STORE").separator("__")
}

// Environment values arrive as strings, and the config crate does not turn "true" into a boolean for
// these fields. Parsing every value (`try_parsing`) would instead turn numeric-looking strings such as
// a bucket named "2024" into numbers, so only the boolean fields accept strings.
mod flexible_bool {
    use serde::{de::Error, Deserialize, Deserializer};

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Value {
        Bool(bool),
        Text(String),
    }

    pub fn optional<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<bool>, D::Error> {
        match Option::<Value>::deserialize(deserializer)? {
            None => Ok(None),
            Some(Value::Bool(value)) => Ok(Some(value)),
            Some(Value::Text(text)) => match text.trim().to_ascii_lowercase().as_str() {
                "true" | "1" | "yes" => Ok(Some(true)),
                "false" | "0" | "no" | "" => Ok(Some(false)),
                other => Err(D::Error::custom(format!(
                    "expected a boolean, got `{other}`"
                ))),
            },
        }
    }

    pub fn required<'de, D: Deserializer<'de>>(deserializer: D) -> Result<bool, D::Error> {
        Ok(optional(deserializer)?.unwrap_or(false))
    }
}

impl Config {
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

impl BackendConfig {
    pub async fn build(self) -> anyhow::Result<Arc<dyn Backend>> {
        Ok(match self {
            BackendConfig::Local {
                root_path,
                physical_bucket,
                public_url,
            } => Arc::new(
                LocalBackend::new(root_path, physical_bucket).with_public_base_url(public_url),
            ),
            BackendConfig::S3 {
                region,
                physical_bucket,
                endpoint,
                public_endpoint,
                force_path_style,
                create_bucket,
            } => Arc::new(
                S3Backend::new_with_options(
                    physical_bucket,
                    S3Options {
                        region,
                        endpoint,
                        public_endpoint,
                        force_path_style,
                        create_bucket,
                    },
                )
                .await?,
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
                .await?,
            ),
            BackendConfig::Azure {
                account,
                access_key,
                connection_string,
                physical_bucket,
                endpoint,
                public_endpoint,
                auth,
            } => Arc::new(AzureBackend::new_with_options(
                azure_options(
                    account,
                    access_key,
                    connection_string,
                    endpoint,
                    public_endpoint,
                    auth,
                )?,
                physical_bucket,
            )?),
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
