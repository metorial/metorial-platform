use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum BackendConfig {
    Local {
        root_path: PathBuf,
        #[serde(default = "default_physical_bucket")]
        physical_bucket: String,
    },
    S3 {
        region: String,
        physical_bucket: String,
        endpoint: Option<String>,
    },
    Gcs {
        physical_bucket: String,
    },
    Azure {
        account: String,
        access_key: String,
        physical_bucket: String,
    },
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
