use std::{
    fs,
    path::{Path, PathBuf},
};

use miette::{IntoDiagnostic, Result, WrapErr, bail};

use crate::{
    dev, docker, environment, manifest, process,
    root::ProjectRoot,
    workspace::{self, ServicePorts, WorkspaceMetadata, WorkspaceRuntime},
};

const SETUP_VERSION: &str = "v1";
const POSTGRES_CLONE_VERSION: &str = "v1";
const SOURCE_DATABASE_QUERY: &str = "SELECT datname FROM pg_database \
    WHERE datallowconn AND NOT datistemplate AND datname <> 'postgres' \
    ORDER BY datname";

pub async fn initialize(project: &ProjectRoot, clone_root_postgres: bool) -> Result<()> {
    let metadata = host_metadata(project).await?;
    generate_compose(project, &metadata)?;
    start_services(project).await?;
    if clone_root_postgres {
        clone_postgres(project, &metadata).await?;
    }

    let marker = project
        .root
        .join(format!(".control/host-bootstrap-{SETUP_VERSION}"));
    if marker.is_file() {
        println!("Workspace setup is already current");
        return Ok(());
    }

    println!("Installing host workspace dependencies");
    process::run(
        "bun",
        &["install".into()],
        &project.root,
        &environment::root_environment(project)?,
    )
    .await
    .wrap_err("bun install failed")?;

    println!("Building Control");
    process::run(
        "cargo",
        &[
            "build".into(),
            "--manifest-path".into(),
            control_manifest(project).to_string_lossy().into_owned(),
        ],
        &project.root,
        &Default::default(),
    )
    .await
    .wrap_err("could not build Control")?;

    println!("Running Control prepare");
    dev::run_prepare(project, &[], true).await?;
    fs::write(&marker, SETUP_VERSION)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not write {}", marker.display()))?;
    println!("Host workspace setup complete");
    Ok(())
}

pub async fn run(project: &ProjectRoot, rebuild: bool, open_code: bool) -> Result<()> {
    if rebuild {
        bail!("--rebuild is only supported by Docker workspaces");
    }
    initialize(project, false).await?;
    if open_code {
        open(project).await?;
    }
    Ok(())
}

pub async fn open(project: &ProjectRoot) -> Result<()> {
    process::run(
        "code",
        &[
            "--new-window".into(),
            project.root.to_string_lossy().into_owned(),
        ],
        &project.root,
        &Default::default(),
    )
    .await
    .wrap_err("VS Code's `code` command is required; install it from VS Code's Command Palette")
}

pub async fn control(project: &ProjectRoot) -> Result<()> {
    initialize(project, false).await?;
    dev::run(project, &[], false, false, false, false).await
}

pub async fn shell(project: &ProjectRoot) -> Result<()> {
    initialize(project, false).await?;
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    process::run(
        &shell,
        &["-l".into()],
        &project.root,
        &environment::root_environment(project)?,
    )
    .await
    .wrap_err("workspace shell exited unsuccessfully")
}

pub async fn stop(project: &ProjectRoot, volumes: bool) -> Result<()> {
    let metadata = host_metadata(project).await?;
    generate_compose(project, &metadata)?;
    let compose = compose_path(project);
    let mut args = compose_args(&compose);
    if volumes {
        args.extend(["down".into(), "--volumes".into()]);
    } else {
        args.push("stop".into());
    }
    process::run("docker", &args, &project.root, &Default::default())
        .await
        .wrap_err("could not stop host workspace dependencies")?;
    println!(
        "{}",
        if volumes {
            "stopped host workspace and removed its dependency data"
        } else {
            "stopped host workspace; dependency data was retained"
        }
    );
    Ok(())
}

