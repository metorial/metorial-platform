use std::{
    collections::{BTreeMap, BTreeSet, hash_map::DefaultHasher},
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
};

use miette::{IntoDiagnostic, Result, WrapErr, bail};

use crate::{
    docker, environment,
    manifest::{self, LoadedManifest},
    process,
    root::ProjectRoot,
    workspace::{self, WorkspaceMetadata},
};

const PROXY_PROJECT: &str = "control_proxy";
const PROXY_NETWORK: &str = "control_proxy";
const GLOBAL_SERVICES_NETWORK: &str = "control_services";

pub async fn run(
    project: &ProjectRoot,
    selectors: &[String],
    isolated_services: bool,
    rebuild: bool,
    no_prepare: bool,
) -> Result<()> {
    let metadata = workspace::metadata(project).await?;
    let manifests = manifest::discover(&project.root)?;
    let selected = manifest::select(&manifests, selectors, &project.kind)?;
    if selected.is_empty() {
        bail!("no control.toml manifests were selected");
    }
    let ports = exposed_ports(&selected);

    let assets = workspace_assets(project);
    ensure_proxy(&project.root, &assets).await?;
    let root_env = workspace_environment(project, &metadata)?;
    let service_network = if isolated_services {
        Some(start_isolated_services(project, &metadata, &selected, &assets, &root_env).await?)
    } else {
        let projects = docker::start(&project.root, &selected, &root_env)
            .await
            .wrap_err("could not start shared development services")?;
        (!projects.is_empty()).then(|| GLOBAL_SERVICES_NETWORK.into())
    };
    let image = ensure_image(&project.root, &assets, rebuild).await?;
    let name = container_name(&metadata);
    let mut git_directories = BTreeSet::new();
    git_directories.insert(git_common_directory(&project.root).await?);
    if project.oss != project.root {
        git_directories.insert(git_common_directory(&project.oss).await?);
    }

    let _ = docker_quiet(
        &project.root,
        vec!["rm".into(), "--force".into(), name.clone()],
        &root_env,
    )
    .await;
    let mut args = vec![
        "create".into(),
        "--init".into(),
        "--name".into(),
        name.clone(),
        "--hostname".into(),
        metadata.hostname.clone(),
        "--network".into(),
        PROXY_NETWORK.into(),
        "--workdir".into(),
        "/workspace".into(),
        "--add-host".into(),
        format!("{}:127.0.0.1", metadata.hostname),
        "--add-host".into(),
        "services:127.0.0.1".into(),
        "--env".into(),
        format!("METORIAL_HOSTNAME={}", metadata.hostname),
        "--env".into(),
        format!("CONTROL_WORKSPACE_ID={}", metadata.id),
        "--env".into(),
        "CONTROL_SERVICE_POSTGRES=postgres-db2:5432".into(),
        "--env".into(),
        "CONTROL_SERVICE_MONGO=mongodb:27017".into(),
        "--env".into(),
        "CONTROL_SERVICE_REDIS=redis-db:6379".into(),
        "--env".into(),
        "CONTROL_SERVICE_NATS=nats-1:4222".into(),
        "--env".into(),
        "CONTROL_SERVICE_ETCD=etcd:2379".into(),
        "--volume".into(),
        format!("{}:/workspace", project.root.display()),
        "--volume".into(),
        format!(
            "control-{}-node-modules:/workspace/node_modules",
            metadata.id
        ),
        "--volume".into(),
        format!("control-{}-bun-cache:/root/.bun/install/cache", metadata.id),
        "--volume".into(),
        format!(
            "control-{}-cargo-target:/control-cache/cargo-target",
            metadata.id
        ),
        "--volume".into(),
        format!("control-{}-cargo-registry:/opt/cargo/registry", metadata.id),
        "--volume".into(),
        format!("control-{}-go-build:/root/.cache/go-build", metadata.id),
        "--volume".into(),
        format!("control-{}-go-mod:/opt/go/pkg/mod", metadata.id),
        "--env".into(),
        "CARGO_TARGET_DIR=/control-cache/cargo-target".into(),
        "--label".into(),
        "traefik.enable=true".into(),
        "--label".into(),
        format!("traefik.docker.network={PROXY_NETWORK}"),
    ];
    for directory in git_directories {
        args.extend([
            "--volume".into(),
            format!("{}:{}:rw", directory.display(), directory.display()),
        ]);
    }
    if !project.root.join("env.json").is_file() {
        let inherited = metadata.source_root.join("env.json");
        if inherited.is_file() {
            args.extend([
                "--volume".into(),
                format!("{}:/workspace/env.json:ro", inherited.display()),
            ]);
        }
    }
    args.extend(proxy_label_args(&metadata, &ports));
    args.push(image);
    args.extend(["dev".into(), "--no-docker".into()]);
    if no_prepare {
        args.push("--no-prepare".into());
    }
    args.extend(selectors.iter().cloned());
    docker_run(&project.root, args, &root_env)
        .await
        .wrap_err("could not create workspace development container")?;
    if let Some(service_network) = service_network {
        docker_run(
            &project.root,
            vec![
                "network".into(),
                "connect".into(),
                service_network,
                name.clone(),
            ],
            &root_env,
        )
        .await
        .wrap_err("could not attach workspace to development services")?;
    }

    println!("workspace hostname: {}", metadata.hostname);
    for port in ports {
        println!("  http://{}:{port}", metadata.hostname);
    }
    attach(&project.root, &name, &root_env).await
}

