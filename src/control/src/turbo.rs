use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};

use miette::{IntoDiagnostic, Result, WrapErr, bail};
use serde::Serialize;

use crate::{environment, manifest::LoadedManifest};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TurboPackage {
    pub name: String,
    pub directory: PathBuf,
    pub cwd: PathBuf,
    pub command: String,
    pub environment: BTreeMap<String, String>,
    pub dependencies: Vec<String>,
}

#[derive(Serialize)]
struct RootPackage<'a> {
    name: &'a str,
    private: bool,
    #[serde(rename = "packageManager")]
    package_manager: &'a str,
    workspaces: [&'a str; 1],
}

#[derive(Serialize)]
struct MirrorPackage<'a> {
    name: &'a str,
    private: bool,
    scripts: BTreeMap<&'a str, &'a str>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    dependencies: BTreeMap<&'a str, &'static str>,
}

#[derive(Serialize)]
struct BunLock {
    #[serde(rename = "lockfileVersion")]
    lockfile_version: u8,
    workspaces: BTreeMap<String, BunLockWorkspace>,
    packages: BTreeMap<String, String>,
}

#[derive(Serialize)]
struct BunLockWorkspace {
    name: String,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    dependencies: BTreeMap<String, String>,
}

#[derive(Serialize)]
struct TurboConfig {
    #[serde(rename = "$schema")]
    schema: &'static str,
    tasks: BTreeMap<String, TurboTask>,
}

#[derive(Serialize)]
struct TurboTask {
    cache: bool,
    persistent: bool,
    #[serde(rename = "dependsOn", skip_serializing_if = "Vec::is_empty")]
    depends_on: Vec<String>,
}

pub fn plan(
    manifests: &[&LoadedManifest],
    source_root: &Path,
    root_environment: &BTreeMap<String, String>,
) -> Result<Vec<TurboPackage>> {
    let mut output = Vec::new();
    let mut names = BTreeSet::new();
    for loaded in manifests {
        let manifest_dir = loaded.path.parent().unwrap_or(source_root);
        let package_name = loaded
            .manifest
            .package
            .as_ref()
            .map(|p| p.name.as_str())
            .unwrap_or("root");
        for (run_name, run) in &loaded.manifest.run {
            let name = turbo_package_name(package_name, run_name);
            if !names.insert(name.clone()) {
                bail!("duplicate generated Turbo package name {name:?}");
            }
            let cwd = manifest_dir.join(run.cwd.as_deref().unwrap_or(Path::new(".")));
            let mut run_environment = environment::all_for_manifest(loaded, root_environment)?;
            run_environment.extend(environment::resolve(&run.env, root_environment)?);
            output.push(TurboPackage {
                directory: PathBuf::from("packages").join(&name),
                cwd,
                command: run.command.clone(),
                environment: run_environment,
                dependencies: run
                    .depends_on
                    .iter()
                    .map(|dependency| turbo_package_name(package_name, dependency))
                    .collect(),
                name,
            });
        }
    }
    output.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(output)
}

pub fn generate(workspace: &Path, packages: &[TurboPackage]) -> Result<()> {
    let parent = workspace
        .parent()
        .ok_or_else(|| miette::miette!("generated workspace has no parent"))?;
    fs::create_dir_all(parent).into_diagnostic()?;
    let staging = parent.join(".dev.tmp");
    if staging.exists() {
        fs::remove_dir_all(&staging)
            .into_diagnostic()
            .wrap_err("could not reset staged Turbo workspace")?;
    }
    fs::create_dir_all(staging.join("packages")).into_diagnostic()?;
    write_json(
        &staging.join("package.json"),
        &RootPackage {
            name: "@metorial/control-dev",
            private: true,
            package_manager: "bun@1.2.15",
            workspaces: ["packages/*"],
        },
    )?;
    let mut lock_workspaces = BTreeMap::from([(
        String::new(),
        BunLockWorkspace {
            name: "@metorial/control-dev".into(),
            dependencies: BTreeMap::new(),
        },
    )]);

    let task = TurboTask {
        cache: false,
        persistent: true,
        depends_on: Vec::new(),
    };
    write_json(
        &staging.join("turbo.json"),
        &TurboConfig {
            schema: "https://turbo.build/schema.json",
            tasks: BTreeMap::from([("dev".into(), task)]),
        },
    )?;
    for package in packages {
        let directory = staging.join(&package.directory);
        fs::create_dir_all(&directory).into_diagnostic()?;
        write_json(
            &directory.join("package.json"),
            &MirrorPackage {
                name: &package.name,
                private: true,
                scripts: BTreeMap::from([("dev", "bun --env-file=.env ./run.mjs")]),
                dependencies: package
                    .dependencies
                    .iter()
                    .map(|dependency| (dependency.as_str(), "*"))
                    .collect(),
            },
        )?;
        lock_workspaces.insert(
            package.directory.to_string_lossy().into_owned(),
            BunLockWorkspace {
                name: package.name.clone(),
                dependencies: package
                    .dependencies
                    .iter()
                    .map(|dependency| (dependency.clone(), "workspace:*".into()))
                    .collect(),
            },
        );
        write_environment(&directory.join(".env"), &package.environment)?;
        write_runner(&directory.join("run.mjs"), &package.cwd, &package.command)?;
    }
    write_json(
        &staging.join("bun.lock"),
        &BunLock {
            lockfile_version: 1,
            workspaces: lock_workspaces,
            packages: BTreeMap::new(),
        },
    )?;
    if workspace.exists() {
        fs::remove_dir_all(workspace)
            .into_diagnostic()
            .wrap_err("could not replace generated Turbo workspace")?;
    }
    fs::rename(&staging, workspace)
        .into_diagnostic()
        .wrap_err("could not install generated Turbo workspace")?;
    Ok(())
}