pub async fn status(project: &ProjectRoot) -> Result<()> {
    let metadata = host_metadata(project).await?;
    let ports = required_ports(&metadata)?;
    println!("workspace: {}", metadata.id);
    println!("branch: {}", metadata.branch);
    println!("runtime: host");
    println!("hostname: localhost");
    println!("postgres: localhost:{}", ports.postgres);
    println!("mongo: localhost:{}", ports.mongo);
    println!("redis: localhost:{}", ports.redis);
    println!("nats: localhost:{}", ports.nats);
    println!("etcd: localhost:{}", ports.etcd_client);
    if !compose_path(project).is_file() {
        println!("dependencies: not initialized");
        return Ok(());
    }
    let mut args = compose_args(&compose_path(project));
    args.extend([
        "ps".into(),
        "--status".into(),
        "running".into(),
        "--quiet".into(),
    ]);
    let refs = args.iter().map(String::as_str).collect::<Vec<_>>();
    let running = process::output("docker", &refs, &project.root)
        .await
        .unwrap_or_default()
        .lines()
        .count();
    println!("dependencies: {running}/5 running");
    Ok(())
}

async fn start_services(project: &ProjectRoot) -> Result<()> {
    let mut manifests = manifest::discover(&project.root)?;
    workspace::configure_manifests(project, &mut manifests).await?;
    let externals = manifest::load_externals(&project.root, &mut manifests)?;
    let mut selected =
        manifest::select_with_dependencies_excluding(&manifests, &[], &project.kind, &externals)?;
    selected.retain(|loaded| {
        loaded
            .manifest
            .package
            .as_ref()
            .is_none_or(|package| !externals.contains(&package.name))
    });
    let env = environment::root_environment(project)?;
    docker::start(&project.root, &selected, &env)
        .await
        .map(|_| ())
        .wrap_err("host workspace Docker startup failed")
}

async fn clone_postgres(project: &ProjectRoot, metadata: &WorkspaceMetadata) -> Result<()> {
    let marker = postgres_clone_marker(project);
    if marker.is_file() {
        println!("Root Postgres snapshot is already installed");
        return Ok(());
    }

    let source_compose = source_services_compose(metadata)?;
    println!("Starting root Postgres for workspace snapshot");
    let mut start_args = source_compose_args(&source_compose);
    start_args.extend([
        "up".into(),
        "--detach".into(),
        "--wait".into(),
        "--wait-timeout".into(),
        "60".into(),
        "postgres-db2".into(),
    ]);
    process::run(
        "docker",
        &start_args,
        &metadata.source_root,
        &Default::default(),
    )
    .await
    .wrap_err("could not start root Postgres")?;

    let mut list_args = source_compose_args(&source_compose);
    list_args.extend([
        "exec".into(),
        "-T".into(),
        "postgres-db2".into(),
        "psql".into(),
        "-U".into(),
        "postgres".into(),
        "-d".into(),
        "postgres".into(),
        "-At".into(),
        "-c".into(),
        SOURCE_DATABASE_QUERY.into(),
    ]);
    let list_refs = list_args.iter().map(String::as_str).collect::<Vec<_>>();
    let databases = parse_database_names(
        &process::output("docker", &list_refs, &metadata.source_root)
            .await
            .wrap_err("could not list root Postgres databases")?,
    );
    let target_compose = compose_path(project);
    for database in databases {
        println!("Cloning root Postgres database {database}");
        reset_target_database(project, &target_compose, &database).await?;

        let mut dump_args = source_compose_args(&source_compose);
        dump_args.extend([
            "exec".into(),
            "-T".into(),
            "postgres-db2".into(),
            "pg_dump".into(),
            "-U".into(),
            "postgres".into(),
            "--format=custom".into(),
            "--no-owner".into(),
            "--no-acl".into(),
            "--".into(),
            database.clone(),
        ]);
        let mut restore_args = compose_args(&target_compose);
        restore_args.extend([
            "exec".into(),
            "-T".into(),
            "postgres-db2".into(),
            "pg_restore".into(),
            "-U".into(),
            "postgres".into(),
            "--exit-on-error".into(),
            "--no-owner".into(),
            "--no-acl".into(),
            "--dbname".into(),
            database.clone(),
        ]);
        process::pipe(
            "docker",
            &dump_args,
            "docker",
            &restore_args,
            &project.root,
            &Default::default(),
        )
        .await
        .wrap_err_with(|| format!("could not clone Postgres database {database}"))?;
    }
    fs::write(&marker, POSTGRES_CLONE_VERSION)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not write {}", marker.display()))?;
    println!("Root Postgres snapshot installed");
    Ok(())
}

