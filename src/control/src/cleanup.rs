use std::{
    collections::BTreeSet,
    fs,
    path::{Component, Path, PathBuf},
};

use miette::{IntoDiagnostic, Result, WrapErr};

use crate::manifest::LoadedManifest;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CleanupItem {
    pub path: PathBuf,
    pub exists: bool,
}

pub fn plan(root: &Path, manifests: &[LoadedManifest]) -> Vec<CleanupItem> {
    let mut paths = BTreeSet::from([
        root.join(".control/.dev.tmp"),
        root.join(".control/dev"),
        root.join(".control/tmp"),
    ]);
    collect_legacy_artifacts(root, root, &mut paths);
    for loaded in manifests {
        let base = loaded.path.parent().unwrap_or(root);
        for path in &loaded.manifest.cleanup.paths {
            if let Some(safe) = safe_join(root, base, path) {
                paths.insert(safe);
            }
        }
    }
    paths
        .into_iter()
        .map(|path| CleanupItem {
            exists: path.exists(),
            path,
        })
        .collect()
}

fn collect_legacy_artifacts(root: &Path, directory: &Path, paths: &mut BTreeSet<PathBuf>) {
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() || file_type.is_symlink() {
            continue;
        }
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name == ".git" || (path == root.join("oss") && path.join(".git").is_dir()) {
            continue;
        }
        if matches!(
            name.as_ref(),
            "node_modules" | "dist" | ".next" | ".cache" | ".turbo" | "generated" | "out"
        ) {
            paths.insert(path);
            continue;
        }
        collect_legacy_artifacts(root, &path, paths);
    }
}

fn safe_join(root: &Path, base: &Path, path: &Path) -> Option<PathBuf> {
    if path.is_absolute() || path.components().any(|c| c == Component::ParentDir) {
        return None;
    }
    let joined = base.join(path);
    joined.starts_with(root).then_some(joined)
}

pub fn execute(items: &[CleanupItem], dry_run: bool) -> Result<usize> {
    let mut removed = 0;
    for item in items.iter().filter(|item| item.exists) {
        if dry_run {
            println!("would remove {}", item.path.display());
            continue;
        }
        if item.path.is_dir() {
            fs::remove_dir_all(&item.path)
        } else {
            fs::remove_file(&item.path)
        }
        .into_diagnostic()
        .wrap_err_with(|| format!("could not remove {}", item.path.display()))?;
        println!("removed {}", item.path.display());
        removed += 1;
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;
    use crate::manifest::load;

    #[test]
    fn cleanup_plan_is_deterministic_and_confined() {
        let temp = tempdir().unwrap();
        let manifest = temp.path().join("control.toml");
        fs::write(
            &manifest,
            "[cleanup]\npaths=['build', '../outside', '/absolute']",
        )
        .unwrap();
        fs::create_dir(temp.path().join("build")).unwrap();
        fs::create_dir_all(temp.path().join("package/node_modules/nested")).unwrap();
        let items = plan(temp.path(), &[load(&manifest).unwrap()]);
        assert!(items.iter().any(|item| item.path.ends_with("build")));
        assert!(
            items
                .iter()
                .any(|item| item.path.ends_with("package/node_modules"))
        );
        assert!(!items.iter().any(|item| item.path.ends_with("outside")));
        assert_eq!(items, {
            let mut sorted = items.clone();
            sorted.sort_by(|a, b| a.path.cmp(&b.path));
            sorted
        });
    }
}
