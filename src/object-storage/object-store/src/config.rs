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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
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

fn default_physical_bucket() -> String {
    "object-store-data".to_string()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: default_host(),
                port: default_port(),
            },
            backend: BackendConfig::Local {
                root_path: PathBuf::from("./data"),
                physical_bucket: default_physical_bucket(),
                public_url: None,
            },
        }
    }
}

impl Config {
    pub fn from_file(path: &str) -> Result<Self, config::ConfigError> {
        let settings = config::Config::builder()
            .add_source(config::File::with_name(path))
            .add_source(config::Environment::with_prefix("OBJECT_STORE").separator("__"))
            .build()?;

        settings.try_deserialize()
    }

    pub fn from_env() -> Result<Self, config::ConfigError> {
        let settings = config::Config::builder()
            .add_source(config::Environment::with_prefix("OBJECT_STORE").separator("__"))
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
