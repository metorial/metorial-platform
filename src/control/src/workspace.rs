use std::{
    fs,
    path::{Path, PathBuf},
};

use miette::{IntoDiagnostic, Result, WrapErr, bail};
use serde::{Deserialize, Serialize};

use crate::{
    process,
    root::{self, ProjectRoot, RootKind},
    workspace_dev,
};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct WorkspaceMetadata {
    pub id: String,
    pub hostname: String,
    pub branch: String,
    pub source_root: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListedWorkspace {
    pub branch: String,
    pub path: PathBuf,
    pub id: Option<String>,
    pub hostname: Option<String>,
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

pub async fn create(project: &ProjectRoot, branch: &str, open_code: bool) -> Result<PathBuf> {
    validate_branch(branch)?;
    let target = workspace_path(&project.root, branch);
    if target.exists() {
        bail!("workspace path already exists: {}", target.display());
    }

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
                hostname: workspace_hostname(branch),
                branch: branch.into(),
                source_root: project.root.clone(),
            },
        )?;
        println!("created workspace {}", target.display());
        copy_env_json(&project.root, &target)?;
        let workspace_project = root::detect(&target)?;
        workspace_dev::initialize(&workspace_project, false).await
    }
    .await;
    if let Err(error) = initialization {
        if let Ok(workspace_project) = root::detect(&target) {
            let _ = workspace_dev::stop(&workspace_project, true).await;
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
        workspace_dev::open(&workspace_project)
            .await
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

    if let Ok(workspace_project) = root::detect(&worktree.path)
        && let Err(error) = workspace_dev::stop(&workspace_project, true).await
    {
        eprintln!("warning: could not remove workspace Docker resources: {error:?}");
    }

    if project.kind == RootKind::Enterprise || source.join("oss/package.json").is_file() {
        let oss_repo = if project.kind == RootKind::Enterprise {
            project.oss.clone()
        } else {
            source.join("oss")
        };
        let target_oss = worktree.path.join("oss");
        if target_oss.exists() {
            remove_worktree(&oss_repo, &target_oss)
                .await
                .wrap_err_with(|| {
                    format!("could not remove OSS worktree {}", target_oss.display())
                })?;
        }
    }

    remove_worktree(&source, &worktree.path)
        .await
        .wrap_err_with(|| format!("could not remove worktree {}", worktree.path.display()))?;
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
    fs::write(&path, contents)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not write {}", path.display()))
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

    for line in output.lines().chain(std::iter::once("")) {
        if line.is_empty() {
            if let Some(path) = path.take() {
                worktrees.push(GitWorktree {
                    path,
                    branch: branch.take(),
                });
            } else {
                branch = None;
            }
            continue;
        }
        if let Some(value) = line.strip_prefix("worktree ") {
            if let Some(path) = path.take() {
                worktrees.push(GitWorktree {
                    path,
                    branch: branch.take(),
                });
            }
            path = Some(PathBuf::from(value));
        } else if let Some(value) = line.strip_prefix("branch refs/heads/") {
            branch = Some(value.to_string());
        }
    }
    worktrees
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
    process::run(
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
             detached\n",
        );
        assert_eq!(
            worktrees,
            vec![
                GitWorktree {
                    path: PathBuf::from("/code/metorial"),
                    branch: Some("dev".into()),
                },
                GitWorktree {
                    path: PathBuf::from("/code/metorial-feature-cli"),
                    branch: Some("feature/cli".into()),
                },
                GitWorktree {
                    path: PathBuf::from("/tmp/detached"),
                    branch: None,
                },
            ]
        );
    }
}