pub async fn stop(project: &ProjectRoot, services: bool, volumes: bool) -> Result<()> {
    let metadata = workspace::metadata(project).await?;
    let environment = workspace_environment(project, &metadata)?;
    let name = container_name(&metadata);
    let _ = docker_quiet(
        &project.root,
        vec!["rm".into(), "--force".into(), name],
        &environment,
    )
    .await;
    if services {
        let assets = workspace_assets(project);
        let mut args = compose_args(
            &assets.join("services.docker-compose.yml"),
            &services_project(&metadata),
        );
        args.push("down".into());
        if volumes {
            args.push("--volumes".into());
        }
        docker_run(&project.root, args, &environment).await?;
    }
    Ok(())
}

pub async fn status(project: &ProjectRoot) -> Result<()> {
    let metadata = workspace::metadata(project).await?;
    let environment = workspace_environment(project, &metadata)?;
    println!("workspace: {}", metadata.id);
    println!("branch: {}", metadata.branch);
    println!("hostname: {}", metadata.hostname);
    let args = vec![
        "inspect".into(),
        "--format".into(),
        "{{.State.Status}}".into(),
        container_name(&metadata),
    ];
    match docker_run(&project.root, args, &environment).await {
        Ok(()) => Ok(()),
        Err(_) => {
            println!("container: stopped");
            Ok(())
        }
    }
}

fn workspace_assets(project: &ProjectRoot) -> PathBuf {
    project.oss.join("scripts/dev-tools/workspace")
}

fn workspace_environment(
    project: &ProjectRoot,
    metadata: &WorkspaceMetadata,
) -> Result<BTreeMap<String, String>> {
    let mut environment = environment::root_environment(project)?;
    environment.insert("METORIAL_HOSTNAME".into(), metadata.hostname.clone());
    environment.insert("CONTROL_WORKSPACE_ID".into(), metadata.id.clone());
    Ok(environment)
}

fn exposed_ports(manifests: &[&LoadedManifest]) -> BTreeSet<u16> {
    manifests
        .iter()
        .flat_map(|loaded| loaded.manifest.expose.iter().map(|exposure| exposure.port))
        .collect()
}

fn proxy_label_args(metadata: &WorkspaceMetadata, ports: &BTreeSet<u16>) -> Vec<String> {
    let mut args = Vec::new();
    for port in ports {
        let route = format!("{}-{port}", metadata.id);
        args.extend([
            "--label".into(),
            format!(
                "traefik.http.routers.{route}.rule=Host(`{}`)",
                metadata.hostname
            ),
            "--label".into(),
            format!("traefik.http.routers.{route}.entrypoints=port-{port}"),
            "--label".into(),
            format!("traefik.http.routers.{route}.service={route}"),
            "--label".into(),
            format!("traefik.http.services.{route}.loadbalancer.server.port={port}"),
        ]);
    }
    args
}

