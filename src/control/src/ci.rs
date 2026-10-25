use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
};

use miette::{IntoDiagnostic, Result, bail};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{
    e2e::{discover_packages, glob_match, normalize_path},
    manifest,
    root::ProjectRoot,
};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Ci {
    #[serde(default)]
    pub images: Vec<Image>,
    pub suite: Option<Suite>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Image {
    pub name: String,
    #[serde(default = "oss_group")]
    pub group: String,
    pub dockerfile: Option<String>,
    pub workspace: Option<String>,
    pub image: Option<String>,
    pub ecr: Option<String>,
    pub canonical: Option<String>,
    pub source: Option<String>,
    #[serde(default = "default_platform")]
    pub platform: String,
    #[serde(default)]
    pub staging_only: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Suite {
    pub name: String,
    #[serde(default = "control_runner")]
    pub runner: String,
    #[serde(default = "default_groups")]
    pub groups: usize,
    #[serde(default)]
    pub workspace_packages: Vec<String>,
    #[serde(default)]
    pub profiles: Vec<String>,
}

fn oss_group() -> String {
    "oss".into()
}
fn control_runner() -> String {
    "control".into()
}
fn default_groups() -> usize {
    2
}

fn default_platform() -> String {
    "linux/amd64".into()
}

fn relative(root: &Path, path: &Path) -> Result<String> {
    let normalized = normalize_path(path);
    let path = normalized.strip_prefix(root).into_diagnostic()?;
    Ok(if path.as_os_str().is_empty() {
        ".".into()
    } else {
        path.to_string_lossy().into_owned()
    })
}

pub fn inventory(project: &ProjectRoot) -> Result<Value> {
    let manifests = manifest::discover(&project.root)?;
    let packages = discover_packages(&project.root)?;
    let applicable = manifests
        .iter()
        .filter(|loaded| loaded.manifest.mode.applies_to(&project.kind))
        .collect::<Vec<_>>();
    let mut images = Vec::new();
    let mut names = BTreeSet::new();
    let mut destinations = BTreeSet::new();
    let mut owners = BTreeMap::<String, Vec<String>>::new();

    for loaded in &manifests {
        let base = loaded.path.parent().unwrap();
        let package = loaded
            .manifest
            .package
            .as_ref()
            .map(|p| p.name.clone())
            .unwrap_or_default();
        for image in &loaded.manifest.ci.images {
            if image.name.is_empty()
                || !image
                    .name
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
                || !names.insert(image.name.clone())
            {
                bail!("duplicate or invalid CI image identifier {:?}", image.name);
            }
            if !["enterprise", "oss", "horizon", "external"].contains(&image.group.as_str()) {
                bail!("invalid CI image group {:?}", image.group);
            }
            if image.platform != "linux/amd64" {
                bail!("unsupported backend image platform {:?}", image.platform);
            }
            if (image.group == "external") != image.source.is_some()
                || image
                    .source
                    .as_ref()
                    .is_some_and(|source| source.is_empty())
            {
                bail!(
                    "CI external images require a source and application images require a Dockerfile"
                );
            }
            let workspace = image.workspace.clone().unwrap_or_else(|| {
                if base.starts_with(&project.oss) && project.oss != project.root {
                    "oss".into()
                } else {
                    ".".into()
                }
            });
            let workspace_path = normalize_path(&project.root.join(&workspace));
            relative(&project.root, &workspace_path)?;
            if !workspace_path.is_dir() {
                bail!("missing CI workspace {}", workspace_path.display());
            }
            let dockerfile_path =
                normalize_path(&base.join(image.dockerfile.as_deref().unwrap_or("Dockerfile")));
            let dockerfile = if image.source.is_some() {
                String::new()
            } else {
                if !dockerfile_path.is_file() {
                    bail!("missing CI Dockerfile {}", dockerfile_path.display());
                }
                relative(&project.root, &dockerfile_path)?
            };
            if image.group == "external" && image.source.is_none() {
                bail!("external image requires source");
            }
            let repository = image
                .image
                .clone()
                .unwrap_or_else(|| format!("metorial/mte-{}", image.name));
            let ecr = image
                .ecr
                .clone()
                .unwrap_or_else(|| format!("metorial-enterprise-saas/mte-{}", image.name));
            if !destinations.insert(repository.clone()) {
                bail!("duplicate CI image destination {repository}");
            }
            owners
                .entry(package.clone())
                .or_default()
                .push(image.name.clone());
            images.push(json!({
                "name": image.name, "group": image.group, "package": package,
                "dockerfile": dockerfile, "workspace": if workspace == "." { ".".into() } else { format!("./{workspace}") },
                "image": repository, "ecr": ecr, "canonical": image.canonical.clone().unwrap_or_default(),
                "source": image.source, "platform": image.platform, "stagingOnly": image.staging_only,
                "tested": loaded.manifest.e2e.image.is_some(), "manifest": relative(&project.root, &loaded.path)?
            }));
        }
    }

    let mut suites = Vec::new();
    let mut suite_names = BTreeSet::new();
    let mut test_owners = BTreeSet::new();
    for loaded in &applicable {
        let package = loaded
            .manifest
            .package
            .as_ref()
            .map(|p| p.name.clone())
            .unwrap_or_default();
        let config = loaded.manifest.ci.suite.clone().or_else(|| {
            loaded.manifest.e2e.is_stack().then(|| Suite {
                name: package.trim_start_matches('@').replace('/', "-"),
                runner: control_runner(),
                groups: default_groups(),
                workspace_packages: vec![],
                profiles: vec![],
            })
        });
        let Some(config) = config else {
            continue;
        };
        if config.name.is_empty()
            || !config
                .name
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
            || !suite_names.insert(config.name.clone())
        {
            bail!("duplicate CI suite {}", config.name);
        }
        if !["control", "compose"].contains(&config.runner.as_str()) || config.groups == 0 {
            bail!("invalid CI test runner or group count");
        }
        let base = loaded.path.parent().unwrap();
        let mut roots = vec![*loaded];
        for name in &loaded.manifest.e2e.services {
            roots.push(
                applicable
                    .iter()
                    .find(|candidate| {
                        candidate
                            .manifest
                            .package
                            .as_ref()
                            .is_some_and(|p| &p.name == name)
                    })
                    .copied()
                    .ok_or_else(|| miette::miette!("unknown E2E service {name}"))?,
            );
        }
        let closure = manifest::dependency_closure(&manifests, &roots, &project.kind)?;
        let services = roots
            .into_iter()
            .chain(closure)
            .filter_map(|l| l.manifest.package.as_ref().map(|p| p.name.clone()))
            .collect::<BTreeSet<_>>();
        let mut required_images = BTreeSet::new();
        let mut manifest_paths = BTreeSet::new();
        for service in &services {
            if let Some(owned) = owners.get(service) {
                required_images.extend(owned.iter().cloned());
            }
            let dependency = applicable
                .iter()
                .find(|l| {
                    l.manifest
                        .package
                        .as_ref()
                        .is_some_and(|p| &p.name == service)
                })
                .unwrap();
            manifest_paths.insert(relative(&project.root, &dependency.path)?);
            if project.kind == crate::root::RootKind::Enterprise
                && config.runner == "control"
                && dependency.manifest.e2e.image.is_none()
            {
                bail!("runtime E2E service {service} has no test image mapping");
            }
            if let Some(name) = &dependency.manifest.e2e.image {
                if (owners.contains_key(service)
                    || project.kind == crate::root::RootKind::Enterprise)
                    && !owners
                        .get(service)
                        .is_some_and(|images| images.contains(name))
                {
                    bail!("E2E image {name:?} for {service} has no matching CI image metadata");
                }
            }
        }
        let tests = if config.runner == "compose" {
            vec![json!({"name": package, "directory": relative(&project.root, base)?})]
        } else {
            let mut tests = Vec::new();
            for pattern in &loaded.manifest.e2e.tests {
                let pattern = normalize_path(&base.join(pattern));
                let matched = packages
                    .iter()
                    .filter(|p| glob_match(&pattern, &p.directory))
                    .collect::<Vec<_>>();
                if matched.is_empty() {
                    bail!("E2E glob matches no packages: {}", pattern.display());
                }
                for test in matched
                    .into_iter()
                    .filter(|p| p.scripts.contains("test:e2e"))
                {
                    if !test_owners.insert(test.name.clone()) {
                        bail!("duplicate CI test owner {}", test.name);
                    }
                    tests.push(json!({"name": test.name, "directory": relative(&project.root, &test.directory)?}));
                }
            }
            tests
        };
        if tests.is_empty() {
            bail!("CI suite {} has no tests", config.name);
        }
        for extra in &config.workspace_packages {
            if !packages.iter().any(|p| &p.name == extra) {
                bail!("unknown test workspace dependency {extra}");
            }
        }
        suites.push(json!({
            "name": config.name, "package": package, "runner": config.runner, "groups": config.groups,
            "workspacePackages": config.workspace_packages, "profiles": config.profiles,
            "directory": relative(&project.root, base)?, "workspace": if config.runner == "compose" && project.oss != project.root { "./oss" } else { "." },
            "services": services, "images": required_images, "manifests": manifest_paths, "tests": tests
        }));
    }
    images.sort_by_key(|image| image["name"].as_str().unwrap().to_owned());
    suites.sort_by_key(|suite| suite["name"].as_str().unwrap().to_owned());
    Ok(
        json!({"version": 1, "images": images, "suites": suites, "infrastructure": crate::e2e::infrastructure_images()}),
    )
}

pub fn describe(project: &ProjectRoot) -> Result<()> {
    println!(
        "{}",
        serde_json::to_string_pretty(&inventory(project)?).into_diagnostic()?
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::root::RootKind;
    use std::fs;
    use tempfile::tempdir;

    fn package(root: &Path, name: &str, manifest: &str) {
        let directory = root.join(name);
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join("package.json"),
            format!(r#"{{"name":"@test/{name}","scripts":{{"test:e2e":"vitest"}}}}"#),
        )
        .unwrap();
        fs::write(directory.join("Dockerfile"), "FROM scratch\n").unwrap();
        fs::write(
            directory.join("control.toml"),
            format!("name = \"@test/{name}\"\n{manifest}"),
        )
        .unwrap();
    }

    #[test]
    fn discovers_new_services_and_transitive_owned_images_without_exporting_env() {
        let root = tempdir().unwrap();
        package(
            root.path(),
            "dependency",
            "[[ci.images]]\nname = \"dependency\"\n[[ci.images]]\nname = \"go-observer\"\n[dev.env]\nSECRET = \"must-never-be-exported\"\n",
        );
        package(
            root.path(),
            "service",
            "dependencies = [\"@test/dependency\"]\n[[ci.images]]\nname = \"service\"\n[e2e]\nimage = \"service\"\n[ci.suite]\nname = \"service\"\nrunner = \"compose\"\n",
        );
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: root.path().into(),
            oss: root.path().into(),
        };
        let graph = inventory(&project).unwrap();
        assert_eq!(graph["images"].as_array().unwrap().len(), 3);
        assert_eq!(
            graph["suites"][0]["images"],
            json!(["dependency", "go-observer", "service"])
        );
        assert_eq!(
            graph["suites"][0]["services"],
            json!(["@test/dependency", "@test/service"])
        );
        assert!(!graph.to_string().contains("must-never-be-exported"));
    }

    #[test]
    fn rejects_duplicate_images_and_missing_dockerfiles() {
        let root = tempdir().unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: root.path().into(),
            oss: root.path().into(),
        };
        package(root.path(), "a", "[[ci.images]]\nname = \"same\"\n");
        package(root.path(), "b", "[[ci.images]]\nname = \"same\"\n");
        assert!(
            inventory(&project)
                .unwrap_err()
                .to_string()
                .contains("duplicate")
        );
        fs::remove_dir_all(root.path().join("b")).unwrap();
        fs::remove_file(root.path().join("a/Dockerfile")).unwrap();
        assert!(
            inventory(&project)
                .unwrap_err()
                .to_string()
                .contains("missing CI Dockerfile")
        );
    }

    #[test]
    fn rejects_mismatched_test_image_and_escaping_paths() {
        let root = tempdir().unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: root.path().into(),
            oss: root.path().into(),
        };
        package(
            root.path(),
            "a",
            "[[ci.images]]\nname = \"a\"\n[e2e]\nimage = \"wrong\"\n[ci.suite]\nname = \"a\"\nrunner = \"compose\"\n",
        );
        assert!(
            inventory(&project)
                .unwrap_err()
                .to_string()
                .contains("no matching CI image")
        );
        package(
            root.path(),
            "a",
            "[[ci.images]]\nname = \"a\"\nworkspace = \"../outside\"\n",
        );
        assert!(inventory(&project).is_err());
    }
}
