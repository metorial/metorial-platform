use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
};

use miette::{IntoDiagnostic, Result, WrapErr};

use crate::{
    manifest::{LoadedManifest, ResourceType},
    workspace::ServicePorts,
};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Requirements {
    pub postgres: bool,
    pub mongo: bool,
    pub redis: bool,
    pub nats: bool,
    pub etcd: bool,
}

impl Requirements {
    pub fn from_manifests(manifests: &[&LoadedManifest]) -> Self {
        let mut output = Self::default();
        for loaded in manifests {
            output.postgres |= !loaded.manifest.postgres.is_empty();
            output.mongo |= !loaded.manifest.mongo.is_empty();
            for resource in &loaded.manifest.resources {
                match resource.resource_type {
                    ResourceType::Redis => output.redis = true,
                    ResourceType::Nats => output.nats = true,
                    ResourceType::Etcd => output.etcd = true,
                }
            }
        }
        output
    }

    pub fn service_names(&self) -> Vec<String> {
        [
            (self.postgres, "postgres-db2"),
            (self.mongo, "mongodb"),
            (self.redis, "redis-db"),
            (self.nats, "nats-1"),
            (self.etcd, "etcd"),
        ]
        .into_iter()
        .filter(|(required, _)| *required)
        .map(|(_, name)| name.into())
        .collect()
    }

    pub fn count(&self) -> usize {
        self.service_names().len()
    }
}

#[derive(Debug, Clone)]
pub struct RenderOptions<'a> {
    pub project_name: Option<&'a str>,
    pub network: &'a str,
    pub network_name: Option<&'a str>,
    pub ports: Option<&'a ServicePorts>,
    pub restart: bool,
}

pub fn write_compose(
    path: &Path,
    requirements: &Requirements,
    options: &RenderOptions<'_>,
) -> Result<PathBuf> {
    let parent = path
        .parent()
        .ok_or_else(|| miette::miette!("generated Compose path has no parent"))?;
    fs::create_dir_all(parent).into_diagnostic()?;
    let temporary = parent.join(".services.docker-compose.tmp");
    fs::write(&temporary, render_compose(requirements, options))
        .into_diagnostic()
        .wrap_err_with(|| format!("could not write {}", temporary.display()))?;
    fs::rename(&temporary, path)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not install {}", path.display()))?;
    Ok(path.to_path_buf())
}

pub fn render_compose(requirements: &Requirements, options: &RenderOptions<'_>) -> String {
    let mut output = String::new();
    if let Some(name) = options.project_name {
        output.push_str(&format!("name: {}\n", yaml(name)));
    }
    output.push_str("services:\n");
    output.push_str(&render_service_blocks(requirements, options));
    output.push_str("networks:\n");
    output.push_str(&format!("  {}:\n", options.network));
    if let Some(name) = options.network_name {
        output.push_str(&format!("    name: {}\n", yaml(name)));
    }
    let volumes = volume_names(requirements);
    if !volumes.is_empty() {
        output.push_str("volumes:\n");
        for volume in volumes {
            output.push_str(&format!("  {volume}:\n"));
        }
    }
    output
}