async fn ensure_proxy(root: &Path, assets: &Path) -> Result<()> {
    let compose = assets.join("proxy.docker-compose.yml");
    let args = compose_args(&compose, PROXY_PROJECT)
        .into_iter()
        .chain(["up".into(), "--detach".into(), "--wait".into()])
        .collect();
    docker_run(root, args, &Default::default())
        .await
        .wrap_err("could not start the global development proxy")
}

async fn ensure_image(root: &Path, assets: &Path, rebuild: bool) -> Result<String> {
    let dockerfile = assets.join("Dockerfile");
    let entrypoint = assets.join("entrypoint.sh");
    let mut hasher = DefaultHasher::new();
    fs::read(&dockerfile)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not read {}", dockerfile.display()))?
        .hash(&mut hasher);
    fs::read(&entrypoint)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not read {}", entrypoint.display()))?
        .hash(&mut hasher);
    let image = format!("metorial-control-dev:{:016x}", hasher.finish());
    if !rebuild
        && docker_quiet(
            root,
            vec!["image".into(), "inspect".into(), image.clone()],
            &Default::default(),
        )
        .await
        .is_ok()
    {
        return Ok(image);
    }
    docker_run(
        root,
        vec![
            "build".into(),
            "--tag".into(),
            image.clone(),
            "--file".into(),
            dockerfile.to_string_lossy().into_owned(),
            assets.to_string_lossy().into_owned(),
        ],
        &Default::default(),
    )
    .await?;
    Ok(image)
}

async fn start_isolated_services(
    project: &ProjectRoot,
    metadata: &WorkspaceMetadata,
    manifests: &[&LoadedManifest],
    assets: &Path,
    environment: &BTreeMap<String, String>,
) -> Result<String> {
    let compose = assets.join("services.docker-compose.yml");
    let project_name = services_project(metadata);
    let args = compose_args(&compose, &project_name)
        .into_iter()
        .chain([
            "up".into(),
            "--detach".into(),
            "--wait".into(),
            "--wait-timeout".into(),
            "60".into(),
        ])
        .collect();
    docker_run(&project.root, args, environment).await?;
    provision_isolated_databases(
        &project.root,
        &compose,
        &project_name,
        manifests,
        environment,
    )
    .await?;
    Ok(format!("{project_name}_workspace-services"))
}

async fn provision_isolated_databases(
    root: &Path,
    compose: &Path,
    project_name: &str,
    manifests: &[&LoadedManifest],
    environment: &BTreeMap<String, String>,
) -> Result<()> {
    let postgres = manifests
        .iter()
        .flat_map(|loaded| loaded.manifest.postgres.values())
        .map(|database| database.database.clone())
        .collect::<BTreeSet<_>>();
    for database in postgres {
        let sql = "SELECT format('CREATE DATABASE %I', :'database') \
                   WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'database')\n\
                   \\gexec\n";
        let mut args = compose_args(compose, project_name);
        args.extend([
            "exec".into(),
            "-T".into(),
            "postgres-db2".into(),
            "psql".into(),
            "-v".into(),
            "ON_ERROR_STOP=1".into(),
            "-v".into(),
            format!("database={database}"),
            "-U".into(),
            "postgres".into(),
            "-d".into(),
            "postgres".into(),
        ]);
        process::run_with_input("docker", &args, sql, root, environment).await?;
    }
    let mongo = manifests
        .iter()
        .flat_map(|loaded| loaded.manifest.mongo.values())
        .map(|database| database.database.clone())
        .collect::<BTreeSet<_>>();
    for database in mongo {
        let mut args = compose_args(compose, project_name);
        args.extend([
            "exec".into(),
            "-T".into(),
            "mongodb".into(),
            "mongosh".into(),
            format!("mongodb://mongo:mongo@127.0.0.1:27017/{database}?authSource=admin"),
            "--quiet".into(),
            "--eval".into(),
            "if (db.getCollectionNames().length === 0) db.createCollection('__control')".into(),
        ]);
        docker_run(root, args, environment).await?;
    }
    Ok(())
}

