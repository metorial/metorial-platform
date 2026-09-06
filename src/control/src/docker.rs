use std::{
    collections::{BTreeMap, BTreeSet},
    net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream},
    path::{Path, PathBuf},
    time::Duration,
};

use miette::{Result, bail};
use tokio::time::sleep;

use crate::{
    environment::{mongo_url, postgres_url},
    infrastructure::{self, RenderOptions, Requirements},
    manifest::LoadedManifest,
    process,
    workspace::ServicePorts,
};

pub async fn start(
    root: &Path,
    manifests: &[&LoadedManifest],
    environment: &BTreeMap<String, String>,
) -> Result<Vec<(PathBuf, Vec<String>)>> {
    let requirements = Requirements::from_manifests(manifests);
    start_with_requirements(root, manifests, environment, requirements, true).await
}

pub async fn start_databases(
    root: &Path,
    manifests: &[&LoadedManifest],
    environment: &BTreeMap<String, String>,
) -> Result<Vec<(PathBuf, Vec<String>)>> {
    let mut requirements = Requirements::from_manifests(manifests);
    requirements.redis = false;
    requirements.nats = false;
    requirements.etcd = false;
    start_with_requirements(root, manifests, environment, requirements, false).await
}

async fn start_with_requirements(
    root: &Path,
    manifests: &[&LoadedManifest],
    environment: &BTreeMap<String, String>,
    requirements: Requirements,
    include_declared_compose: bool,
) -> Result<Vec<(PathBuf, Vec<String>)>> {
    let generated = root.join(".control/dev/services.docker-compose.yml");
    let ports = service_ports(environment)?;
    if requirements.count() > 0 {
        infrastructure::write_compose(
            &generated,
            &requirements,
            &RenderOptions {
                project_name: Some(&project_name(root)),
                network: "control-services",
                network_name: None,
                ports: Some(&ports),
                restart: true,
            },
        )?;
    }
    let mut projects = if include_declared_compose {
        declared_compose_projects(root, manifests)
    } else {
        Vec::new()
    };
    if requirements.count() > 0 {
        projects.push((generated.clone(), requirements.service_names()));
        projects.sort_by(|left, right| left.0.cmp(&right.0));
    }
    for (index, (compose, services)) in projects.iter().enumerate() {
        let mut args = compose_prefix(compose);
        args.extend([
            "up".into(),
            "--detach".into(),
            "--wait".into(),
            "--wait-timeout".into(),
            "60".into(),
        ]);
        args.extend(services.iter().cloned());
        if let Err(error) = process::run("docker", &args, root, environment).await {
            stop(root, &projects[..=index], environment).await;
            return Err(error);
        }
        if compose == &generated && !host_ports_reachable(&requirements, &ports) {
            eprintln!(
                "generated Docker services have stale host port bindings; recreating containers"
            );
            let mut recreate = compose_prefix(compose);
            recreate.extend([
                "up".into(),
                "--detach".into(),
                "--wait".into(),
                "--wait-timeout".into(),
                "60".into(),
                "--force-recreate".into(),
            ]);
            recreate.extend(services.iter().cloned());
            if let Err(error) = process::run("docker", &recreate, root, environment).await {
                stop(root, &projects[..=index], environment).await;
                return Err(error);
            }
            if !host_ports_reachable(&requirements, &ports) {
                stop(root, &projects[..=index], environment).await;
                bail!("generated Docker services are not reachable on their configured host ports");
            }
        }
    }

    let provisioning = async {
        for loaded in manifests {
            let base = loaded.path.parent().unwrap_or(root);
            for db in loaded.manifest.postgres.values() {
                let mut db = db.clone();
                db.compose = Some(generated.clone());
                db.service = Some("postgres-db2".into());
                wait_postgres(root, base, &db, environment).await?;
                create_postgres(root, base, &db, environment).await?;
            }
            for db in loaded.manifest.mongo.values() {
                let mut db = db.clone();
                db.compose = Some(generated.clone());
                db.service = Some("mongodb".into());
                wait_mongo(root, base, &db, environment).await?;
                create_mongo(root, base, &db, environment).await?;
            }
        }
        Ok(())
    }
    .await;
    if let Err(error) = provisioning {
        stop(root, &projects, environment).await;
        return Err(error);
    }
    Ok(projects)
}

fn host_ports_reachable(requirements: &Requirements, ports: &ServicePorts) -> bool {
    [
        (requirements.postgres, ports.postgres),
        (requirements.mongo, ports.mongo),
        (requirements.redis, ports.redis),
        (requirements.nats, ports.nats),
        (requirements.etcd, ports.etcd_client),
    ]
    .into_iter()
    .filter(|(required, _)| *required)
    .all(|(_, port)| {
        TcpStream::connect_timeout(
            &SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port),
            Duration::from_millis(500),
        )
        .is_ok()
    })
}

