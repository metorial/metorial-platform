use std::{
    collections::{BTreeMap, BTreeSet, hash_map::DefaultHasher},
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
};

use miette::{IntoDiagnostic, Result, WrapErr, bail};

use crate::{
    environment,
    manifest::{self, LoadedManifest},
    process,
    root::ProjectRoot,
    workspace::{self, WorkspaceMetadata},
};

const PROXY_PROJECT: &str = "control_proxy";
const PROXY_NETWORK: &str = "control_proxy";
const SETUP_VERSION: &str = "v1";
const VSCODE_EXTENSION: &str = "ms-vscode-remote.remote-containers";

pub async fn initialize(project: &ProjectRoot, rebuild: bool) -> Result<()> {
    let running = ensure_running(project, rebuild).await?;
    bootstrap(project, &running).await
}

pub async fn run(project: &ProjectRoot, rebuild: bool, open_code: bool) -> Result<()> {
    initialize(project, rebuild).await?;
    if open_code {
        open(project).await?;
    }
    Ok(())
}

pub async fn open(project: &ProjectRoot) -> Result<()> {
    let metadata = workspace::metadata(project).await?;
    open_vscode(project, &metadata).await
}

pub async fn shell(project: &ProjectRoot) -> Result<()> {
    let running = ensure_running(project, false).await?;
    bootstrap(project, &running).await?;
    process::run(
        "docker",
        &[
            "exec".into(),
            "--interactive".into(),
            "--tty".into(),
            running.name,
            "zsh".into(),
            "-l".into(),
        ],
        &project.root,
        &running.environment,
    )
    .await
    .wrap_err("workspace shell exited unsuccessfully")
}

pub async fn stop(project: &ProjectRoot, volumes: bool) -> Result<()> {
    let metadata = workspace::metadata(project).await?;
    let environment = workspace_environment(project, &metadata)?;
    let name = container_name(&metadata);
    if inspect_value(&project.root, &name, "{{.Id}}")
        .await
        .is_some()
    {
        docker_run(
            &project.root,
            vec![
                "stop".into(),
                "--timeout".into(),
                "20".into(),
                name.clone(),
            ],
            &environment,
        )
        .await
        .wrap_err("could not stop workspace container")?;
    }

    let assets = workspace_assets(project, &metadata);
    let mut compose = compose_args(
        &assets.join("services.docker-compose.yml"),
        &services_project(&metadata),
    );
    if volumes {
        if inspect_value(&project.root, &name, "{{.Id}}")
            .await
            .is_some()
        {
            docker_run(
                &project.root,
                vec!["rm".into(), "--force".into(), name],
                &environment,
            )
            .await
            .wrap_err("could not remove workspace container")?;
        }
        compose.extend(["down".into(), "--volumes".into()]);
        docker_run(&project.root, compose, &environment).await?;
        for volume in workspace_volumes(&metadata) {
            if docker_quiet(
                &project.root,
                vec!["volume".into(), "inspect".into(), volume.clone()],
                &environment,
            )
            .await
            .is_ok()
            {
                docker_run(
                    &project.root,
                    vec!["volume".into(), "rm".into(), volume],
                    &environment,
                )
                .await
                .wrap_err("could not remove a workspace volume")?;
            }
        }
        println!("stopped workspace and removed its persistent data");
    } else {
        compose.push("stop".into());
        docker_run(&project.root, compose, &environment).await?;
        println!("stopped workspace; persistent data was retained");
    }
    Ok(())
}