async fn attach(root: &Path, name: &str, environment: &BTreeMap<String, String>) -> Result<()> {
    let args = vec![
        "start".into(),
        "--attach".into(),
        "--interactive".into(),
        name.into(),
    ];
    let mut child = process::spawn("docker", &args, root, environment, false)?;
    tokio::select! {
        signal = tokio::signal::ctrl_c() => {
            signal.into_diagnostic()?;
            eprintln!("\nreceived interrupt; stopping workspace container");
            let _ = docker_quiet(root, vec![
                "stop".into(), "--timeout".into(), "20".into(), name.into()
            ], environment).await;
            let _ = child.wait().await;
            Ok(())
        }
        status = child.wait() => {
            let status = status.into_diagnostic()?;
            if status.success() {
                Ok(())
            } else {
                bail!("workspace development container exited with {status}")
            }
        }
    }
}

fn services_project(metadata: &WorkspaceMetadata) -> String {
    format!("control_ws_{}", metadata.id.replace('-', "_"))
}

fn container_name(metadata: &WorkspaceMetadata) -> String {
    format!("control-ws-{}", metadata.id)
}

fn compose_args(compose: &Path, project: &str) -> Vec<String> {
    vec![
        "compose".into(),
        "--project-name".into(),
        project.into(),
        "--file".into(),
        compose.to_string_lossy().into_owned(),
    ]
}

async fn git_common_directory(repository: &Path) -> Result<PathBuf> {
    let output = process::output("git", &["rev-parse", "--git-common-dir"], repository)
        .await
        .wrap_err_with(|| {
            format!(
                "could not determine Git metadata directory for {}",
                repository.display()
            )
        })?;
    let path = PathBuf::from(output);
    let path = if path.is_absolute() {
        path
    } else {
        repository.join(path)
    };
    Ok(path.canonicalize().unwrap_or(path))
}

async fn docker_run(
    root: &Path,
    args: Vec<String>,
    environment: &BTreeMap<String, String>,
) -> Result<()> {
    process::run("docker", &args, root, environment).await
}

async fn docker_quiet(
    root: &Path,
    args: Vec<String>,
    environment: &BTreeMap<String, String>,
) -> Result<()> {
    process::run_quiet("docker", &args, root, environment).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn metadata() -> WorkspaceMetadata {
        WorkspaceMetadata {
            id: "feature-auth-deadbeef".into(),
            hostname: "feature-auth-deadbeef.localhost".into(),
            branch: "feature/auth".into(),
            source_root: "/code/metorial".into(),
        }
    }

    #[test]
    fn generates_stable_container_service_and_proxy_names() {
        let metadata = metadata();
        assert_eq!(
            container_name(&metadata),
            "control-ws-feature-auth-deadbeef"
        );
        assert_eq!(
            services_project(&metadata),
            "control_ws_feature_auth_deadbeef"
        );

        let labels = proxy_label_args(&metadata, &BTreeSet::from([4310]));
        assert!(labels.contains(
            &"traefik.http.routers.feature-auth-deadbeef-4310.rule=Host(`feature-auth-deadbeef.localhost`)"
                .into()
        ));
        assert!(
            labels.contains(
                &"traefik.http.services.feature-auth-deadbeef-4310.loadbalancer.server.port=4310"
                    .into()
            )
        );
    }

    #[test]
    fn proxy_declares_every_repository_exposure() {
        let oss = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
        let assets = oss.join("scripts/dev-tools/workspace");
        let compose = fs::read_to_string(assets.join("proxy.docker-compose.yml")).unwrap();
        let traefik = fs::read_to_string(assets.join("traefik.yml")).unwrap();
        let mut manifests = manifest::discover(&oss).unwrap();
        let enterprise = oss.parent().unwrap();
        if enterprise.join("package.json").is_file() {
            manifests.extend(manifest::discover(enterprise).unwrap());
        }
        let ports = exposed_ports(&manifests.iter().collect::<Vec<_>>());

        for port in ports {
            assert!(
                compose.contains(&format!("'{port}:{port}'")),
                "proxy does not publish {port}"
            );
            assert!(
                traefik.contains(&format!("port-{port}:")),
                "proxy has no entrypoint for {port}"
            );
        }
    }
}