fn service_ports(environment: &BTreeMap<String, String>) -> Result<ServicePorts> {
    let parse = |key: &str| -> Result<u16> {
        environment
            .get(key)
            .ok_or_else(|| miette::miette!("missing {key}"))?
            .parse()
            .map_err(|_| miette::miette!("invalid {key}"))
    };
    Ok(ServicePorts {
        postgres: parse("CONTROL_PORT_POSTGRES")?,
        mongo: parse("CONTROL_PORT_MONGO")?,
        redis: parse("CONTROL_PORT_REDIS")?,
        nats: parse("CONTROL_PORT_NATS")?,
        etcd_client: parse("CONTROL_PORT_ETCD_CLIENT")?,
        etcd_peer: parse("CONTROL_PORT_ETCD_PEER")?,
    })
}

fn project_name(root: &Path) -> String {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    root.canonicalize()
        .unwrap_or_else(|_| root.to_path_buf())
        .hash(&mut hasher);
    format!("control_dev_{:08x}", hasher.finish() as u32)
}

pub async fn stop(
    root: &Path,
    projects: &[(PathBuf, Vec<String>)],
    environment: &BTreeMap<String, String>,
) {
    for (compose, services) in projects.iter().rev() {
        let mut args = compose_prefix(compose);
        if services.is_empty() {
            args.push("down".into());
        } else {
            args.push("stop".into());
            args.extend(services.iter().cloned());
        }
        if let Err(error) = process::run("docker", &args, root, environment).await {
            eprintln!("warning: could not stop Docker services: {error:?}");
        }
    }
}

pub fn compose_projects(root: &Path, manifests: &[&LoadedManifest]) -> Vec<(PathBuf, Vec<String>)> {
    let requirements = Requirements::from_manifests(manifests);
    let mut projects = declared_compose_projects(root, manifests);
    let generated = root.join(".control/dev/services.docker-compose.yml");
    if requirements.count() > 0 && generated.is_file() {
        projects.push((generated, requirements.service_names()));
        projects.sort_by(|left, right| left.0.cmp(&right.0));
    }
    projects
}

fn declared_compose_projects(
    root: &Path,
    manifests: &[&LoadedManifest],
) -> Vec<(PathBuf, Vec<String>)> {
    let mut projects = BTreeMap::<PathBuf, BTreeSet<String>>::new();
    for loaded in manifests {
        let base = loaded.path.parent().unwrap_or(root);
        for compose in &loaded.manifest.docker.compose {
            projects
                .entry(base.join(compose))
                .or_default()
                .extend(loaded.manifest.docker.services.iter().cloned());
        }
        for db in loaded.manifest.postgres.values() {
            add_db_project(
                &mut projects,
                base,
                db.compose.as_ref(),
                db.service.as_ref(),
            );
        }
        for db in loaded.manifest.mongo.values() {
            add_db_project(
                &mut projects,
                base,
                db.compose.as_ref(),
                db.service.as_ref(),
            );
        }
    }
    projects
        .into_iter()
        .map(|(path, services)| (path, services.into_iter().collect()))
        .collect()
}

fn add_db_project(
    projects: &mut BTreeMap<PathBuf, BTreeSet<String>>,
    base: &Path,
    compose: Option<&PathBuf>,
    service: Option<&String>,
) {
    if let Some(compose) = compose {
        let services = projects.entry(base.join(compose)).or_default();
        if let Some(service) = service {
            services.insert(service.clone());
        }
    }
}

fn compose_prefix(compose: &Path) -> Vec<String> {
    let mut args = vec!["compose".into()];
    if compose.file_name().and_then(|name| name.to_str()) == Some("services.docker-compose.yml")
        && !compose
            .components()
            .any(|component| component.as_os_str() == ".control")
    {
        args.extend(["--project-name".into(), "dev_services".into()]);
    }
    args.extend(["--file".into(), compose.to_string_lossy().into()]);
    args
}

async fn wait_postgres(
    root: &Path,
    base: &Path,
    db: &crate::manifest::Postgres,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    retry("Postgres", || async {
        if let (Some(compose), Some(service)) = (&db.compose, &db.service) {
            let mut args = compose_prefix(&base.join(compose));
            args.extend([
                "exec".into(),
                "-T".into(),
                service.clone(),
                "pg_isready".into(),
                "-U".into(),
                db.user.clone(),
            ]);
            process::run_quiet("docker", &args, root, env).await
        } else {
            process::run_quiet(
                "pg_isready",
                &[
                    "-h".into(),
                    db.host.clone(),
                    "-p".into(),
                    db.port.to_string(),
                    "-U".into(),
                    db.user.clone(),
                ],
                root,
                env,
            )
            .await
        }
    })
    .await
}

