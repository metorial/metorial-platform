use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

use miette::{IntoDiagnostic, Result, WrapErr, bail};

use crate::{environment, process, root::ProjectRoot};

pub async fn run(project: &ProjectRoot, start: &Path, args: &[String]) -> Result<()> {
    let cwd = working_directory(start)?;
    let package = package_directory(project, &cwd)?;

    if args.is_empty() {
        return list_scripts(&package);
    }

    // Match `control env` exactly without printing its normal summary.
    environment::write_for_project(project, &[]).await?;
    let mut bun_args = vec!["run".into()];
    bun_args.extend_from_slice(args);
    process::run("bun", &bun_args, &cwd, &BTreeMap::new()).await
}

fn list_scripts(package: &Path) -> Result<()> {
    let scripts = package_scripts(package)?;
    if scripts.is_empty() {
        println!("no package scripts");
        return Ok(());
    }

    for name in scripts.keys() {
        println!("control run {name}");
    }
    Ok(())
}

fn package_scripts(package: &Path) -> Result<BTreeMap<String, String>> {
    let path = package.join("package.json");
    let text = fs::read_to_string(&path)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not read {}", path.display()))?;
    let value: serde_json::Value = serde_json::from_str(&text)
        .into_diagnostic()
        .wrap_err_with(|| format!("invalid {}", path.display()))?;
    let scripts = value
        .get("scripts")
        .and_then(serde_json::Value::as_object)
        .into_iter()
        .flat_map(|scripts| scripts.iter())
        .filter_map(|(name, command)| {
            command
                .as_str()
                .map(|command| (name.clone(), command.into()))
        })
        .collect();
    Ok(scripts)
}

fn working_directory(start: &Path) -> Result<PathBuf> {
    let canonical = start
        .canonicalize()
        .into_diagnostic()
        .map_err(|error| error.wrap_err(format!("could not resolve {}", start.display())))?;
    if canonical.is_file() {
        return canonical
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| miette::miette!("{} has no parent directory", canonical.display()));
    }
    Ok(canonical)
}

fn package_directory(project: &ProjectRoot, start: &Path) -> Result<PathBuf> {
    let project_root = canonical(&project.root);
    let oss_root = canonical(&project.oss);
    let start = canonical(start);

    for directory in start.ancestors() {
        if !directory.starts_with(&project_root) {
            break;
        }
        if directory.join("package.json").is_file() {
            if directory == project_root || directory == oss_root {
                break;
            }
            return Ok(directory.to_path_buf());
        }
    }

    bail!("control run must be run from a package; the project root does not count")
}

fn canonical(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;
    use crate::root::RootKind;

    fn project(root: &Path) -> ProjectRoot {
        ProjectRoot {
            kind: RootKind::Enterprise,
            root: root.into(),
            oss: root.join("oss"),
        }
    }

    #[test]
    fn finds_package_from_nested_directory() {
        let temp = tempdir().unwrap();
        let package = temp.path().join("src/api");
        let nested = package.join("src/controllers");
        fs::create_dir_all(&nested).unwrap();
        fs::write(package.join("package.json"), "{}").unwrap();

        assert_eq!(
            package_directory(&project(temp.path()), &nested).unwrap(),
            canonical(&package)
        );
    }

    #[test]
    fn rejects_enterprise_and_oss_project_roots() {
        let temp = tempdir().unwrap();
        fs::create_dir(temp.path().join("oss")).unwrap();
        fs::write(temp.path().join("package.json"), "{}").unwrap();
        fs::write(temp.path().join("oss/package.json"), "{}").unwrap();
        let project = project(temp.path());

        assert!(package_directory(&project, temp.path()).is_err());
        assert!(package_directory(&project, &temp.path().join("oss")).is_err());
    }

    #[test]
    fn rejects_directory_without_a_package() {
        let temp = tempdir().unwrap();
        let directory = temp.path().join("src/not-a-package");
        fs::create_dir_all(&directory).unwrap();

        assert!(package_directory(&project(temp.path()), &directory).is_err());
    }

    #[test]
    fn reads_package_scripts_without_bun_help_output() {
        let temp = tempdir().unwrap();
        fs::write(
            temp.path().join("package.json"),
            r#"{"scripts":{"test":"vitest run","build":"tsc"}}"#,
        )
        .unwrap();

        assert_eq!(
            package_scripts(temp.path()).unwrap(),
            BTreeMap::from([
                ("build".into(), "tsc".into()),
                ("test".into(), "vitest run".into()),
            ])
        );
    }
}