fn postgres_clone_marker(project: &ProjectRoot) -> PathBuf {
    project.root.join(format!(
        ".control/root-postgres-cloned-{POSTGRES_CLONE_VERSION}"
    ))
}

async fn reset_target_database(
    project: &ProjectRoot,
    compose: &Path,
    database: &str,
) -> Result<()> {
    let mut drop_args = compose_args(compose);
    drop_args.extend([
        "exec".into(),
        "-T".into(),
        "postgres-db2".into(),
        "dropdb".into(),
        "-U".into(),
        "postgres".into(),
        "--if-exists".into(),
        "--force".into(),
        "--".into(),
        database.into(),
    ]);
    process::run("docker", &drop_args, &project.root, &Default::default())
        .await
        .wrap_err_with(|| format!("could not reset workspace database {database}"))?;
    let mut create_args = compose_args(compose);
    create_args.extend([
        "exec".into(),
        "-T".into(),
        "postgres-db2".into(),
        "createdb".into(),
        "-U".into(),
        "postgres".into(),
        "--encoding=UTF8".into(),
        "--".into(),
        database.into(),
    ]);
    process::run("docker", &create_args, &project.root, &Default::default())
        .await
        .wrap_err_with(|| format!("could not create workspace database {database}"))
}

fn parse_database_names(output: &str) -> Vec<String> {
    let mut databases = output
        .lines()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(String::from)
        .collect::<Vec<_>>();
    databases.sort();
    databases.dedup();
    databases
}

fn source_services_compose(metadata: &WorkspaceMetadata) -> Result<PathBuf> {
    [
        metadata
            .source_root
            .join("oss/scripts/dev-tools/services.docker-compose.yml"),
        metadata
            .source_root
            .join("scripts/dev-tools/services.docker-compose.yml"),
    ]
    .into_iter()
    .find(|path| path.is_file())
    .ok_or_else(|| {
        miette::miette!(
            "could not find root services.docker-compose.yml below {}",
            metadata.source_root.display()
        )
    })
}

fn source_compose_args(compose: &Path) -> Vec<String> {
    vec![
        "compose".into(),
        "--project-name".into(),
        "dev_services".into(),
        "--file".into(),
        compose.to_string_lossy().into_owned(),
    ]
}

fn generate_compose(project: &ProjectRoot, metadata: &WorkspaceMetadata) -> Result<PathBuf> {
    let source = default_compose(project);
    let source_contents = fs::read_to_string(&source)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not read {}", source.display()))?;
    let contents = render_compose(&source_contents, metadata)?;

    let path = compose_path(project);
    let parent = path
        .parent()
        .ok_or_else(|| miette::miette!("generated Compose path has no parent"))?;
    fs::create_dir_all(parent).into_diagnostic()?;
    let temporary = parent.join(".services.docker-compose.tmp");
    fs::write(&temporary, contents).into_diagnostic()?;
    fs::rename(&temporary, &path)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not install {}", path.display()))?;
    Ok(path)
}

fn render_compose(source: &str, metadata: &WorkspaceMetadata) -> Result<String> {
    let ports = required_ports(metadata)?;
    let mut contents = source.to_string();
    for (from, to) in [
        ("32379:2379", format!("{}:2379", ports.etcd_client)),
        ("32380:2380", format!("{}:2380", ports.etcd_peer)),
        ("32707:27017", format!("{}:27017", ports.mongo)),
        ("36379:6379", format!("{}:6379", ports.redis)),
        ("35432:5432", format!("{}:5432", ports.postgres)),
        ("34222:4222", format!("{}:4222", ports.nats)),
    ] {
        contents = contents.replace(from, &to);
    }
    contents = contents.replace(
        "    name: control_services",
        &format!("    name: control_{}_services", metadata.id),
    );
    contents = format!("name: control_host_{}\n{contents}", metadata.id);
    Ok(contents)
}