fn write_json(path: &Path, value: &impl Serialize) -> Result<()> {
    let mut text = serde_json::to_string_pretty(value).into_diagnostic()?;
    text.push('\n');
    fs::write(path, text)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not write {}", path.display()))
}

fn write_environment(path: &Path, values: &BTreeMap<String, String>) -> Result<()> {
    let mut text = values
        .iter()
        .map(|(key, value)| {
            format!(
                "{key}=\"{}\"",
                value
                    .replace('\\', "\\\\")
                    .replace('"', "\\\"")
                    .replace('\r', "\\r")
                    .replace('\n', "\\n")
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    text.push('\n');
    fs::write(path, text)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not write {}", path.display()))
}

fn write_runner(path: &Path, cwd: &Path, command: &str) -> Result<()> {
    let cwd = serde_json::to_string(&cwd.to_string_lossy()).into_diagnostic()?;
    let command = serde_json::to_string(command).into_diagnostic()?;
    let source = format!(
        r#"let cwd = {cwd};
let command = {command};
let cmd = process.platform === 'win32'
  ? ['cmd.exe', '/D', '/S', '/C', command]
  : ['/bin/sh', '-eu', '-c', command];
let child = Bun.spawn({{ cmd, cwd, env: process.env, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }});
process.exit(await child.exited);
"#
    );
    fs::write(path, source)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not write {}", path.display()))
}

fn sanitize(value: &str) -> String {
    value
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn turbo_package_name(package_name: &str, run_name: &str) -> String {
    let package_name = sanitize(package_name);
    let package_name = package_name
        .strip_prefix("metorial-")
        .unwrap_or(&package_name);
    sanitize(&format!("{package_name}-{run_name}"))
}

pub fn filters(packages: &[TurboPackage]) -> Vec<String> {
    let unique = packages
        .iter()
        .map(|p| p.name.clone())
        .collect::<BTreeSet<_>>();
    unique
        .into_iter()
        .flat_map(|name| ["--filter".into(), name])
        .collect()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;
    use crate::manifest::load;

    #[test]
    fn generated_turbo_has_one_mirror_per_run() {
        let temp = tempdir().unwrap();
        let manifest = temp.path().join("control.toml");
        fs::write(temp.path().join("package.json"), "{}").unwrap();
        fs::write(
            &manifest,
            "[package]\nname='API'\n[env]\nSECRET='sensitive'\n[run.server]\ncommand='bun dev'\n[run.worker]\ncommand='bun worker'",
        )
        .unwrap();
        let loaded = load(&manifest).unwrap();
        let packages = plan(&[&loaded], temp.path(), &BTreeMap::new()).unwrap();
        assert_eq!(packages.len(), 2);
        let workspace = temp.path().join(".control/dev");
        generate(&workspace, &packages).unwrap();
        assert!(workspace.join("bun.lock").is_file());
        assert!(workspace.join("packages/api-server/package.json").is_file());
        let root = fs::read_to_string(workspace.join("package.json")).unwrap();
        assert!(root.contains("\"packages/*\""));
        let mirror = workspace.join("packages/api-server");
        assert!(
            !fs::read_to_string(mirror.join("package.json"))
                .unwrap()
                .contains("sensitive")
        );
        assert!(
            fs::read_to_string(mirror.join(".env"))
                .unwrap()
                .contains("sensitive")
        );
    }
}
