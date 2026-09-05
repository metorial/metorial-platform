use std::{
    collections::{BTreeMap, BTreeSet, hash_map::DefaultHasher},
    fs,
    hash::{Hash, Hasher},
    net::{IpAddr, ToSocketAddrs},
    path::{Path, PathBuf},
};

use miette::{IntoDiagnostic, Result, WrapErr, bail};

use crate::{
    environment,
    infrastructure::{self, RenderOptions, Requirements},
    manifest::{self, LoadedManifest},
    process, proxy,
    root::ProjectRoot,
    workspace::{self, WorkspaceMetadata},
};

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

/// Ensure the workspace container is running, then exec `bun control` inside it.
pub async fn control(project: &ProjectRoot) -> Result<()> {
    let running = ensure_running(project, false).await?;
    bootstrap(project, &running).await?;
    process::run(
        "docker",
        &[
            "exec".into(),
            "--interactive".into(),
            "--tty".into(),
            "--workdir".into(),
            "/workspace".into(),
            running.name,
            "bun".into(),
            "control".into(),
        ],
        &project.root,
        &running.environment,
    )
    .await
    .wrap_err("workspace `bun control` exited unsuccessfully")
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
    proxy::unregister_workspace(project, &metadata)?;
    let environment = workspace_environment(project, &metadata)?;
    let name = container_name(&metadata);
    if inspect_value(&project.root, &name, "{{.Id}}")
        .await
        .is_some()
    {
        docker_run(
            &project.root,
            vec!["stop".into(), "--timeout".into(), "20".into(), name.clone()],
            &environment,
        )
        .await
        .wrap_err("could not stop workspace container")?;
    }

    let assets = generated_assets(project);
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
    println!("runtime: docker");
    println!("hostname: {}", metadata.hostname);
    let container_status = inspect_value(
        &project.root,
        &container_name(&metadata),
        "{{.State.Status}}",
    )
    .await
    .unwrap_or_else(|| "not created".into());
    println!("container: {container_status}");
    let assets = generated_assets(project);
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
    let mut total_args = compose_args(
        &assets.join("services.docker-compose.yml"),
        &services_project(&metadata),
    );
    total_args.extend(["config".into(), "--services".into()]);
    let total_services = output_args("docker", &total_args, &project.root)
        .await
        .unwrap_or_default()
        .lines()
        .count();
    println!("dependencies: {running_services}/{total_services} running");
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
    let mut manifests = manifest::discover(&project.root)?;
    let externals = manifest::load_externals(&project.root, &mut manifests)?;
    let external_hosts =
        resolve_external_hosts(&manifest::load_external_hostnames(&project.root)?)?;
    let mut selected =
        manifest::select_with_dependencies_excluding(&manifests, &[], &project.kind, &externals)?;
    selected.retain(|loaded| {
        loaded
            .manifest
            .package
            .as_ref()
            .is_none_or(|package| !externals.contains(&package.name))
    });
    if selected.is_empty() {
        bail!("no control.toml manifests were selected");
    }
    let ports = exposed_ports(&selected);
    let image_assets = workspace_assets(project, &metadata);
    let assets = generate_runtime_assets(project, &metadata, &selected)?;
    ensure_proxy_network(&project.root).await?;
    let environment = workspace_environment(project, &metadata)?;
    let service_network =
        start_services(project, &metadata, &selected, &assets, &environment).await?;
    let image = ensure_image(&project.root, &image_assets, rebuild).await?;
    let name = container_name(&metadata);

    let existing_image = inspect_value(&project.root, &name, "{{.Config.Image}}").await;
    let external_hosts_label = external_host_label(&external_hosts);
    let existing_external_hosts = inspect_value(
        &project.root,
        &name,
        "{{index .Config.Labels \"control.external-hosts\"}}",
    )
    .await
    .filter(|value| value != "<no value>")
    .unwrap_or_default();
    let proxy_root = proxy::proxy_root(project, &metadata);
    let existing_proxy_root = inspect_value(
        &project.root,
        &name,
        "{{index .Config.Labels \"control.proxy-root\"}}",
    )
    .await
    .filter(|value| value != "<no value>")
    .unwrap_or_default();
    let needs_replacement = container_needs_replacement(
        existing_image.as_deref(),
        &image,
        &existing_external_hosts,
        &external_hosts_label,
    ) || existing_proxy_root != proxy_root.to_string_lossy();
    if needs_replacement {
        docker_run(
            &project.root,
            vec!["rm".into(), "--force".into(), name.clone()],
            &environment,
        )
        .await
        .wrap_err("could not replace an outdated workspace container")?;
    }
    if existing_image.as_deref() != Some(image.as_str()) || needs_replacement {
        create_container(
            project,
            &metadata,
            &environment,
            &image,
            &name,
            &ports,
            &external_hosts,
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
    environment: &BTreeMap<String, String>,
    image: &str,
    name: &str,
    _ports: &BTreeSet<u16>,
    external_hosts: &[(String, String)],
) -> Result<()> {
    let mut git_directories = BTreeSet::new();
    git_directories.insert(git_common_directory(&project.root).await?);
    if project.oss != project.root {
        git_directories.insert(git_common_directory(&project.oss).await?);
    }
    let volumes = workspace_volumes(metadata);
    let proxy_root = proxy::proxy_root(project, metadata);
    fs::create_dir_all(&proxy_root).into_diagnostic()?;
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
        "--env".into(),
        format!("METORIAL_HOSTNAME={}", metadata.hostname),
        "--env".into(),
        format!("CONTROL_WORKSPACE_ID={}", metadata.id),
        "--env".into(),
        format!("CONTROL_PROXY_ROOT={}", proxy_root.display()),
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
        "--volume".into(),
        format!("{}:{}", proxy_root.display(), proxy_root.display()),
        "--volume".into(),
        "/var/run/docker.sock:/var/run/docker.sock".into(),
        "--label".into(),
        format!("control.workspace={}", metadata.id),
        "--label".into(),
        format!("control.proxy-root={}", proxy_root.display()),
    ];
    for directory in git_directories {
        args.extend([
            "--volume".into(),
            format!("{}:{}:rw", directory.display(), directory.display()),
        ]);
    }
    args.extend(external_host_args(external_hosts));
    if !project.root.join("env.json").is_file() {
        let inherited = metadata.source_root.join("env.json");
        if inherited.is_file() {
            args.extend([
                "--volume".into(),
                format!("{}:/workspace/env.json:ro", inherited.display()),
            ]);
        }
    }
    let external_hosts_label = external_host_label(external_hosts);
    if !external_hosts_label.is_empty() {
        args.extend([
            "--label".into(),
            format!("control.external-hosts={external_hosts_label}"),
        ]);
    }
    args.push(image.into());
    docker_run(&project.root, args, environment)
        .await
        .wrap_err("could not create workspace development container")
}

fn resolve_external_hosts(hostnames: &BTreeSet<String>) -> Result<Vec<(String, String)>> {
    hostnames
        .iter()
        .map(|hostname| {
            let override_address = (hostname == "services")
                .then(|| std::env::var("CONTROL_SERVICES_HOST").ok())
                .flatten()
                .filter(|value| !value.trim().is_empty());
            let lookup = override_address.as_deref().unwrap_or(hostname);
            if lookup.parse::<IpAddr>().is_ok() {
                return Ok((hostname.clone(), lookup.to_string()));
            }
            let addresses = (lookup, 0)
                .to_socket_addrs()
                .into_diagnostic()
                .wrap_err_with(|| format!("could not resolve external hostname {lookup:?}"))?
                .filter_map(|address| match address.ip() {
                    IpAddr::V4(ip) if !ip.is_loopback() => Some(ip),
                    _ => None,
                })
                .collect::<Vec<_>>();
            let address = addresses
                .iter()
                .find(|ip| {
                    let octets = ip.octets();
                    octets[0] == 100 && (64..128).contains(&octets[1])
                })
                .or_else(|| addresses.first())
                .ok_or_else(|| {
                    miette::miette!("external hostname {lookup:?} has no non-loopback IPv4 address")
                })?;
            Ok((hostname.clone(), address.to_string()))
        })
        .collect()
}

fn external_host_args(hosts: &[(String, String)]) -> Vec<String> {
    hosts
        .iter()
        .flat_map(|(hostname, address)| ["--add-host".into(), format!("{hostname}:{address}")])
        .collect()
}

fn external_host_label(hosts: &[(String, String)]) -> String {
    hosts
        .iter()
        .map(|(hostname, address)| format!("{hostname}={address}"))
        .collect::<Vec<_>>()
        .join(",")
}

fn container_needs_replacement(
    existing_image: Option<&str>,
    desired_image: &str,
    existing_external_hosts: &str,
    desired_external_hosts: &str,
) -> bool {
    existing_image.is_some_and(|image| {
        image != desired_image || existing_external_hosts != desired_external_hosts
    })
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

fn generated_assets(project: &ProjectRoot) -> PathBuf {
    project.root.join(".control/workspace")
}

fn generate_runtime_assets(
    project: &ProjectRoot,
    metadata: &WorkspaceMetadata,
    manifests: &[&LoadedManifest],
) -> Result<PathBuf> {
    let directory = generated_assets(project);
    fs::create_dir_all(&directory).into_diagnostic()?;
    let requirements = Requirements::from_manifests(manifests);
    let project_name = services_project(metadata);
    infrastructure::write_compose(
        &directory.join("services.docker-compose.yml"),
        &requirements,
        &RenderOptions {
            project_name: Some(&project_name),
            network: "workspace-services",
            network_name: None,
            ports: None,
            restart: true,
        },
    )?;
    Ok(directory)
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
        .flat_map(|loaded| {
            loaded
                .manifest
                .endpoints
                .values()
                .map(|endpoint| endpoint.port)
        })
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
                .endpoints
                .iter()
                .map(move |(endpoint, definition)| {
                    (definition.port, name.clone(), endpoint.clone())
                })
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| {
        left.0
            .cmp(&right.0)
            .then(left.1.cmp(&right.1))
            .then(left.2.cmp(&right.2))
    });

    let mut lines = vec![
        "# Workspace hosts".into(),
        String::new(),
        format!("Hostname: `{}`", metadata.hostname),
        String::new(),
        format!(
            "Port 80 redirects to port 4300: http://{}/",
            metadata.hostname
        ),
        String::new(),
        "## Exposed HTTP endpoints".into(),
        String::new(),
    ];
    if entries.is_empty() {
        lines.push("_No named endpoints declared._".into());
    } else {
        for (port, name, endpoint) in entries {
            lines.push(format!(
                "- `{name}` / `{endpoint}` — http://{}:{port}",
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

async fn ensure_proxy_network(root: &Path) -> Result<()> {
    if docker_quiet(
        root,
        vec!["network".into(), "inspect".into(), PROXY_NETWORK.into()],
        &Default::default(),
    )
    .await
    .is_ok()
    {
        return Ok(());
    }
    docker_run(
        root,
        vec!["network".into(), "create".into(), PROXY_NETWORK.into()],
        &Default::default(),
    )
    .await
    .wrap_err("could not create the shared development proxy network")
}

pub(crate) async fn ensure_image(root: &Path, assets: &Path, rebuild: bool) -> Result<String> {
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

pub(crate) fn container_name(metadata: &WorkspaceMetadata) -> String {
    format!("metorial-ws-{}", metadata.id)
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
    use crate::manifest::{Endpoint, Manifest, Package};

    fn metadata() -> WorkspaceMetadata {
        WorkspaceMetadata {
            id: "feature-auth".into(),
            hostname: "metorial-feature-auth.localhost".into(),
            branch: "feature/auth".into(),
            source_root: "/code/metorial".into(),
            runtime: crate::workspace::WorkspaceRuntime::Docker,
            service_ports: None,
            endpoint_ports: Default::default(),
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
    fn generates_configuration_for_arbitrary_external_hosts() {
        let hosts = vec![
            ("api.internal.example".into(), "100.70.1.2".into()),
            ("services".into(), "100.70.1.3".into()),
        ];
        assert_eq!(
            external_host_args(&hosts),
            [
                "--add-host",
                "api.internal.example:100.70.1.2",
                "--add-host",
                "services:100.70.1.3",
            ]
        );
        let label = external_host_label(&hosts);
        assert_eq!(label, "api.internal.example=100.70.1.2,services=100.70.1.3");
        assert!(container_needs_replacement(
            Some("dev:image"),
            "dev:image",
            "",
            &label
        ));
        assert!(!container_needs_replacement(
            Some("dev:image"),
            "dev:image",
            &label,
            &label
        ));
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
                    endpoints: BTreeMap::from([(
                        "dashboard".into(),
                        Endpoint {
                            port: 4300,
                            bind_port: None,
                            env: vec![],
                        },
                    )]),
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
                    endpoints: BTreeMap::from([
                        (
                            "api".into(),
                            Endpoint {
                                port: 4310,
                                bind_port: None,
                                env: vec![],
                            },
                        ),
                        (
                            "events".into(),
                            Endpoint {
                                port: 4318,
                                bind_port: None,
                                env: vec![],
                            },
                        ),
                    ]),
                    ..Default::default()
                },
            },
        ];
        let selected = manifests.iter().collect::<Vec<_>>();
        let markdown = hosts_markdown(&metadata, &selected);
        assert!(markdown.contains("Hostname: `metorial-feature-auth.localhost`"));
        assert!(
            markdown.contains(
                "Port 80 redirects to port 4300: http://metorial-feature-auth.localhost/"
            )
        );
        assert!(markdown.contains(
            "- `@metorial/dashboard` / `dashboard` — http://metorial-feature-auth.localhost:4300"
        ));
        assert!(markdown.contains(
            "- `@metorial/core-api` / `api` — http://metorial-feature-auth.localhost:4310"
        ));
        assert!(markdown.contains(
            "- `@metorial/core-api` / `events` — http://metorial-feature-auth.localhost:4318"
        ));
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
}
