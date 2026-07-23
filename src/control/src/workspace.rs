use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    net::{Ipv4Addr, SocketAddrV4, TcpListener},
    path::{Path, PathBuf},
};

use clap::ValueEnum;
use miette::{IntoDiagnostic, Result, WrapErr, bail};
use serde::{Deserialize, Serialize};

use crate::{
    manifest::LoadedManifest,
    process,
    root::{self, ProjectRoot, RootKind},
    workspace_dev, workspace_host,
};

#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq, Eq, ValueEnum)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceRuntime {
    Host,
    #[default]
    Docker,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct ServicePorts {
    pub postgres: u16,
    pub mongo: u16,
    pub redis: u16,
    pub nats: u16,
    pub etcd_client: u16,
    pub etcd_peer: u16,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct WorkspaceMetadata {
    pub id: String,
    pub hostname: String,
    pub branch: String,
    pub source_root: PathBuf,
    #[serde(default)]
    pub runtime: WorkspaceRuntime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service_ports: Option<ServicePorts>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub endpoint_ports: std::collections::BTreeMap<String, std::collections::BTreeMap<String, u16>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListedWorkspace {
    pub branch: String,
    pub path: PathBuf,
    pub id: Option<String>,
    pub hostname: Option<String>,
    pub runtime: Option<WorkspaceRuntime>,
}

pub fn validate_branch(branch: &str) -> Result<()> {
    if branch.is_empty()
        || branch.starts_with('-')
        || branch.contains("..")
        || branch.contains([' ', '~', '^', ':', '?', '*', '[', '\\'])
        || branch.ends_with(['.', '/'])
        || branch.contains("//")
    {
        bail!("invalid git branch name {branch:?}");
    }
    Ok(())
}

pub fn branch_slug(branch: &str) -> String {
    branch
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

pub fn workspace_path(root: &Path, branch: &str) -> PathBuf {
    let name = root
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("metorial");
    root.parent()
        .unwrap_or(root)
        .join(format!("{name}-{}", branch_slug(branch)))
}

pub async fn create(
    project: &ProjectRoot,
    branch: &str,
    runtime: WorkspaceRuntime,
    open_code: bool,
) -> Result<PathBuf> {
    validate_branch(branch)?;
    let target = workspace_path(&project.root, branch);
    if target.exists() {
        bail!("workspace path already exists: {}", target.display());
    }
    let (service_ports, endpoint_ports) = match runtime {
        WorkspaceRuntime::Host => {
            let service_ports = allocate_service_ports(project).await?;
            let endpoint_ports = allocate_endpoint_ports(project, &service_ports).await?;
            (Some(service_ports), endpoint_ports)
        }
        WorkspaceRuntime::Docker => (None, Default::default()),
    };

    let root_branch_created = add_worktree(&project.root, &target, branch).await?;
    let mut oss_branch_created = false;
    let result = async {
        if project.kind == RootKind::Enterprise {
            let target_oss = target.join("oss");
            if target_oss.exists() {
                if target_oss.is_dir()
                    && fs::read_dir(&target_oss)
                        .into_diagnostic()?
                        .next()
                        .is_none()
                {
                    fs::remove_dir(&target_oss).into_diagnostic()?;
                } else {
                    bail!(
                        "enterprise worktree contains non-empty OSS path {}",
                        target_oss.display()
                    );
                }
            }
            oss_branch_created = add_worktree(&project.oss, &target_oss, branch).await?;
            initialize_submodules(&target_oss).await?;
        } else {
            initialize_submodules(&target).await?;
        }
        Ok(())
    }
    .await;

    if let Err(error) = result {
        if project.kind == RootKind::Enterprise {
            let _ = remove_worktree(&project.oss, &target.join("oss")).await;
            if oss_branch_created {
                let _ = delete_branch(&project.oss, branch).await;
            }
        }
        let _ = remove_worktree(&project.root, &target).await;
        if root_branch_created {
            let _ = delete_branch(&project.root, branch).await;
        }
        return Err(error).wrap_err("workspace creation rolled back");
    }

    let initialization = async {
        write_metadata(
            &target,
            &WorkspaceMetadata {
                id: workspace_id(branch),
                hostname: match runtime {
                    WorkspaceRuntime::Host => "localhost".into(),
                    WorkspaceRuntime::Docker => workspace_hostname(branch),
                },
                branch: branch.into(),
                source_root: project.root.clone(),
                runtime,
                service_ports,
                endpoint_ports,
            },
        )?;
        println!("created workspace {}", target.display());
        copy_env_json(&project.root, &target)?;
        let workspace_project = root::detect(&target)?;
        match runtime {
            WorkspaceRuntime::Host => workspace_host::initialize(&workspace_project, true).await,
            WorkspaceRuntime::Docker => workspace_dev::initialize(&workspace_project, false).await,
        }
    }
    .await;
    if let Err(error) = initialization {
        if let Ok(workspace_project) = root::detect(&target) {
            match runtime {
                WorkspaceRuntime::Host => {
                    let _ = workspace_host::stop(&workspace_project, true).await;
                }
                WorkspaceRuntime::Docker => {
                    let _ = workspace_dev::stop(&workspace_project, true).await;
                }
            }
        }
        if project.kind == RootKind::Enterprise {
            let _ = remove_worktree(&project.oss, &target.join("oss")).await;
            if oss_branch_created {
                let _ = delete_branch(&project.oss, branch).await;
            }
        }
        let _ = remove_worktree(&project.root, &target).await;
        if root_branch_created {
            let _ = delete_branch(&project.root, branch).await;
        }
        return Err(error).wrap_err("workspace initialization failed and was rolled back");
    }
    if open_code {
        let workspace_project = root::detect(&target)?;
        match runtime {
            WorkspaceRuntime::Host => workspace_host::open(&workspace_project).await,
            WorkspaceRuntime::Docker => workspace_dev::open(&workspace_project).await,
        }
        .wrap_err("workspace was created, but VS Code could not be opened")?;
    }
    Ok(target)
}

fn copy_env_json(source_root: &Path, target: &Path) -> Result<()> {
    let source = source_root.join("env.json");
    if !source.is_file() {
        return Ok(());
    }
    let destination = target.join("env.json");
    if destination.exists() {
        return Ok(());
    }
    fs::copy(&source, &destination)
        .into_diagnostic()
        .wrap_err_with(|| {
            format!(
                "could not copy {} to {}",
                source.display(),
                destination.display()
            )
        })?;
    println!("copied env.json");
    Ok(())
}

pub async fn list(project: &ProjectRoot) -> Result<Vec<ListedWorkspace>> {
    let source = source_root(project).await?;
    prune_stale_workspaces(project, &source).await?;
    let mut workspaces = Vec::new();
    for worktree in list_worktrees(&project.root).await? {
        if same_path(&worktree.path, &source) {
            continue;
        }
        let Some(branch) = worktree.branch else {
            continue;
        };
        let metadata = read_metadata_file(&worktree.path).ok().flatten();
        workspaces.push(ListedWorkspace {
            branch,
            path: worktree.path,
            id: metadata.as_ref().map(|metadata| metadata.id.clone()),
            hostname: metadata.as_ref().map(|metadata| metadata.hostname.clone()),
            runtime: metadata.as_ref().map(|metadata| metadata.runtime),
        });
    }
    workspaces.sort_by(|left, right| left.branch.cmp(&right.branch));
    Ok(workspaces)
}

pub async fn remove(project: &ProjectRoot, branch: &str) -> Result<()> {
    validate_branch(branch)?;
    let source = source_root(project).await?;
    let worktree = find_worktree(project, branch).await?;

    if same_path(&worktree.path, &source) {
        bail!("cannot remove the source checkout");
    }

    let cwd = std::env::current_dir().into_diagnostic()?;
    if same_path(&worktree.path, &cwd) || cwd.starts_with(&worktree.path) {
        bail!(
            "cannot remove the workspace you are currently in; run from the source checkout at {}",
            source.display()
        );
    }

    if let Ok(workspace_project) = root::detect(&worktree.path) {
        let cleanup = match metadata(&workspace_project).await {
            Ok(metadata) if metadata.runtime == WorkspaceRuntime::Host => {
                workspace_host::stop(&workspace_project, true).await
            }
            _ => workspace_dev::stop(&workspace_project, true).await,
        };
        if let Err(error) = cleanup {
            eprintln!("warning: could not remove workspace Docker resources: {error:?}");
        }
    }

    remove_paired_worktrees(project, &source, &worktree.path).await?;
    println!("removed workspace {}", worktree.path.display());
    Ok(())
}

/// Resolve the project for workspace lifecycle commands.
///
/// With no branch, operates on the current checkout. With a branch, finds that
/// branch's worktree (from the source repository) and returns its project root.
pub async fn resolve(project: &ProjectRoot, branch: Option<&str>) -> Result<ProjectRoot> {
    let Some(branch) = branch else {
        return Ok(project.clone());
    };
    validate_branch(branch)?;
    let source = source_root(project).await?;
    let worktree = find_worktree(project, branch).await?;
    if same_path(&worktree.path, &source) {
        bail!(
            "branch {branch:?} is the source checkout, not a workspace; \
             omit the branch name to operate on the current directory"
        );
    }
    root::detect(&worktree.path).wrap_err_with(|| {
        format!(
            "could not detect a Metorial project in workspace {}",
            worktree.path.display()
        )
    })
}

async fn find_worktree(project: &ProjectRoot, branch: &str) -> Result<GitWorktree> {
    list_worktrees(&project.root)
        .await?
        .into_iter()
        .find(|worktree| worktree.branch.as_deref() == Some(branch))
        .ok_or_else(|| miette::miette!("no workspace found for branch {branch:?}"))
}

pub async fn metadata(project: &ProjectRoot) -> Result<WorkspaceMetadata> {
    if let Some(metadata) = read_metadata_file(&project.root)? {
        return Ok(metadata);
    }

    let branch = process::output("git", &["branch", "--show-current"], &project.root)
        .await
        .unwrap_or_default();
    let branch = if branch.trim().is_empty() {
        project
            .root
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("workspace")
            .to_string()
    } else {
        branch
    };
    let source_root = source_root(project).await?;
    let metadata = WorkspaceMetadata {
        id: workspace_id(&branch),
        hostname: workspace_hostname(&branch),
        branch,
        source_root,
        runtime: WorkspaceRuntime::Docker,
        service_ports: None,
        endpoint_ports: Default::default(),
    };
    write_metadata(&project.root, &metadata)?;
    Ok(metadata)
}

fn metadata_path(root: &Path) -> PathBuf {
    root.join(".control/workspace.json")
}

fn write_metadata(root: &Path, metadata: &WorkspaceMetadata) -> Result<()> {
    let path = metadata_path(root);
    let parent = path
        .parent()
        .ok_or_else(|| miette::miette!("workspace metadata has no parent"))?;
    fs::create_dir_all(parent).into_diagnostic()?;
    let mut contents = serde_json::to_string_pretty(metadata).into_diagnostic()?;
    contents.push('\n');
    let temporary = parent.join(".workspace.json.tmp");
    fs::write(&temporary, contents)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not write {}", temporary.display()))?;
    fs::rename(&temporary, &path)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not install {}", path.display()))
}

fn read_metadata_file(root: &Path) -> Result<Option<WorkspaceMetadata>> {
    let path = metadata_path(root);
    if !path.is_file() {
        return Ok(None);
    }
    let contents = fs::read_to_string(&path)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not read {}", path.display()))?;
    let metadata = serde_json::from_str(&contents)
        .into_diagnostic()
        .wrap_err_with(|| format!("invalid {}", path.display()))?;
    Ok(Some(metadata))
}

pub fn metadata_if_present(root: &Path) -> Result<Option<WorkspaceMetadata>> {
    read_metadata_file(root)
}

pub async fn configure_manifests(
    project: &ProjectRoot,
    manifests: &mut [LoadedManifest],
) -> Result<()> {
    let Some(mut metadata) = read_metadata_file(&project.root)? else {
        return Ok(());
    };
    if metadata.runtime != WorkspaceRuntime::Host {
        return Ok(());
    }
    let ports = metadata
        .service_ports
        .clone()
        .ok_or_else(|| miette::miette!("host workspace metadata is missing service_ports"))?;
    if allocate_missing_endpoint_ports(project, manifests, &mut metadata, &ports).await? {
        write_metadata(&project.root, &metadata)?;
    }
    for loaded in manifests.iter_mut() {
        for database in loaded.manifest.postgres.values_mut() {
            database.compose = None;
            database.service = None;
            database.port = ports.postgres;
        }
        for database in loaded.manifest.mongo.values_mut() {
            database.compose = None;
            database.service = None;
            database.port = ports.mongo;
        }
        if let Some(package) = &loaded.manifest.package {
            for (name, endpoint) in &mut loaded.manifest.endpoints {
                endpoint.port = metadata
                    .endpoint_ports
                    .get(&package.name)
                    .expect("missing host endpoint ports were allocated")
                    .get(name)
                    .copied()
                    .expect("missing host endpoint port was allocated");
            }
        }
    }
    crate::manifest::refresh_dependency_endpoints(manifests);
    crate::manifest::validate_dependency_endpoints(manifests)?;
    Ok(())
}

async fn allocate_missing_endpoint_ports(
    project: &ProjectRoot,
    manifests: &[LoadedManifest],
    metadata: &mut WorkspaceMetadata,
    service_ports: &ServicePorts,
) -> Result<bool> {
    let missing = manifests
        .iter()
        .filter_map(|loaded| {
            loaded.manifest.package.as_ref().map(|package| {
                loaded
                    .manifest
                    .endpoints
                    .keys()
                    .filter(|endpoint| {
                        !metadata
                            .endpoint_ports
                            .get(&package.name)
                            .is_some_and(|ports| ports.contains_key(*endpoint))
                    })
                    .map(|endpoint| (package.name.clone(), endpoint.clone()))
                    .collect::<Vec<_>>()
            })
        })
        .flatten()
        .collect::<Vec<_>>();
    if missing.is_empty() {
        return Ok(false);
    }

    let mut reserved = reserved_endpoint_ports(manifests, service_ports);
    reserved.extend(
        metadata
            .endpoint_ports
            .values()
            .flat_map(|endpoints| endpoints.values())
            .copied(),
    );
    for worktree in list_worktrees(&project.root).await? {
        if let Some(workspace) = read_metadata_file(&worktree.path)? {
            reserved.extend(
                workspace
                    .endpoint_ports
                    .values()
                    .flat_map(|endpoints| endpoints.values())
                    .copied(),
            );
        }
    }
    let allocated = allocate_port_values(&reserved, missing.len())?;
    for ((package, endpoint), port) in missing.into_iter().zip(allocated) {
        metadata
            .endpoint_ports
            .entry(package)
            .or_default()
            .insert(endpoint, port);
    }
    Ok(true)
}

fn reserved_endpoint_ports(
    manifests: &[LoadedManifest],
    service_ports: &ServicePorts,
) -> BTreeSet<u16> {
    let mut reserved = BTreeSet::from([32379, 32380, 32707, 34222, 35432, 36379]);
    reserved.extend([
        service_ports.postgres,
        service_ports.mongo,
        service_ports.redis,
        service_ports.nats,
        service_ports.etcd_client,
        service_ports.etcd_peer,
    ]);
    reserved.extend(
        manifests
            .iter()
            .flat_map(|loaded| loaded.manifest.endpoints.values())
            .map(|endpoint| endpoint.port),
    );
    reserved
}

async fn allocate_service_ports(project: &ProjectRoot) -> Result<ServicePorts> {
    // Root development services use these stable ports even when currently
    // stopped. Never allocate them to a host workspace, because creation may
    // need to start root Postgres to clone its databases.
    let mut reserved = BTreeSet::from([32379, 32380, 32707, 34222, 35432, 36379]);
    for worktree in list_worktrees(&project.root).await? {
        if let Some(ports) =
            read_metadata_file(&worktree.path)?.and_then(|metadata| metadata.service_ports)
        {
            reserved.extend([
                ports.postgres,
                ports.mongo,
                ports.redis,
                ports.nats,
                ports.etcd_client,
                ports.etcd_peer,
            ]);
        }
    }
    allocate_available_ports(&reserved)
}

async fn allocate_endpoint_ports(
    project: &ProjectRoot,
    service_ports: &ServicePorts,
) -> Result<std::collections::BTreeMap<String, std::collections::BTreeMap<String, u16>>> {
    let manifests = crate::manifest::discover(&project.root)?;
    let declarations = manifests
        .iter()
        .filter_map(|loaded| {
            loaded.manifest.package.as_ref().map(|package| {
                loaded
                    .manifest
                    .endpoints
                    .keys()
                    .map(|endpoint| (package.name.clone(), endpoint.clone()))
                    .collect::<Vec<_>>()
            })
        })
        .flatten()
        .collect::<Vec<_>>();
    let mut reserved = reserved_endpoint_ports(&manifests, service_ports);
    for worktree in list_worktrees(&project.root).await? {
        if let Some(metadata) = read_metadata_file(&worktree.path)? {
            reserved.extend(
                metadata
                    .endpoint_ports
                    .values()
                    .flat_map(|endpoints| endpoints.values())
                    .copied(),
            );
        }
    }
    let ports = allocate_port_values(&reserved, declarations.len())?;
    let mut output = std::collections::BTreeMap::new();
    for ((package, endpoint), port) in declarations.into_iter().zip(ports) {
        output
            .entry(package)
            .or_insert_with(std::collections::BTreeMap::new)
            .insert(endpoint, port);
    }
    Ok(output)
}

fn allocate_port_values(reserved: &BTreeSet<u16>, count: usize) -> Result<Vec<u16>> {
    let mut listeners = Vec::new();
    let mut allocated = Vec::new();
    for port in 30000..60000 {
        if reserved.contains(&port) {
            continue;
        }
        if let Ok(listener) = TcpListener::bind(SocketAddrV4::new(Ipv4Addr::LOCALHOST, port)) {
            listeners.push(listener);
            allocated.push(port);
            if allocated.len() == count {
                break;
            }
        }
    }
    if allocated.len() != count {
        bail!("could not allocate {count} conflict-free endpoint ports");
    }
    Ok(allocated)
}

fn allocate_available_ports(reserved: &BTreeSet<u16>) -> Result<ServicePorts> {
    let mut listeners = Vec::new();
    let mut allocated = Vec::new();
    for port in 30000..60000 {
        if reserved.contains(&port) {
            continue;
        }
        if let Ok(listener) = TcpListener::bind(SocketAddrV4::new(Ipv4Addr::LOCALHOST, port)) {
            listeners.push(listener);
            allocated.push(port);
            if allocated.len() == 6 {
                break;
            }
        }
    }
    if allocated.len() != 6 {
        bail!("could not allocate six host workspace service ports");
    }
    Ok(ServicePorts {
        postgres: allocated[0],
        mongo: allocated[1],
        redis: allocated[2],
        nats: allocated[3],
        etcd_client: allocated[4],
        etcd_peer: allocated[5],
    })
}

async fn source_root(project: &ProjectRoot) -> Result<PathBuf> {
    if let Some(metadata) = read_metadata_file(&project.root)? {
        return Ok(metadata.source_root);
    }

    let common_git = process::output("git", &["rev-parse", "--git-common-dir"], &project.root)
        .await
        .ok()
        .map(PathBuf::from)
        .map(|path| {
            if path.is_absolute() {
                path
            } else {
                project.root.join(path)
            }
        })
        .and_then(|path| path.canonicalize().ok());
    Ok(common_git
        .as_deref()
        .filter(|path| path.file_name().and_then(|name| name.to_str()) == Some(".git"))
        .and_then(Path::parent)
        .filter(|path| path.join("package.json").is_file())
        .unwrap_or(&project.root)
        .to_path_buf())
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct GitWorktree {
    path: PathBuf,
    branch: Option<String>,
    prunable: bool,
}

async fn list_worktrees(repo: &Path) -> Result<Vec<GitWorktree>> {
    let output = process::output("git", &["worktree", "list", "--porcelain"], repo)
        .await
        .wrap_err_with(|| format!("could not list worktrees for {}", repo.display()))?;
    Ok(parse_worktree_list(&output))
}

fn parse_worktree_list(output: &str) -> Vec<GitWorktree> {
    let mut worktrees = Vec::new();
    let mut path: Option<PathBuf> = None;
    let mut branch: Option<String> = None;
    let mut prunable = false;

    for line in output.lines().chain(std::iter::once("")) {
        if line.is_empty() {
            if let Some(path) = path.take() {
                worktrees.push(GitWorktree {
                    path,
                    branch: branch.take(),
                    prunable,
                });
            } else {
                branch = None;
            }
            prunable = false;
            continue;
        }
        if let Some(value) = line.strip_prefix("worktree ") {
            if let Some(path) = path.take() {
                worktrees.push(GitWorktree {
                    path,
                    branch: branch.take(),
                    prunable,
                });
            }
            path = Some(PathBuf::from(value));
            prunable = false;
        } else if let Some(value) = line.strip_prefix("branch refs/heads/") {
            branch = Some(value.to_string());
        } else if line.starts_with("prunable") {
            prunable = true;
        }
    }
    worktrees
}

fn worktree_checkout_missing(path: &Path) -> bool {
    !path.exists() || !path.join(".git").exists()
}

async fn prune_stale_workspaces(project: &ProjectRoot, source: &Path) -> Result<()> {
    let stale: Vec<_> = list_worktrees(&project.root)
        .await?
        .into_iter()
        .filter(|worktree| {
            !same_path(&worktree.path, source)
                && (worktree.prunable || worktree_checkout_missing(&worktree.path))
        })
        .collect();
    for worktree in stale {
        eprintln!("pruning stale workspace {}", worktree.path.display());
        if let Err(error) = remove_paired_worktrees(project, source, &worktree.path).await {
            eprintln!(
                "warning: could not prune stale workspace {}: {error:?}",
                worktree.path.display()
            );
        }
    }
    Ok(())
}

async fn remove_paired_worktrees(
    project: &ProjectRoot,
    source: &Path,
    target: &Path,
) -> Result<()> {
    if project.kind == RootKind::Enterprise || source.join("oss/package.json").is_file() {
        let oss_repo = if project.kind == RootKind::Enterprise {
            project.oss.clone()
        } else {
            source.join("oss")
        };
        let target_oss = target.join("oss");
        remove_worktree_if_present(&oss_repo, &target_oss)
            .await
            .wrap_err_with(|| format!("could not remove OSS worktree {}", target_oss.display()))?;
    }

    remove_worktree(source, target)
        .await
        .wrap_err_with(|| format!("could not remove worktree {}", target.display()))
}

async fn remove_worktree_if_present(repo: &Path, target: &Path) -> Result<()> {
    let registered = list_worktrees(repo)
        .await?
        .into_iter()
        .any(|worktree| same_path(&worktree.path, target));
    if !registered {
        return Ok(());
    }
    remove_worktree(repo, target).await
}

fn same_path(left: &Path, right: &Path) -> bool {
    left.canonicalize().unwrap_or_else(|_| left.to_path_buf())
        == right.canonicalize().unwrap_or_else(|_| right.to_path_buf())
}

pub fn workspace_id(branch: &str) -> String {
    let mut slug = branch_slug(branch).to_ascii_lowercase().replace('_', "-");
    slug.truncate(45);
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "workspace".into()
    } else {
        slug.to_string()
    }
}

pub fn workspace_hostname(branch: &str) -> String {
    format!("{}.localhost", workspace_id(branch))
}

async fn add_worktree(repo: &Path, target: &Path, branch: &str) -> Result<bool> {
    let exists = process::output(
        "git",
        &[
            "show-ref",
            "--verify",
            "--quiet",
            &format!("refs/heads/{branch}"),
        ],
        repo,
    )
    .await
    .is_ok();
    let mut args = vec!["worktree".into(), "add".into()];
    if !exists {
        args.extend(["-b".into(), branch.into()]);
    }
    args.push(target.to_string_lossy().into());
    if exists {
        args.push(branch.into());
    } else {
        args.push("HEAD".into());
    }
    process::run("git", &args, repo, &Default::default())
        .await
        .wrap_err_with(|| format!("could not create worktree from {}", repo.display()))?;
    Ok(!exists)
}

async fn remove_worktree(repo: &Path, target: &Path) -> Result<()> {
    // Broken/orphaned worktrees (missing checkout or `.git`) fail
    // `git worktree remove` validation; delete the leftover path and prune.
    if worktree_checkout_missing(target) {
        return force_remove_worktree(repo, target).await;
    }

    match process::run(
        "git",
        &[
            "worktree".into(),
            "remove".into(),
            "--force".into(),
            target.to_string_lossy().into(),
        ],
        repo,
        &Default::default(),
    )
    .await
    {
        Ok(()) => Ok(()),
        Err(_) if worktree_checkout_missing(target) => force_remove_worktree(repo, target).await,
        Err(error) => Err(error),
    }
}

async fn force_remove_worktree(repo: &Path, target: &Path) -> Result<()> {
    if target.exists() {
        fs::remove_dir_all(target)
            .into_diagnostic()
            .wrap_err_with(|| format!("could not delete {}", target.display()))?;
    }
    process::run(
        "git",
        &["worktree".into(), "prune".into()],
        repo,
        &Default::default(),
    )
    .await
    .wrap_err_with(|| format!("could not prune worktrees for {}", repo.display()))
}

async fn initialize_submodules(worktree: &Path) -> Result<()> {
    process::run(
        "git",
        &[
            "submodule".into(),
            "update".into(),
            "--init".into(),
            "--recursive".into(),
        ],
        worktree,
        &Default::default(),
    )
    .await
    .wrap_err_with(|| {
        format!(
            "could not initialize nested submodules in {}",
            worktree.display()
        )
    })
}

async fn delete_branch(repo: &Path, branch: &str) -> Result<()> {
    process::run(
        "git",
        &["branch".into(), "-D".into(), branch.into()],
        repo,
        &Default::default(),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use tempfile::tempdir;

    fn initialize_git(root: &Path) {
        let status = Command::new("git")
            .args(["init", "--quiet"])
            .current_dir(root)
            .status()
            .unwrap();
        assert!(status.success());
    }

    #[test]
    fn validates_and_maps_branch_paths() {
        assert!(validate_branch("feature/control-cli").is_ok());
        assert!(validate_branch("../escape").is_err());
        assert_eq!(branch_slug("feature/control-cli"), "feature-control-cli");
        assert_eq!(
            workspace_path(Path::new("/code/metorial"), "feature/cli"),
            Path::new("/code/metorial-feature-cli")
        );
        assert_eq!(workspace_id("Feature/CLI"), "feature-cli");
        assert_eq!(workspace_hostname("Feature/CLI"), "feature-cli.localhost");
    }

    #[test]
    fn parses_porcelain_worktree_list() {
        let worktrees = parse_worktree_list(
            "worktree /code/metorial\n\
             HEAD abc\n\
             branch refs/heads/dev\n\
             \n\
             worktree /code/metorial-feature-cli\n\
             HEAD def\n\
             branch refs/heads/feature/cli\n\
             \n\
             worktree /tmp/detached\n\
             HEAD ghi\n\
             detached\n\
             \n\
             worktree /code/metorial-broken\n\
             HEAD jkl\n\
             branch refs/heads/broken\n\
             prunable gitdir file points to non-existent location\n",
        );
        assert_eq!(
            worktrees,
            vec![
                GitWorktree {
                    path: PathBuf::from("/code/metorial"),
                    branch: Some("dev".into()),
                    prunable: false,
                },
                GitWorktree {
                    path: PathBuf::from("/code/metorial-feature-cli"),
                    branch: Some("feature/cli".into()),
                    prunable: false,
                },
                GitWorktree {
                    path: PathBuf::from("/tmp/detached"),
                    branch: None,
                    prunable: false,
                },
                GitWorktree {
                    path: PathBuf::from("/code/metorial-broken"),
                    branch: Some("broken".into()),
                    prunable: true,
                },
            ]
        );
    }

    #[test]
    fn detects_missing_worktree_checkouts() {
        let temp = tempdir().unwrap();
        let missing = temp.path().join("missing");
        assert!(worktree_checkout_missing(&missing));

        let incomplete = temp.path().join("incomplete");
        fs::create_dir_all(&incomplete).unwrap();
        assert!(worktree_checkout_missing(&incomplete));

        let intact = temp.path().join("intact");
        fs::create_dir_all(&intact).unwrap();
        fs::write(intact.join(".git"), "gitdir: /tmp/fake\n").unwrap();
        assert!(!worktree_checkout_missing(&intact));
    }

    #[test]
    fn old_metadata_defaults_to_docker_runtime() {
        let metadata: WorkspaceMetadata = serde_json::from_str(
            r#"{"id":"test","hostname":"test.localhost","branch":"test","source_root":"/code"}"#,
        )
        .unwrap();
        assert_eq!(metadata.runtime, WorkspaceRuntime::Docker);
        assert_eq!(metadata.service_ports, None);
    }

    #[test]
    fn host_port_allocation_skips_reserved_ports() {
        let reserved = BTreeSet::from([30000, 30001, 30002]);
        let ports = allocate_available_ports(&reserved).unwrap();
        for port in [
            ports.postgres,
            ports.mongo,
            ports.redis,
            ports.nats,
            ports.etcd_client,
            ports.etcd_peer,
        ] {
            assert!(!reserved.contains(&port));
            assert!((30000..60000).contains(&port));
        }
    }

    #[tokio::test]
    async fn host_workspace_remaps_generated_compose_and_database_ports() {
        let temp = tempdir().unwrap();
        fs::write(
            temp.path().join("package.json"),
            r#"{"name":"test","scripts":{"dev:start":"true","control:db:generate":"true","control:db:push":"true"}}"#,
        )
        .unwrap();
        fs::write(
            temp.path().join("control.toml"),
            "name='test'\n[endpoints.http]\nport=4310\n[[endpoints.http.env]]\nkey='PORT'\nvalue='{{PORT}}'\n[dev]\nrun=['dev:start']\n[dev.db.main]\nname='test'\nengine='postgres'\nenv='DATABASE_URL'\npackage='test'\n",
        )
        .unwrap();
        write_metadata(
            temp.path(),
            &WorkspaceMetadata {
                id: "test".into(),
                hostname: "test.localhost".into(),
                branch: "test".into(),
                source_root: temp.path().into(),
                runtime: WorkspaceRuntime::Host,
                service_ports: Some(ServicePorts {
                    postgres: 41001,
                    mongo: 41002,
                    redis: 41003,
                    nats: 41004,
                    etcd_client: 41005,
                    etcd_peer: 41006,
                }),
                endpoint_ports: BTreeMap::from([(
                    "test".into(),
                    BTreeMap::from([("http".into(), 42000)]),
                )]),
            },
        )
        .unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: temp.path().into(),
            oss: temp.path().into(),
        };
        let mut manifests = vec![crate::manifest::load(&temp.path().join("control.toml")).unwrap()];
        configure_manifests(&project, &mut manifests).await.unwrap();
        let manifest = &manifests[0].manifest;
        assert_eq!(manifest.postgres["DATABASE_URL"].port, 41001);
        assert_eq!(manifest.postgres["DATABASE_URL"].compose, None);
        assert!(manifest.docker.compose.is_empty());
        assert_eq!(manifest.endpoints["http"].port, 42000);
    }

    #[tokio::test]
    async fn upgrades_old_host_metadata_with_endpoint_ports() {
        let temp = tempdir().unwrap();
        initialize_git(temp.path());
        fs::create_dir_all(temp.path().join(".control")).unwrap();
        fs::write(temp.path().join("package.json"), "{}").unwrap();
        fs::write(
            temp.path().join("control.toml"),
            "name='api'\n[endpoints.http]\nport=4310\n[[endpoints.http.env]]\nkey='PORT'\nvalue='{{PORT}}'\n",
        )
        .unwrap();
        fs::write(
            temp.path().join(".control/workspace.json"),
            format!(
                r#"{{
                    "id": "old-host",
                    "hostname": "localhost",
                    "branch": "old-host",
                    "source_root": {},
                    "runtime": "host",
                    "service_ports": {{
                        "postgres": 41001,
                        "mongo": 41002,
                        "redis": 41003,
                        "nats": 41004,
                        "etcd_client": 41005,
                        "etcd_peer": 41006
                    }}
                }}"#,
                serde_json::to_string(temp.path()).unwrap()
            ),
        )
        .unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: temp.path().into(),
            oss: temp.path().into(),
        };
        let mut manifests = crate::manifest::discover(temp.path()).unwrap();

        configure_manifests(&project, &mut manifests).await.unwrap();

        let upgraded = read_metadata_file(temp.path()).unwrap().unwrap();
        let port = upgraded.endpoint_ports["api"]["http"];
        assert_eq!(manifests[0].manifest.endpoints["http"].port, port);
        assert!((30000..60000).contains(&port));
        assert_ne!(port, 4310);
        assert!(!temp.path().join(".control/.workspace.json.tmp").exists());
    }

    #[tokio::test]
    async fn preserves_allocations_when_lazily_adding_endpoints() {
        let temp = tempdir().unwrap();
        initialize_git(temp.path());
        fs::write(temp.path().join("package.json"), "{}").unwrap();
        fs::write(
            temp.path().join("control.toml"),
            "name='api'\n[endpoints.http]\nport=4310\n[endpoints.metrics]\nport=4311\n",
        )
        .unwrap();
        write_metadata(
            temp.path(),
            &WorkspaceMetadata {
                id: "host".into(),
                hostname: "localhost".into(),
                branch: "host".into(),
                source_root: temp.path().into(),
                runtime: WorkspaceRuntime::Host,
                service_ports: Some(ServicePorts {
                    postgres: 41001,
                    mongo: 41002,
                    redis: 41003,
                    nats: 41004,
                    etcd_client: 41005,
                    etcd_peer: 41006,
                }),
                endpoint_ports: BTreeMap::from([(
                    "api".into(),
                    BTreeMap::from([("http".into(), 42000)]),
                )]),
            },
        )
        .unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: temp.path().into(),
            oss: temp.path().into(),
        };
        let mut manifests = crate::manifest::discover(temp.path()).unwrap();

        configure_manifests(&project, &mut manifests).await.unwrap();

        let upgraded = read_metadata_file(temp.path()).unwrap().unwrap();
        assert_eq!(upgraded.endpoint_ports["api"]["http"], 42000);
        let metrics = upgraded.endpoint_ports["api"]["metrics"];
        assert_ne!(metrics, 42000);
        assert_eq!(manifests[0].manifest.endpoints["http"].port, 42000);
        assert_eq!(manifests[0].manifest.endpoints["metrics"].port, metrics);
    }

    #[tokio::test]
    async fn docker_metadata_does_not_allocate_endpoint_ports() {
        let temp = tempdir().unwrap();
        fs::write(temp.path().join("package.json"), "{}").unwrap();
        fs::write(
            temp.path().join("control.toml"),
            "name='api'\n[endpoints.http]\nport=4310\n",
        )
        .unwrap();
        write_metadata(
            temp.path(),
            &WorkspaceMetadata {
                id: "docker".into(),
                hostname: "docker.localhost".into(),
                branch: "docker".into(),
                source_root: temp.path().into(),
                runtime: WorkspaceRuntime::Docker,
                service_ports: None,
                endpoint_ports: BTreeMap::new(),
            },
        )
        .unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: temp.path().into(),
            oss: temp.path().into(),
        };
        let mut manifests = crate::manifest::discover(temp.path()).unwrap();

        configure_manifests(&project, &mut manifests).await.unwrap();

        assert_eq!(manifests[0].manifest.endpoints["http"].port, 4310);
        assert!(
            read_metadata_file(temp.path())
                .unwrap()
                .unwrap()
                .endpoint_ports
                .is_empty()
        );
    }
}