pub async fn status(project: &ProjectRoot) -> Result<()> {
    let metadata = workspace::metadata(project).await?;
    println!("workspace: {}", metadata.id);
    println!("branch: {}", metadata.branch);
    println!("hostname: {}", metadata.hostname);
    let container_status = inspect_value(
        &project.root,
        &container_name(&metadata),
        "{{.State.Status}}",
    )
    .await
    .unwrap_or_else(|| "not created".into());
    println!("container: {container_status}");
    let assets = workspace_assets(project, &metadata);
    let mut args = compose_args(
        &assets.join("services.docker-compose.yml"),
        &services_project(&metadata),
    );
    args.extend([
        "ps".into(),
        "--status".into(),
        "running".into(),
        "--quiet".into(),
    ]);
    let running_services = output_args("docker", &args, &project.root)
        .await
        .unwrap_or_default()
        .lines()
        .count();
    println!("dependencies: {running_services}/5 running");
    let marker = format!("/control-state/bootstrap-{SETUP_VERSION}");
    if container_status == "running" {
        let initialized = docker_quiet(
            &project.root,
            vec![
                "exec".into(),
                container_name(&metadata),
                "test".into(),
                "-f".into(),
                marker,
            ],
            &Default::default(),
        )
        .await
        .is_ok();
        println!("initialized: {}", if initialized { "yes" } else { "no" });
    } else {
        println!("initialized: unknown (container is not running)");
    }
    Ok(())
}

struct RunningWorkspace {
    name: String,
    image: String,
    environment: BTreeMap<String, String>,
}

async fn ensure_running(project: &ProjectRoot, rebuild: bool) -> Result<RunningWorkspace> {
    let metadata = workspace::metadata(project).await?;
    let manifests = manifest::discover(&project.root)?;
    let selected = manifest::select(&manifests, &[], &project.kind)?;
    if selected.is_empty() {
        bail!("no control.toml manifests were selected");
    }
    let ports = exposed_ports(&selected);
    let assets = workspace_assets(project, &metadata);
    ensure_proxy(&project.root, &assets).await?;
    let environment = workspace_environment(project, &metadata)?;
    let service_network =
        start_services(project, &metadata, &selected, &assets, &environment).await?;
    let image = ensure_image(&project.root, &assets, rebuild).await?;
    let name = container_name(&metadata);

    let existing_image = inspect_value(&project.root, &name, "{{.Config.Image}}").await;
    if existing_image
        .as_deref()
        .is_some_and(|value| value != image)
    {
        docker_run(
            &project.root,
            vec!["rm".into(), "--force".into(), name.clone()],
            &environment,
        )
        .await
        .wrap_err("could not replace an outdated workspace container")?;
    }
    if existing_image.as_deref() != Some(image.as_str()) {
        create_container(
            project,
            &metadata,
            &assets,
            &environment,
            &image,
            &name,
            &ports,
        )
        .await?;
    }
    ensure_network_connection(&project.root, &name, &service_network, &environment).await?;

    docker_run(
        &project.root,
        vec!["start".into(), name.clone()],
        &environment,
    )
    .await
    .wrap_err("could not start workspace container")?;
    write_hosts_file(project, &metadata, &selected)?;
    println!("workspace hostname: {}", metadata.hostname);
    for port in &ports {
        println!("  http://{}:{port}", metadata.hostname);
    }
    Ok(RunningWorkspace {
        name,
        image,
        environment,
    })
}

async fn ensure_network_connection(
    root: &Path,
    container: &str,
    network: &str,
    environment: &BTreeMap<String, String>,
) -> Result<()> {
    let networks = inspect_value(root, container, "{{json .NetworkSettings.Networks}}")
        .await
        .ok_or_else(|| miette::miette!("could not inspect workspace container networks"))?;
    if !has_network(&networks, network)? {
        docker_run(
            root,
            vec![
                "network".into(),
                "connect".into(),
                network.into(),
                container.into(),
            ],
            environment,
        )
        .await
        .wrap_err("could not attach workspace to its dependency network")?;
    }
    Ok(())
}

fn has_network(networks: &str, network: &str) -> Result<bool> {
    let networks: serde_json::Value = serde_json::from_str(networks)
        .into_diagnostic()
        .wrap_err("Docker returned invalid container network data")?;
    Ok(networks.get(network).is_some())
}

