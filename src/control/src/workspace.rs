use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    process::Command,
};

use miette::{IntoDiagnostic, Result, WrapErr, bail};
use serde::{Deserialize, Serialize};

use crate::{
    process,
    root::{ProjectRoot, RootKind},
};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct WorkspaceMetadata {
    pub id: String,
    pub hostname: String,
    pub branch: String,
    pub source_root: PathBuf,
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

    write_metadata(
        &target,
        &WorkspaceMetadata {
            id: workspace_id(&target, branch),
            hostname: workspace_hostname(&target, branch),
            branch: branch.into(),
            source_root: project.root.clone(),
        },
    )?;
    println!("created workspace {}", target.display());
    if open_code {
        match Command::new("code").arg(&target).status() {
            Ok(status) if status.success() => {}
            Ok(status) => eprintln!("warning: code exited with {status}"),
            Err(error) => eprintln!("warning: could not launch code: {error}"),
        }
    }
    Ok(target)
}

pub async fn metadata(project: &ProjectRoot) -> Result<WorkspaceMetadata> {
    let path = metadata_path(&project.root);
    if path.is_file() {
        let contents = fs::read_to_string(&path)
            .into_diagnostic()
            .wrap_err_with(|| format!("could not read {}", path.display()))?;
        return serde_json::from_str(&contents)
            .into_diagnostic()
            .wrap_err_with(|| format!("invalid {}", path.display()));
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
    let source_root = common_git
        .as_deref()
        .filter(|path| path.file_name().and_then(|name| name.to_str()) == Some(".git"))
        .and_then(Path::parent)
        .filter(|path| path.join("package.json").is_file())
        .unwrap_or(&project.root)
        .to_path_buf();
    let metadata = WorkspaceMetadata {
        id: workspace_id(&project.root, &branch),
        hostname: workspace_hostname(&project.root, &branch),
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

pub fn workspace_id(root: &Path, branch: &str) -> String {
    let mut hasher = DefaultHasher::new();
    root.canonicalize()
        .unwrap_or_else(|_| root.to_path_buf())
        .hash(&mut hasher);
    let mut slug = branch_slug(branch).to_ascii_lowercase().replace('_', "-");
    slug.truncate(45);
    let slug = slug.trim_matches('-');
    let slug = if slug.is_empty() { "workspace" } else { slug };
    format!("{}-{:08x}", slug, hasher.finish() as u32)
}

pub fn workspace_hostname(root: &Path, branch: &str) -> String {
    format!("{}.localhost", workspace_id(root, branch))
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
        assert_eq!(
            workspace_id(Path::new("/code/metorial"), "Feature/CLI"),
            workspace_id(Path::new("/code/metorial"), "Feature/CLI")
        );
        assert!(
            workspace_hostname(Path::new("/code/metorial"), "Feature/CLI")
                .starts_with("feature-cli-")
        );
    }
}