pub fn render_service_blocks(requirements: &Requirements, options: &RenderOptions<'_>) -> String {
    let restart = if options.restart {
        "    restart: unless-stopped\n"
    } else {
        ""
    };
    let mut output = String::new();
    if requirements.postgres {
        output.push_str(
            "  postgres-db2:\n\
             \x20   image: postgres:17\n\
             \x20   command: postgres -c max_connections=1000\n\
             \x20   environment: { POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }\n",
        );
        output.push_str(&port(options.ports.map(|ports| ports.postgres), 5432));
        output.push_str(
            "    volumes: [postgres-data:/var/lib/postgresql/data]\n\
             \x20   networks: [",
        );
        output.push_str(options.network);
        output.push_str(
            "]\n\
             \x20   healthcheck: { test: [CMD-SHELL, \"pg_isready -U postgres -d postgres\"], interval: 2s, timeout: 5s, retries: 30 }\n",
        );
        output.push_str(restart);
    }
    if requirements.mongo {
        output.push_str(
            "  mongodb:\n\
             \x20   image: mongo:8\n\
             \x20   environment: { MONGO_INITDB_ROOT_USERNAME: mongo, MONGO_INITDB_ROOT_PASSWORD: mongo }\n",
        );
        output.push_str(&port(options.ports.map(|ports| ports.mongo), 27017));
        output.push_str(
            "    volumes: [mongo-data:/data/db]\n\
             \x20   networks: [",
        );
        output.push_str(options.network);
        output.push_str(
            "]\n\
             \x20   healthcheck: { test: [CMD-SHELL, \"mongosh --quiet --username mongo --password mongo --authenticationDatabase admin --eval 'quit(db.runCommand({ ping: 1 }).ok ? 0 : 2)'\"], interval: 2s, timeout: 5s, retries: 30 }\n",
        );
        output.push_str(restart);
    }
    if requirements.redis {
        output.push_str("  redis-db:\n    image: redis:7.4-alpine\n");
        output.push_str(&port(options.ports.map(|ports| ports.redis), 6379));
        output.push_str("    command: redis-server --appendonly yes\n    volumes: [redis-data:/data]\n    networks: [");
        output.push_str(options.network);
        output.push_str("]\n    healthcheck: { test: [CMD, redis-cli, ping], interval: 2s, timeout: 3s, retries: 30 }\n");
        output.push_str(restart);
    }
    if requirements.nats {
        output.push_str("  nats-1:\n    image: nats:2.11-alpine\n");
        output.push_str(&port(options.ports.map(|ports| ports.nats), 4222));
        output.push_str("    command: [--jetstream, --store_dir=/data, --http_port=8222]\n    volumes: [nats-data:/data]\n    networks: [");
        output.push_str(options.network);
        output.push_str("]\n    healthcheck: { test: [CMD-SHELL, \"wget -q -O - http://127.0.0.1:8222/healthz >/dev/null\"], interval: 2s, timeout: 3s, retries: 30 }\n");
        output.push_str(restart);
    }
    if requirements.etcd {
        output.push_str("  etcd:\n    image: bitnamilegacy/etcd:latest\n");
        if let Some(ports) = options.ports {
            output.push_str(&format!(
                "    ports: [\"{}:2379\", \"{}:2380\"]\n",
                ports.etcd_client, ports.etcd_peer
            ));
        }
        output.push_str("    environment: { ALLOW_NONE_AUTHENTICATION: \"yes\" }\n    volumes: [etcd-data:/bitnami/etcd]\n    networks: [");
        output.push_str(options.network);
        output.push_str("]\n    healthcheck: { test: [CMD, etcdctl, endpoint, health], interval: 2s, timeout: 5s, retries: 30 }\n");
        output.push_str(restart);
    }
    output
}

pub fn volume_names(requirements: &Requirements) -> BTreeSet<&'static str> {
    [
        (requirements.postgres, "postgres-data"),
        (requirements.mongo, "mongo-data"),
        (requirements.redis, "redis-data"),
        (requirements.nats, "nats-data"),
        (requirements.etcd, "etcd-data"),
    ]
    .into_iter()
    .filter(|(required, _)| *required)
    .map(|(_, name)| name)
    .collect()
}

fn port(host: Option<u16>, container: u16) -> String {
    host.map(|host| format!("    ports: [\"{host}:{container}\"]\n"))
        .unwrap_or_default()
}

fn yaml(value: &str) -> String {
    serde_json::to_string(value).expect("strings always serialize")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_only_requested_services_and_volumes() {
        let requirements = Requirements {
            postgres: true,
            redis: true,
            ..Default::default()
        };
        let compose = render_compose(
            &requirements,
            &RenderOptions {
                project_name: Some("control-dev"),
                network: "services",
                network_name: None,
                ports: None,
                restart: false,
            },
        );
        assert!(compose.contains("postgres-db2:"));
        assert!(compose.contains("redis-db:"));
        assert!(!compose.contains("mongodb:"));
        assert!(!compose.contains("nats-1:"));
        assert!(!compose.contains("etcd:"));
        assert!(compose.contains("postgres-data:"));
        assert!(compose.contains("redis-data:"));
        assert!(!compose.contains("mongo-data:"));
    }

    #[test]
    fn renders_each_supported_resource_independently() {
        for (requirements, expected) in [
            (
                Requirements {
                    mongo: true,
                    ..Default::default()
                },
                "mongodb:",
            ),
            (
                Requirements {
                    nats: true,
                    ..Default::default()
                },
                "nats-1:",
            ),
            (
                Requirements {
                    etcd: true,
                    ..Default::default()
                },
                "etcd:",
            ),
        ] {
            let compose = render_compose(
                &requirements,
                &RenderOptions {
                    project_name: None,
                    network: "services",
                    network_name: None,
                    ports: None,
                    restart: false,
                },
            );
            assert!(compose.contains(expected));
            assert_eq!(requirements.count(), 1);
        }
    }
}