async fn create_container(
    project: &ProjectRoot,
    metadata: &WorkspaceMetadata,
    _assets: &Path,
    environment: &BTreeMap<String, String>,
    image: &str,
    name: &str,
    ports: &BTreeSet<u16>,
) -> Result<()> {
    let services_host = resolve_services_host()?;
    let mut git_directories = BTreeSet::new();
    git_directories.insert(git_common_directory(&project.root).await?);
    if project.oss != project.root {
        git_directories.insert(git_common_directory(&project.oss).await?);
    }
    let volumes = workspace_volumes(metadata);
    let mut args = vec![
        "create".into(),
        "--init".into(),
        "--name".into(),
        name.into(),
        "--hostname".into(),
        metadata.hostname.clone(),
        "--network".into(),
        PROXY_NETWORK.into(),
        "--workdir".into(),
        "/workspace".into(),
        "--add-host".into(),
        format!("{}:127.0.0.1", metadata.hostname),
        "--add-host".into(),
        format!("services:{services_host}"),
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
        "--env".into(),
        "CARGO_TARGET_DIR=/control-cache/cargo-target".into(),
        "--env".into(),
        "SHELL=/bin/zsh".into(),
        "--volume".into(),
        format!("{}:/workspace", project.root.display()),
        "--volume".into(),
        format!("{}:/workspace/node_modules", volumes[0]),
        "--volume".into(),
        format!("{}:/root/.bun/install/cache", volumes[1]),
        "--volume".into(),
        format!("{}:/control-cache/cargo-target", volumes[2]),
        "--volume".into(),
        format!("{}:/opt/cargo/registry", volumes[3]),
        "--volume".into(),
        format!("{}:/root/.cache/go-build", volumes[4]),
        "--volume".into(),
        format!("{}:/opt/go/pkg/mod", volumes[5]),
        "--volume".into(),
        format!("{}:/control-state", volumes[6]),
        "--volume".into(),
        format!("{}:/root/.vscode-server", volumes[7]),
        "--label".into(),
        "traefik.enable=true".into(),
        "--label".into(),
        format!("traefik.docker.network={PROXY_NETWORK}"),
        "--label".into(),
        format!("control.workspace={}", metadata.id),
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
    args.extend(proxy_label_args(metadata, ports));
    args.push(image.into());
    docker_run(&project.root, args, environment)
        .await
        .wrap_err("could not create workspace development container")
}

async fn bootstrap(project: &ProjectRoot, running: &RunningWorkspace) -> Result<()> {
    println!("Ensuring workspace setup is complete");
    docker_run(
        &project.root,
        vec![
            "exec".into(),
            running.name.clone(),
            "/usr/local/bin/workspace-entrypoint".into(),
            "setup".into(),
            format!("{SETUP_VERSION}-{}", running.image),
        ],
        &running.environment,
    )
    .await
    .wrap_err("workspace setup failed")
}

async fn open_vscode(project: &ProjectRoot, metadata: &WorkspaceMetadata) -> Result<()> {
    let extensions = process::output("code", &["--list-extensions"], &project.root)
        .await
        .wrap_err(
            "VS Code's `code` command is required; install it from VS Code's Command Palette",
        )?;
    if !extensions
        .lines()
        .any(|extension| extension.eq_ignore_ascii_case(VSCODE_EXTENSION))
    {
        bail!(
            "VS Code extension `{VSCODE_EXTENSION}` is required; install the Dev Containers extension"
        );
    }
    let uri = vscode_uri(&container_name(metadata), "/workspace");
    process::run(
        "code",
        &["--new-window".into(), "--folder-uri".into(), uri],
        &project.root,
        &Default::default(),
    )
    .await
    .wrap_err("could not open the workspace in VS Code")
}

fn vscode_uri(container: &str, folder: &str) -> String {
    let descriptor = serde_json::json!({ "containerName": container }).to_string();
    let hex = descriptor
        .as_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    format!("vscode-remote://attached-container+{hex}{folder}")
}

fn workspace_volumes(metadata: &WorkspaceMetadata) -> Vec<String> {
    [
        "node-modules",
        "bun-cache",
        "cargo-target",
        "cargo-registry",
        "go-build",
        "go-mod",
        "state",
        "vscode-server",
    ]
    .into_iter()
    .map(|suffix| format!("control-{}-{suffix}", metadata.id))
    .collect()
}

fn workspace_assets(project: &ProjectRoot, metadata: &WorkspaceMetadata) -> PathBuf {
    for root in [&metadata.source_root, &project.root, &project.oss] {
        for candidate in [
            root.join("oss/scripts/dev-tools/workspace"),
            root.join("scripts/dev-tools/workspace"),
        ] {
            if candidate.is_dir() {
                return candidate;
            }
        }
    }
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

fn manifest_name(loaded: &LoadedManifest) -> String {
    loaded
        .manifest
        .package
        .as_ref()
        .map(|package| package.name.clone())
        .unwrap_or_else(|| loaded.path.display().to_string())
}

fn hosts_markdown(metadata: &WorkspaceMetadata, manifests: &[&LoadedManifest]) -> String {
    let mut entries = manifests
        .iter()
        .flat_map(|loaded| {
            let name = manifest_name(loaded);
            loaded
                .manifest
                .expose
                .iter()
                .map(move |exposure| (exposure.port, name.clone()))
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| left.0.cmp(&right.0).then(left.1.cmp(&right.1)));

    let mut lines = vec![
        "# Workspace hosts".into(),
        String::new(),
        format!("Hostname: `{}`", metadata.hostname),
        String::new(),
        "## Exposed HTTP endpoints".into(),
        String::new(),
    ];
    if entries.is_empty() {
        lines.push("_No `[[dev.expose]]` ports declared._".into());
    } else {
        for (port, name) in entries {
            lines.push(format!(
                "- `{name}` — http://{}:{port}",
                metadata.hostname
            ));
        }
    }
    lines.push(String::new());
    lines.join("\n")
}

fn write_hosts_file(
    project: &ProjectRoot,
    metadata: &WorkspaceMetadata,
    manifests: &[&LoadedManifest],
) -> Result<()> {
    let path = project.root.join("HOST.md");
    fs::write(&path, hosts_markdown(metadata, manifests))
        .into_diagnostic()
        .wrap_err_with(|| format!("could not write {}", path.display()))?;
    Ok(())
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
    let args = compose_args(&assets.join("proxy.docker-compose.yml"), PROXY_PROJECT)
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
    fs::read(&dockerfile).into_diagnostic()?.hash(&mut hasher);
    fs::read(&entrypoint).into_diagnostic()?.hash(&mut hasher);
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
    println!("Building development image {image}");
    docker_run(
        root,
        vec![
            "build".into(),
            "--progress".into(),
            "plain".into(),
            "--tag".into(),
            image.clone(),
            "--file".into(),
            dockerfile.to_string_lossy().into_owned(),
            assets.to_string_lossy().into_owned(),
        ],
        &Default::default(),
    )
    .await
    .wrap_err("could not build the workspace development image")?;
    Ok(image)
}

async fn start_services(
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
    provision_databases(
        &project.root,
        &compose,
        &project_name,
        manifests,
        environment,
    )
    .await?;
    Ok(format!("{project_name}_workspace-services"))
}

async fn provision_databases(
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

fn services_project(metadata: &WorkspaceMetadata) -> String {
    format!("control_ws_{}", metadata.id.replace('-', "_"))
}

fn container_name(metadata: &WorkspaceMetadata) -> String {
    format!("metorial-ws-{}", metadata.id)
}

fn resolve_services_host() -> Result<String> {
    if let Ok(value) = std::env::var("CONTROL_SERVICES_HOST")
        && !value.trim().is_empty()
    {
        return Ok(value.trim().to_string());
    }
    use std::net::{IpAddr, ToSocketAddrs};
    let addresses = ("services", 0)
        .to_socket_addrs()
        .into_diagnostic()
        .wrap_err(
            "could not resolve hostname `services` for the workspace container \
             (override with CONTROL_SERVICES_HOST)",
        )?
        .filter_map(|address| match address.ip() {
            IpAddr::V4(ip) if !ip.is_loopback() => Some(ip),
            _ => None,
        })
        .collect::<Vec<_>>();
    if let Some(ip) = addresses.iter().find(|ip| {
        let octets = ip.octets();
        octets[0] == 100 && (64..128).contains(&octets[1])
    }) {
        return Ok(ip.to_string());
    }
    addresses
        .first()
        .map(ToString::to_string)
        .ok_or_else(|| miette::miette!("hostname `services` has no non-loopback IPv4 address"))
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

async fn inspect_value(root: &Path, name: &str, format: &str) -> Option<String> {
    process::output("docker", &["inspect", "--format", format, name], root)
        .await
        .ok()
}

async fn output_args(program: &str, args: &[String], root: &Path) -> Result<String> {
    let refs = args.iter().map(String::as_str).collect::<Vec<_>>();
    process::output(program, &refs, root).await
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
    use crate::manifest::{Exposure, Manifest, Package};

    fn metadata() -> WorkspaceMetadata {
        WorkspaceMetadata {
            id: "feature-auth".into(),
            hostname: "feature-auth.localhost".into(),
            branch: "feature/auth".into(),
            source_root: "/code/metorial".into(),
        }
    }

    #[test]
    fn generates_stable_resource_names_and_volumes() {
        let metadata = metadata();
        assert_eq!(container_name(&metadata), "metorial-ws-feature-auth");
        assert_eq!(services_project(&metadata), "control_ws_feature_auth");
        let volumes = workspace_volumes(&metadata);
        assert!(volumes.contains(&"control-feature-auth-state".into()));
        assert!(volumes.contains(&"control-feature-auth-vscode-server".into()));
    }

    #[test]
    fn writes_hosts_markdown_from_workspace_hostname() {
        let metadata = metadata();
        let manifests = [
            LoadedManifest {
                path: "apps/dashboard/control.toml".into(),
                manifest: Manifest {
                    package: Some(Package {
                        name: "@metorial/dashboard".into(),
                        groups: vec![],
                    }),
                    expose: vec![Exposure { port: 4300 }],
                    ..Default::default()
                },
            },
            LoadedManifest {
                path: "services/api/control.toml".into(),
                manifest: Manifest {
                    package: Some(Package {
                        name: "@metorial/core-api".into(),
                        groups: vec![],
                    }),
                    expose: vec![Exposure { port: 4310 }, Exposure { port: 4318 }],
                    ..Default::default()
                },
            },
        ];
        let selected = manifests.iter().collect::<Vec<_>>();
        let markdown = hosts_markdown(&metadata, &selected);
        assert!(markdown.contains("Hostname: `feature-auth.localhost`"));
        assert!(markdown.contains("- `@metorial/dashboard` — http://feature-auth.localhost:4300"));
        assert!(markdown.contains("- `@metorial/core-api` — http://feature-auth.localhost:4310"));
        assert!(markdown.contains("- `@metorial/core-api` — http://feature-auth.localhost:4318"));
        assert!(
            markdown.find("4300").unwrap() < markdown.find("4310").unwrap(),
            "endpoints should be sorted by port"
        );
    }

    #[test]
    fn encodes_vscode_attached_container_uri() {
        let uri = vscode_uri("metorial-ws-test", "/workspace");
        let descriptor = serde_json::json!({ "containerName": "metorial-ws-test" }).to_string();
        let hex = descriptor
            .as_bytes()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        assert_eq!(
            uri,
            format!("vscode-remote://attached-container+{hex}/workspace")
        );
    }

    #[test]
    fn detects_when_a_container_needs_dependency_network_attachment() {
        let networks = r#"{"control_proxy":{"NetworkID":"one"}}"#;
        assert!(has_network(networks, "control_proxy").unwrap());
        assert!(!has_network(networks, "control_ws_test_workspace-services").unwrap());
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
            assert!(compose.contains(&format!("'{port}:{port}'")));
            assert!(traefik.contains(&format!("port-{port}:")));
        }
    }
}
