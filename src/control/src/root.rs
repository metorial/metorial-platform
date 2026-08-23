use std::{
    fs,
    path::{Path, PathBuf},
};

use miette::{Result, bail};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RootKind {
    Enterprise,
    Standalone,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectRoot {
    pub kind: RootKind,
    /// The checkout opened by the user.
    pub root: PathBuf,
    /// The OSS source tree (equal to root for standalone checkouts).
    pub oss: PathBuf,
}

pub fn detect(start: &Path) -> Result<ProjectRoot> {
    let canonical = start.canonicalize().unwrap_or_else(|_| start.to_path_buf());
    let start_dir = if canonical.is_file() {
        canonical.parent().unwrap_or(&canonical)
    } else {
        &canonical
    };

    // Enterprise wins even when invoked from inside its nested OSS checkout.
    for ancestor in start_dir.ancestors() {
        if is_enterprise(ancestor) {
            return Ok(ProjectRoot {
                kind: RootKind::Enterprise,
                root: ancestor.to_path_buf(),
                oss: ancestor.join("oss"),
            });
        }
    }
    for ancestor in start_dir.ancestors() {
        if is_standalone(ancestor) {
            return Ok(ProjectRoot {
                kind: RootKind::Standalone,
                root: ancestor.to_path_buf(),
                oss: ancestor.to_path_buf(),
            });
        }
    }
    bail!(
        "could not find a Metorial enterprise or standalone root above {}",
        start.display()
    )
}

fn is_enterprise(path: &Path) -> bool {
    (path.join(".git").is_dir() || path.join(".git").is_file())
        && package_name(&path.join("package.json")).as_deref() == Some("@metorial/enterprise")
        && package_name(&path.join("oss/package.json")).as_deref() == Some("@metorial/oss")
}

fn is_standalone(path: &Path) -> bool {
    (path.join(".git").exists() || path.join(".git").is_file())
        && package_name(&path.join("package.json")).as_deref() == Some("@metorial/oss")
        && path.join("src").is_dir()
}

fn package_name(path: &Path) -> Option<String> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str::<serde_json::Value>(&text)
        .ok()?
        .get("name")?
        .as_str()
        .map(String::from)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn enterprise_detection_wins_inside_oss() {
        let temp = tempdir().unwrap();
        fs::create_dir(temp.path().join(".git")).unwrap();
        fs::write(
            temp.path().join("package.json"),
            r#"{"name":"@metorial/enterprise"}"#,
        )
        .unwrap();
        fs::create_dir_all(temp.path().join("oss/src/deep")).unwrap();
        fs::write(
            temp.path().join("oss/package.json"),
            r#"{"name":"@metorial/oss"}"#,
        )
        .unwrap();
        assert_eq!(
            detect(&temp.path().join("oss/src/deep")).unwrap().kind,
            RootKind::Enterprise
        );
    }

    #[test]
    fn detects_standalone_worktree_git_file() {
        let temp = tempdir().unwrap();
        fs::write(temp.path().join(".git"), "gitdir: somewhere").unwrap();
        fs::write(
            temp.path().join("package.json"),
            r#"{"name":"@metorial/oss"}"#,
        )
        .unwrap();
        fs::create_dir(temp.path().join("src")).unwrap();
        assert_eq!(detect(temp.path()).unwrap().kind, RootKind::Standalone);
    }
}