fn default_compose(project: &ProjectRoot) -> PathBuf {
    project
        .oss
        .join("scripts/dev-tools/services.docker-compose.yml")
}

fn compose_path(project: &ProjectRoot) -> PathBuf {
    project.root.join(".control/services.docker-compose.yml")
}

fn compose_args(compose: &Path) -> Vec<String> {
    vec![
        "compose".into(),
        "--file".into(),
        compose.to_string_lossy().into_owned(),
    ]
}

fn control_manifest(project: &ProjectRoot) -> PathBuf {
    project.oss.join("src/control/Cargo.toml")
}

async fn host_metadata(project: &ProjectRoot) -> Result<WorkspaceMetadata> {
    let metadata = workspace::metadata(project).await?;
    if metadata.runtime != WorkspaceRuntime::Host {
        bail!("workspace {} is not a host workspace", metadata.id);
    }
    required_ports(&metadata)?;
    Ok(metadata)
}

fn required_ports(metadata: &WorkspaceMetadata) -> Result<&ServicePorts> {
    metadata
        .service_ports
        .as_ref()
        .ok_or_else(|| miette::miette!("host workspace metadata is missing service_ports"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::root::RootKind;
    use crate::workspace::{ServicePorts, WorkspaceRuntime};
    use tempfile::tempdir;

    #[test]
    fn compose_arguments_use_the_generated_file() {
        assert_eq!(
            compose_args(Path::new("/code/.control/services.docker-compose.yml")),
            [
                "compose",
                "--file",
                "/code/.control/services.docker-compose.yml"
            ]
        );
    }

    #[test]
    fn renders_workspace_project_and_custom_ports() {
        let metadata = WorkspaceMetadata {
            id: "feature-auth".into(),
            hostname: "feature-auth.localhost".into(),
            branch: "feature/auth".into(),
            source_root: "/code/metorial".into(),
            runtime: WorkspaceRuntime::Host,
            service_ports: Some(ServicePorts {
                postgres: 40001,
                mongo: 40002,
                redis: 40003,
                nats: 40004,
                etcd_client: 40005,
                etcd_peer: 40006,
            }),
            endpoint_ports: Default::default(),
        };
        let rendered = render_compose(
            "services:\n  postgres:\n    ports:\n      - '35432:5432'\nnetworks:\n  control-services:\n    name: control_services\n",
            &metadata,
        )
        .unwrap();
        assert!(rendered.starts_with("name: control_host_feature-auth\n"));
        assert!(rendered.contains("'40001:5432'"));
        assert!(rendered.contains("name: control_feature-auth_services"));
    }

    #[test]
    fn parses_source_database_names_deterministically() {
        assert_eq!(
            parse_database_names("zeta\nalpha\n\nalpha\n"),
            ["alpha", "zeta"]
        );
        assert!(SOURCE_DATABASE_QUERY.contains("NOT datistemplate"));
        assert!(SOURCE_DATABASE_QUERY.contains("datname <> 'postgres'"));
        assert!(SOURCE_DATABASE_QUERY.contains("ORDER BY datname"));
    }

    #[test]
    fn builds_root_compose_arguments_and_clone_marker() {
        let temp = tempdir().unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: temp.path().into(),
            oss: temp.path().into(),
        };
        assert_eq!(
            source_compose_args(Path::new("/code/services.docker-compose.yml")),
            [
                "compose",
                "--project-name",
                "dev_services",
                "--file",
                "/code/services.docker-compose.yml"
            ]
        );
        assert_eq!(
            postgres_clone_marker(&project),
            temp.path().join(".control/root-postgres-cloned-v1")
        );
        assert!(!postgres_clone_marker(&project).exists());
        fs::create_dir_all(temp.path().join(".control")).unwrap();
        fs::write(postgres_clone_marker(&project), "v1").unwrap();
        assert!(postgres_clone_marker(&project).is_file());
    }
}