async fn create_postgres(
    root: &Path,
    base: &Path,
    db: &crate::manifest::Postgres,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    let sql = "SELECT format('CREATE DATABASE %I', :'database') \
               WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'database')\n\
               \\gexec\n";
    if let (Some(compose), Some(service)) = (&db.compose, &db.service) {
        let mut args = compose_prefix(&base.join(compose));
        args.extend([
            "exec".into(),
            "-T".into(),
            service.clone(),
            "psql".into(),
            "-v".into(),
            "ON_ERROR_STOP=1".into(),
            "-v".into(),
            format!("database={}", db.database),
            "-U".into(),
            db.user.clone(),
            "-d".into(),
            "postgres".into(),
        ]);
        process::run_with_input("docker", &args, sql, root, env).await
    } else {
        let admin = format!(
            "postgresql://{}:{}@{}:{}/postgres",
            db.user, db.password, db.host, db.port
        );
        process::run_with_input(
            "psql",
            &[
                admin,
                "-v".into(),
                "ON_ERROR_STOP=1".into(),
                "-v".into(),
                format!("database={}", db.database),
            ],
            sql,
            root,
            env,
        )
        .await
    }
}

async fn wait_mongo(
    root: &Path,
    base: &Path,
    db: &crate::manifest::Mongo,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    retry("MongoDB", || async {
        mongo_exec(root, base, db, "db.runCommand({ ping: 1 })", env).await
    })
    .await
}

async fn create_mongo(
    root: &Path,
    base: &Path,
    db: &crate::manifest::Mongo,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    mongo_exec(
        root,
        base,
        db,
        "if (db.getCollectionNames().length === 0) db.createCollection('__control')",
        env,
    )
    .await
}

async fn mongo_exec(
    root: &Path,
    base: &Path,
    db: &crate::manifest::Mongo,
    eval: &str,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    if let (Some(compose), Some(service)) = (&db.compose, &db.service) {
        let mut container_db = db.clone();
        container_db.host = "127.0.0.1".into();
        container_db.port = 27017;
        let mut args = compose_prefix(&base.join(compose));
        args.extend([
            "exec".into(),
            "-T".into(),
            service.clone(),
            "mongosh".into(),
            mongo_url(&container_db),
            "--quiet".into(),
            "--eval".into(),
            eval.into(),
        ]);
        process::run_quiet("docker", &args, root, env).await
    } else {
        process::run_quiet(
            "mongosh",
            &[
                mongo_url(db),
                "--quiet".into(),
                "--eval".into(),
                eval.into(),
            ],
            root,
            env,
        )
        .await
    }
}

async fn retry<F, Fut>(name: &str, mut operation: F) -> Result<()>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<()>>,
{
    for _ in 0..30 {
        match operation().await {
            Ok(()) => return Ok(()),
            Err(error) if process::is_interrupted(&error) => return Err(error),
            Err(_) => {}
        }
        sleep(Duration::from_secs(1)).await;
    }
    bail!("{name} did not become ready within 30 seconds")
}

#[allow(dead_code)]
fn _urls_compile_check(
    postgres: &crate::manifest::Postgres,
    mongo: &crate::manifest::Mongo,
) -> (String, String) {
    (postgres_url(postgres), mongo_url(mongo))
}

#[cfg(test)]
mod tests {
    use std::net::TcpListener;

    use super::*;

    #[test]
    fn checks_required_host_service_ports() {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let open_port = listener.local_addr().unwrap().port();
        let ports = ServicePorts {
            postgres: open_port,
            mongo: 1,
            redis: 1,
            nats: 1,
            etcd_client: 1,
            etcd_peer: 1,
        };
        assert!(host_ports_reachable(
            &Requirements {
                postgres: true,
                ..Default::default()
            },
            &ports
        ));
        assert!(!host_ports_reachable(
            &Requirements {
                mongo: true,
                ..Default::default()
            },
            &ports
        ));
    }

    #[test]
    fn includes_generated_services_in_compose_projects() {
        let temp = tempfile::tempdir().unwrap();
        let manifest_path = temp.path().join("control.toml");
        std::fs::write(temp.path().join("package.json"), "{\"name\":\"api\"}").unwrap();
        std::fs::write(
            &manifest_path,
            "name='api'\n[[resources]]\ntype='redis'\n[[resources]]\ntype='nats'\n",
        )
        .unwrap();
        std::fs::create_dir_all(temp.path().join(".control/dev")).unwrap();
        std::fs::write(
            temp.path().join(".control/dev/services.docker-compose.yml"),
            "services: {}\n",
        )
        .unwrap();
        let manifest = crate::manifest::load(&manifest_path).unwrap();

        let projects = compose_projects(temp.path(), &[&manifest]);

        assert_eq!(
            projects,
            vec![(
                temp.path().join(".control/dev/services.docker-compose.yml"),
                vec!["redis-db".into(), "nats-1".into()],
            )]
        );
    }
}
