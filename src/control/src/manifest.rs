use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};

use miette::{IntoDiagnostic, Result, WrapErr, bail};
use serde::Deserialize;

use crate::root::RootKind;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Manifest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub mode: Mode,
    #[serde(default)]
    pub dependencies: Vec<Dependency>,
    #[serde(default)]
    pub endpoints: BTreeMap<String, Endpoint>,
    #[serde(default)]
    pub resources: Vec<Resource>,
    #[serde(default)]
    pub test: Tests,
    #[serde(default)]
    pub dev: Dev,
    #[serde(default)]
    pub package: Option<Package>,
    #[serde(default)]
    pub groups: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    pub env: BTreeMap<String, EnvValue>,
    #[serde(default)]
    pub expose: Vec<Exposure>,
    #[serde(default)]
    pub postgres: BTreeMap<String, Postgres>,
    #[serde(default)]
    pub mongo: BTreeMap<String, Mongo>,
    #[serde(default)]
    pub run: BTreeMap<String, Run>,
    #[serde(default)]
    pub prepare: Vec<String>,
    #[serde(default)]
    pub docker: Docker,
    #[serde(default)]
    pub cleanup: Cleanup,
    #[serde(skip)]
    pub dependency_endpoints: BTreeMap<String, BTreeMap<String, ResolvedEndpoint>>,
    #[serde(skip)]
    pub package_script_references: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum Dependency {
    /// Transitional support while repository manifests are migrated.
    Identifier(String),
    Detailed(DependencySpec),
}

impl Dependency {
    pub fn identifier(&self) -> &str {
        match self {
            Self::Identifier(identifier) => identifier,
            Self::Detailed(dependency) => &dependency.identifier,
        }
    }

    pub fn env(&self) -> &[DependencyEnv] {
        match self {
            Self::Identifier(_) => &[],
            Self::Detailed(dependency) => &dependency.env,
        }
    }

    pub fn starts(&self) -> bool {
        match self {
            Self::Identifier(_) => true,
            Self::Detailed(dependency) => dependency.start,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DependencySpec {
    pub identifier: String,
    #[serde(default = "default_true")]
    pub start: bool,
    #[serde(default)]
    pub env: Vec<DependencyEnv>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DependencyEnv {
    pub endpoint: String,
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Endpoint {
    pub port: u16,
    #[serde(default)]
    pub env: Vec<EndpointEnv>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EndpointEnv {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Resource {
    #[serde(rename = "type")]
    pub resource_type: ResourceType,
    #[serde(default)]
    pub env: Vec<ResourceEnv>,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum ResourceType {
    Redis,
    Nats,
    Etcd,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResourceEnv {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedEndpoint {
    pub hostname: String,
    pub port: u16,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExternalManifest {
    #[serde(default)]
    pub external: Vec<External>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct External {
    pub identifier: String,
    pub hostname: String,
    #[serde(default)]
    pub mapping: BTreeMap<String, u16>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    #[default]
    Both,
    Oss,
    Enterprise,
}

impl Mode {
    pub fn applies_to(&self, kind: &RootKind) -> bool {
        matches!(
            (self, kind),
            (Self::Both, _)
                | (Self::Oss, RootKind::Standalone)
                | (Self::Enterprise, RootKind::Enterprise)
        )
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Tests {
    #[serde(default)]
    pub e2e: Option<E2eTest>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct E2eTest {
    #[serde(default)]
    pub packages: Vec<String>,
    /// Single-shot service commands used instead of development watchers.
    #[serde(default)]
    pub start: Vec<String>,
    /// Overrides package-local development prepare scripts for E2E.
    /// `None` inherits development preparation; `Some([])` disables it.
    #[serde(default)]
    pub prepare: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Package {
    pub name: String,
    #[serde(default)]
    pub groups: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum EnvValue {
    Literal(String),
    Lookup(bool),
    Detailed(EnvSpec),
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EnvSpec {
    #[serde(default)]
    pub value: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub default: Option<String>,
    #[serde(default)]
    pub required: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Postgres {
    pub package: String,
    #[serde(default = "default_localhost")]
    pub host: String,
    #[serde(default = "default_postgres_port")]
    pub port: u16,
    #[serde(default = "default_postgres")]
    pub user: String,
    #[serde(default = "default_postgres")]
    pub password: String,
    pub database: String,
    #[serde(default)]
    pub service: Option<String>,
    #[serde(default)]
    pub compose: Option<PathBuf>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Mongo {
    pub package: String,
    #[serde(default = "default_localhost")]
    pub host: String,
    #[serde(default = "default_mongo_port")]
    pub port: u16,
    #[serde(default)]
    pub user: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    pub database: String,
    #[serde(default)]
    pub service: Option<String>,
    #[serde(default)]
    pub compose: Option<PathBuf>,
    #[serde(default)]
    pub auth_source: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Run {
    pub command: String,
    #[serde(default)]
    pub cwd: Option<PathBuf>,
    #[serde(default)]
    pub env: BTreeMap<String, EnvValue>,
    #[serde(default)]
    pub depends_on: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Exposure {
    pub port: u16,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Docker {
    #[serde(default)]
    pub compose: Vec<PathBuf>,
    #[serde(default)]
    pub services: Vec<String>,
    #[serde(default)]
    pub stop: bool,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Cleanup {
    #[serde(default)]
    pub paths: Vec<PathBuf>,
    #[serde(default)]
    pub commands: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Dev {
    #[serde(default)]
    pub prepare: Vec<String>,
    #[serde(default)]
    pub run: Vec<String>,
    #[serde(default)]
    pub cleanup: Vec<String>,
    #[serde(default)]
    pub env: BTreeMap<String, EnvValue>,
    #[serde(default)]
    pub expose: Vec<Exposure>,
    #[serde(default)]
    pub db: BTreeMap<String, Database>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Database {
    pub name: String,
    pub engine: DatabaseEngine,
    pub env: String,
    pub package: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseEngine {
    Postgres,
    #[serde(alias = "mongo")]
    Mongodb,
}

#[derive(Debug, Clone)]
pub struct LoadedManifest {
    pub path: PathBuf,
    pub manifest: Manifest,
}

fn default_localhost() -> String {
    "127.0.0.1".into()
}
fn default_postgres_port() -> u16 {
    5432
}
fn default_mongo_port() -> u16 {
    27017
}
fn default_postgres() -> String {
    "postgres".into()
}

pub fn discover(root: &Path) -> Result<Vec<LoadedManifest>> {
    let mut paths = walkdir::WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            !matches!(
                e.file_name().to_str(),
                Some(".git" | "node_modules" | ".control" | "target")
            )
        })
        .filter_map(std::result::Result::ok)
        .filter(|e| e.file_type().is_file() && e.file_name() == "control.toml")
        .map(|e| e.into_path())
        .collect::<Vec<_>>();
    paths.sort();
    let mut manifests = paths
        .into_iter()
        .map(|path| load(&path))
        .collect::<Result<Vec<_>>>()?;
    let mut names = BTreeMap::<String, &Path>::new();
    for loaded in &manifests {
        if let Some(package) = &loaded.manifest.package
            && let Some(previous) = names.insert(package.name.clone(), &loaded.path)
        {
            bail!(
                "duplicate control package name {:?}: {} and {}",
                package.name,
                previous.display(),
                loaded.path.display()
            );
        }
    }
    validate_database_packages(root, &manifests)?;
    validate_package_graph(&manifests)?;
    refresh_dependency_endpoints(&mut manifests);
    validate_dependency_endpoints(&manifests)?;
    Ok(manifests)
}

fn validate_database_packages(root: &Path, manifests: &[LoadedManifest]) -> Result<()> {
    let mut packages = BTreeMap::<String, Vec<BTreeSet<String>>>::new();
    for entry in walkdir::WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            !matches!(
                entry.file_name().to_str(),
                Some(".git" | "node_modules" | ".control" | "target")
            )
        })
        .filter_map(std::result::Result::ok)
        .filter(|entry| entry.file_type().is_file() && entry.file_name() == "package.json")
    {
        let text = fs::read_to_string(entry.path())
            .into_diagnostic()
            .wrap_err_with(|| format!("could not read {}", entry.path().display()))?;
        let value: serde_json::Value = serde_json::from_str(&text)
            .into_diagnostic()
            .wrap_err_with(|| format!("invalid {}", entry.path().display()))?;
        let Some(name) = value.get("name").and_then(serde_json::Value::as_str) else {
            continue;
        };
        let scripts = value
            .get("scripts")
            .and_then(serde_json::Value::as_object)
            .into_iter()
            .flat_map(|scripts| scripts.iter())
            .filter_map(|(name, command)| command.as_str().map(|_| name.clone()))
            .collect();
        packages.entry(name.into()).or_default().push(scripts);
    }

    for loaded in manifests {
        for package in loaded
            .manifest
            .postgres
            .values()
            .map(|database| database.package.as_str())
            .chain(
                loaded
                    .manifest
                    .mongo
                    .values()
                    .map(|database| database.package.as_str()),
            )
        {
            let Some(candidates) = packages.get(package) else {
                bail!(
                    "{}: database references unknown npm package {package:?}",
                    loaded.path.display()
                );
            };
            for script in ["control:db:generate", "control:db:push"] {
                if !candidates.iter().any(|scripts| scripts.contains(script)) {
                    bail!(
                        "{}: database package {package:?} does not declare required script {script:?}",
                        loaded.path.display()
                    );
                }
            }
        }
    }
    Ok(())
}

fn validate_package_graph(manifests: &[LoadedManifest]) -> Result<()> {
    let packages = manifests
        .iter()
        .filter_map(|loaded| {
            loaded
                .manifest
                .package
                .as_ref()
                .map(|package| (package.name.as_str(), loaded))
        })
        .collect::<BTreeMap<_, _>>();

    for loaded in manifests {
        let Some(package) = &loaded.manifest.package else {
            if !loaded.manifest.dependencies.is_empty() {
                bail!(
                    "{}: dependencies require a named package",
                    loaded.path.display()
                );
            }
            continue;
        };
        for dependency in &loaded.manifest.dependencies {
            let target = dependency.identifier();
            if target == package.name {
                bail!(
                    "{}: package {:?} cannot reference itself as a dependency",
                    loaded.path.display(),
                    package.name
                );
            }
            let Some(target_manifest) = packages.get(target) else {
                bail!(
                    "{}: package {:?} references unknown dependency {:?}",
                    loaded.path.display(),
                    package.name,
                    target
                );
            };
            for kind in [RootKind::Standalone, RootKind::Enterprise] {
                if loaded.manifest.mode.applies_to(&kind)
                    && !target_manifest.manifest.mode.applies_to(&kind)
                {
                    bail!(
                        "{}: package {:?} ({:?}) references dependency {:?} with incompatible mode {:?}",
                        loaded.path.display(),
                        package.name,
                        loaded.manifest.mode,
                        target,
                        target_manifest.manifest.mode
                    );
                }
            }
        }
    }

    let mut visiting = BTreeSet::new();
    let mut visited = BTreeSet::new();
    for package in packages.keys() {
        validate_dependency_cycles(
            package,
            &packages,
            &mut visiting,
            &mut visited,
            &mut Vec::new(),
        )?;
    }
    Ok(())
}

fn validate_dependency_cycles<'a>(
    package: &'a str,
    packages: &BTreeMap<&'a str, &'a LoadedManifest>,
    visiting: &mut BTreeSet<&'a str>,
    visited: &mut BTreeSet<&'a str>,
    path: &mut Vec<&'a str>,
) -> Result<()> {
    if visited.contains(package) {
        return Ok(());
    }
    if !visiting.insert(package) {
        let start = path.iter().position(|item| *item == package).unwrap_or(0);
        let mut cycle = path[start..].to_vec();
        cycle.push(package);
        bail!("control package dependency cycle: {}", cycle.join(" -> "));
    }
    path.push(package);
    if let Some(loaded) = packages.get(package) {
        for dependency in loaded
            .manifest
            .dependencies
            .iter()
            .filter(|dependency| dependency.starts())
        {
            validate_dependency_cycles(dependency.identifier(), packages, visiting, visited, path)?;
        }
    }
    path.pop();
    visiting.remove(package);
    visited.insert(package);
    Ok(())
}

/// Return transitive dependencies in dependency-first order, excluding roots.
///
/// This is intentionally independent of the E2E runner so other commands can
/// reuse the same validated package graph.
pub fn dependency_closure<'a>(
    manifests: &'a [LoadedManifest],
    roots: &[&'a LoadedManifest],
    kind: &RootKind,
) -> Result<Vec<&'a LoadedManifest>> {
    dependency_closure_excluding(manifests, roots, kind, &BTreeSet::new())
}

fn dependency_closure_excluding<'a>(
    manifests: &'a [LoadedManifest],
    roots: &[&'a LoadedManifest],
    kind: &RootKind,
    excluded: &BTreeSet<String>,
) -> Result<Vec<&'a LoadedManifest>> {
    let packages = manifests
        .iter()
        .filter(|loaded| loaded.manifest.mode.applies_to(kind))
        .filter_map(|loaded| {
            loaded
                .manifest
                .package
                .as_ref()
                .map(|package| (package.name.as_str(), loaded))
        })
        .collect::<BTreeMap<_, _>>();
    let root_names = roots
        .iter()
        .filter_map(|loaded| {
            loaded
                .manifest
                .package
                .as_ref()
                .map(|package| package.name.as_str())
        })
        .collect::<BTreeSet<_>>();
    let mut visited = root_names.clone();
    let mut ordered = Vec::new();
    for root in roots {
        for dependency in root
            .manifest
            .dependencies
            .iter()
            .filter(|dependency| dependency.starts())
        {
            collect_dependency(
                dependency.identifier(),
                &packages,
                &mut visited,
                &mut ordered,
                excluded,
            )?;
        }
    }
    Ok(ordered)
}

/// Select manifests and expand named package dependencies.
///
/// Root marker manifests are retained first. Dependencies are emitted in
/// dependency-first order, followed by directly selected packages in their
/// deterministic discovery order.
pub fn select_with_dependencies_excluding<'a>(
    manifests: &'a [LoadedManifest],
    selectors: &[String],
    kind: &RootKind,
    excluded: &BTreeSet<String>,
) -> Result<Vec<&'a LoadedManifest>> {
    let selected = select(manifests, selectors, kind)?;
    if selectors.is_empty() {
        return Ok(selected
            .into_iter()
            .filter(|loaded| {
                loaded
                    .manifest
                    .package
                    .as_ref()
                    .is_none_or(|package| !excluded.contains(&package.name))
            })
            .collect());
    }
    let roots = selected
        .iter()
        .copied()
        .filter(|loaded| loaded.manifest.package.is_none())
        .collect::<Vec<_>>();
    let direct = selected
        .iter()
        .copied()
        .filter(|loaded| {
            loaded
                .manifest
                .package
                .as_ref()
                .is_some_and(|package| !excluded.contains(&package.name))
        })
        .collect::<Vec<_>>();
    let dependencies = dependency_closure_excluding(manifests, &direct, kind, excluded)?;
    let mut output = roots;
    let mut names = BTreeSet::new();
    for loaded in dependencies.into_iter().chain(direct) {
        let name = loaded
            .manifest
            .package
            .as_ref()
            .expect("expanded manifests are named")
            .name
            .as_str();
        if names.insert(name) {
            output.push(loaded);
        }
    }
    Ok(output)
}

fn collect_dependency<'a>(
    package: &str,
    packages: &BTreeMap<&str, &'a LoadedManifest>,
    visited: &mut BTreeSet<&'a str>,
    ordered: &mut Vec<&'a LoadedManifest>,
    excluded: &BTreeSet<String>,
) -> Result<()> {
    if excluded.contains(package) {
        return Ok(());
    }
    let loaded = packages
        .get(package)
        .copied()
        .ok_or_else(|| miette::miette!("unknown control package dependency {package:?}"))?;
    let name = loaded
        .manifest
        .package
        .as_ref()
        .expect("package graph only contains named manifests")
        .name
        .as_str();
    if !visited.insert(name) {
        return Ok(());
    }
    for dependency in loaded
        .manifest
        .dependencies
        .iter()
        .filter(|dependency| dependency.starts())
    {
        collect_dependency(
            dependency.identifier(),
            packages,
            visited,
            ordered,
            excluded,
        )?;
    }
    ordered.push(loaded);
    Ok(())
}

pub fn load(path: &Path) -> Result<LoadedManifest> {
    let text = fs::read_to_string(path)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not read {}", path.display()))?;
    let mut manifest: Manifest = toml::from_str(&text)
        .into_diagnostic()
        .wrap_err_with(|| format!("invalid {}", path.display()))?;
    normalize(&mut manifest, path)?;
    validate(&manifest, path)?;
    Ok(LoadedManifest {
        path: path.to_path_buf(),
        manifest,
    })
}

fn normalize(manifest: &mut Manifest, path: &Path) -> Result<()> {
    if let Some(name) = manifest.name.clone() {
        if manifest.package.is_some() {
            bail!(
                "{}: use either top-level name/group/dev or package/run, not both",
                path.display()
            );
        }
        manifest.package = Some(Package {
            name,
            groups: manifest.group.clone().into_iter().collect(),
        });
        manifest.env.append(&mut manifest.dev.env);
        manifest.expose.append(&mut manifest.dev.expose);
        manifest.prepare.append(&mut manifest.dev.prepare);
        manifest.cleanup.commands.append(&mut manifest.dev.cleanup);
        for (index, script) in std::mem::take(&mut manifest.dev.run)
            .into_iter()
            .enumerate()
        {
            manifest.package_script_references.push(script.clone());
            // Primary script is "dev" so mirrors are named `api`, not `api-run-1`.
            let key = if index == 0 {
                "dev".into()
            } else {
                format!("{}", index + 1)
            };
            manifest.run.insert(
                key,
                Run {
                    command: package_script_command(&script),
                    cwd: None,
                    env: BTreeMap::new(),
                    depends_on: Vec::new(),
                },
            );
        }
        for (_, database) in std::mem::take(&mut manifest.dev.db) {
            match database.engine {
                DatabaseEngine::Postgres => {
                    manifest.postgres.insert(
                        database.env,
                        Postgres {
                            package: database.package,
                            host: default_localhost(),
                            port: 35432,
                            user: default_postgres(),
                            password: default_postgres(),
                            database: database.name,
                            service: Some("postgres-db2".into()),
                            compose: None,
                        },
                    );
                }
                DatabaseEngine::Mongodb => {
                    manifest.mongo.insert(
                        database.env,
                        Mongo {
                            package: database.package,
                            host: default_localhost(),
                            port: 32707,
                            user: Some("mongo".into()),
                            password: Some("mongo".into()),
                            database: database.name,
                            service: Some("mongodb".into()),
                            compose: None,
                            auth_source: Some("admin".into()),
                        },
                    );
                }
            }
        }
    }
    for (index, exposure) in manifest.expose.iter().enumerate() {
        if !manifest
            .endpoints
            .values()
            .any(|endpoint| endpoint.port == exposure.port)
        {
            let name = if index == 0 {
                "http".into()
            } else {
                format!("http-{}", index + 1)
            };
            manifest.endpoints.insert(
                name,
                Endpoint {
                    port: exposure.port,
                    env: Vec::new(),
                },
            );
        }
    }
    Ok(())
}

fn validate(manifest: &Manifest, path: &Path) -> Result<()> {
    if let Some(package) = &manifest.package {
        if package.name.trim().is_empty() {
            bail!("{}: package.name cannot be empty", path.display());
        }
        let package_json = path.parent().unwrap_or(Path::new(".")).join("package.json");
        if !package_json.is_file() {
            bail!(
                "{}: control.toml must be colocated with package.json",
                path.display()
            );
        }
        validate_package_scripts(
            &package_json,
            manifest
                .package_script_references
                .iter()
                .chain(manifest.test.e2e.iter().flat_map(|e2e| e2e.start.iter())),
            path,
        )?;
    } else if !manifest.endpoints.is_empty() {
        bail!("{}: endpoints require a named package", path.display());
    }
    let names = manifest.run.keys().cloned().collect::<BTreeSet<_>>();
    for (name, run) in &manifest.run {
        if name.trim().is_empty() || run.command.trim().is_empty() {
            bail!("{}: run names and commands cannot be empty", path.display());
        }
        for dependency in &run.depends_on {
            if !names.contains(dependency) {
                bail!(
                    "{}: run {name:?} depends on unknown local run {dependency:?}",
                    path.display()
                );
            }
        }
    }
    let mut shared_env_keys = BTreeMap::new();
    for (key, value) in &manifest.env {
        validate_env(key, value, path)?;
        register_env_key(&mut shared_env_keys, key, "[env]/[dev.env]", path)?;
    }
    let mut endpoint_ports = BTreeSet::new();
    for (name, endpoint) in &manifest.endpoints {
        validate_name("endpoint", name, path)?;
        if endpoint.port == 0 {
            bail!("{}: endpoint {name:?} port cannot be zero", path.display());
        }
        if !endpoint_ports.insert(endpoint.port) {
            bail!(
                "{}: duplicate endpoint port {}",
                path.display(),
                endpoint.port
            );
        }
        for env in &endpoint.env {
            validate_structured_env(&env.key, &env.value, &["HOSTNAME", "PORT"], path)?;
            register_env_key(
                &mut shared_env_keys,
                &env.key,
                &format!("endpoint {name:?}"),
                path,
            )?;
        }
    }
    let mut resource_types = BTreeSet::new();
    for resource in &manifest.resources {
        if !resource_types.insert(resource.resource_type) {
            bail!(
                "{}: duplicate {:?} resource declaration",
                path.display(),
                resource.resource_type
            );
        }
        for env in &resource.env {
            validate_structured_env(
                &env.key,
                &env.value,
                &[
                    "HOSTNAME",
                    "PORT",
                    "CONTROL_PORT_REDIS",
                    "CONTROL_PORT_NATS",
                    "CONTROL_PORT_ETCD_CLIENT",
                    "CONTROL_PORT_ETCD_PEER",
                ],
                path,
            )?;
            register_env_key(
                &mut shared_env_keys,
                &env.key,
                &format!("resource {:?}", resource.resource_type),
                path,
            )?;
        }
    }
    let mut dependencies = BTreeSet::new();
    for dependency in &manifest.dependencies {
        let identifier = dependency.identifier();
        validate_identifier("dependency identifier", identifier, path)?;
        if !dependencies.insert(identifier) {
            bail!("{}: duplicate dependency {identifier:?}", path.display());
        }
        for env in dependency.env() {
            validate_name("dependency endpoint", &env.endpoint, path)?;
            validate_structured_env(&env.key, &env.value, &["HOSTNAME", "PORT"], path)?;
            register_env_key(
                &mut shared_env_keys,
                &env.key,
                &format!("dependency {identifier:?}"),
                path,
            )?;
        }
    }
    let mut exposed_ports = BTreeSet::new();
    for exposure in &manifest.expose {
        if exposure.port == 0 {
            bail!("{}: exposed HTTP port cannot be zero", path.display());
        }
        if !exposed_ports.insert(exposure.port) {
            bail!(
                "{}: duplicate exposed HTTP port {}",
                path.display(),
                exposure.port
            );
        }
    }
    for (name, db) in &manifest.postgres {
        validate_env(name, &EnvValue::Literal(String::new()), path)?;
        if db.database.is_empty() || db.database.contains(['\0', '\'', '"']) {
            bail!("{}: invalid Postgres database {name:?}", path.display());
        }
        register_env_key(&mut shared_env_keys, name, "Postgres database", path)?;
        validate_identifier("Postgres database package", &db.package, path)?;
    }
    for (name, db) in &manifest.mongo {
        validate_env(name, &EnvValue::Literal(String::new()), path)?;
        if db.database.is_empty() || db.database.contains(['\0', '\'', '"']) {
            bail!("{}: invalid Mongo database {name:?}", path.display());
        }
        register_env_key(&mut shared_env_keys, name, "MongoDB database", path)?;
        validate_identifier("MongoDB database package", &db.package, path)?;
    }
    for (run_name, run) in &manifest.run {
        for (key, value) in &run.env {
            validate_env(key, value, path)?;
            if let Some(source) = shared_env_keys.get(key.as_str()) {
                bail!(
                    "{}: environment key {key:?} is declared by both {source} and run {run_name:?}",
                    path.display()
                );
            }
        }
    }
    Ok(())
}

fn package_script_command(script: &str) -> String {
    format!("bun run {script}")
}

fn validate_package_scripts<'a>(
    package_json: &Path,
    scripts: impl Iterator<Item = &'a String>,
    manifest_path: &Path,
) -> Result<()> {
    let expected = scripts.collect::<BTreeSet<_>>();
    if expected.is_empty() {
        return Ok(());
    }
    let text = fs::read_to_string(package_json)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not read {}", package_json.display()))?;
    let value: serde_json::Value = serde_json::from_str(&text)
        .into_diagnostic()
        .wrap_err_with(|| format!("invalid {}", package_json.display()))?;
    let available = value.get("scripts").and_then(serde_json::Value::as_object);
    for script in expected {
        if script.trim().is_empty()
            || script
                .chars()
                .any(|character| !(character.is_ascii_alphanumeric() || "-_:.".contains(character)))
        {
            bail!(
                "{}: invalid package script {script:?}",
                manifest_path.display()
            );
        }
        if !available.is_some_and(|scripts| {
            scripts
                .get(script)
                .and_then(serde_json::Value::as_str)
                .is_some()
        }) {
            bail!(
                "{}: package.json does not declare required script {script:?}",
                manifest_path.display()
            );
        }
    }
    Ok(())
}

fn register_env_key<'a>(
    keys: &mut BTreeMap<&'a str, String>,
    key: &'a str,
    source: &str,
    path: &Path,
) -> Result<()> {
    if let Some(previous) = keys.insert(key, source.to_string()) {
        bail!(
            "{}: environment key {key:?} is declared by both {previous} and {source}",
            path.display()
        );
    }
    Ok(())
}

fn validate_name(kind: &str, value: &str, path: &Path) -> Result<()> {
    if value.is_empty()
        || !value.chars().all(|character| {
            character == '-' || character == '_' || character.is_ascii_alphanumeric()
        })
    {
        bail!("{}: invalid {kind} {value:?}", path.display());
    }
    Ok(())
}

fn validate_identifier(kind: &str, value: &str, path: &Path) -> Result<()> {
    if value.trim().is_empty() || value.chars().any(char::is_whitespace) {
        bail!("{}: invalid {kind} {value:?}", path.display());
    }
    Ok(())
}

fn validate_structured_env(key: &str, value: &str, templates: &[&str], path: &Path) -> Result<()> {
    validate_env(key, &EnvValue::Literal(String::new()), path)?;
    validate_templates(value, templates).wrap_err_with(|| {
        format!(
            "{}: invalid template for environment key {key:?}",
            path.display()
        )
    })
}

fn validate_templates(value: &str, allowed: &[&str]) -> Result<()> {
    let mut remaining = value;
    while let Some(start) = remaining.find("{{") {
        remaining = &remaining[start + 2..];
        let Some(end) = remaining.find("}}") else {
            bail!("unclosed template in {value:?}");
        };
        let template = &remaining[..end];
        if !allowed.contains(&template) {
            bail!("unknown template {template:?} in {value:?}");
        }
        remaining = &remaining[end + 2..];
    }
    if remaining.contains("}}") {
        bail!("unmatched template delimiter in {value:?}");
    }
    Ok(())
}

pub fn refresh_dependency_endpoints(manifests: &mut [LoadedManifest]) {
    let endpoints = manifests
        .iter()
        .filter_map(|loaded| {
            loaded.manifest.package.as_ref().map(|package| {
                (
                    package.name.clone(),
                    loaded
                        .manifest
                        .endpoints
                        .iter()
                        .map(|(name, endpoint)| {
                            (
                                name.clone(),
                                ResolvedEndpoint {
                                    hostname: "localhost".into(),
                                    port: endpoint.port,
                                },
                            )
                        })
                        .collect::<BTreeMap<_, _>>(),
                )
            })
        })
        .collect::<BTreeMap<_, _>>();
    for loaded in manifests {
        loaded.manifest.dependency_endpoints = loaded
            .manifest
            .dependencies
            .iter()
            .filter_map(|dependency| {
                endpoints
                    .get(dependency.identifier())
                    .cloned()
                    .map(|endpoints| (dependency.identifier().to_string(), endpoints))
            })
            .collect();
    }
}

pub fn validate_dependency_endpoints(manifests: &[LoadedManifest]) -> Result<()> {
    for loaded in manifests {
        for dependency in &loaded.manifest.dependencies {
            let endpoints = loaded
                .manifest
                .dependency_endpoints
                .get(dependency.identifier())
                .expect("validated dependencies have resolved endpoint sets");
            for env in dependency.env() {
                if !endpoints.contains_key(&env.endpoint) {
                    bail!(
                        "{}: dependency {:?} references unknown endpoint {:?}",
                        loaded.path.display(),
                        dependency.identifier(),
                        env.endpoint
                    );
                }
            }
        }
    }
    Ok(())
}

pub fn load_externals(root: &Path, manifests: &mut [LoadedManifest]) -> Result<BTreeSet<String>> {
    let Some((path, external)) = read_external_manifest(root)? else {
        return Ok(BTreeSet::new());
    };
    apply_externals(manifests, &external, &path)
}

pub fn load_external_hostnames(root: &Path) -> Result<BTreeSet<String>> {
    Ok(read_external_manifest(root)?
        .into_iter()
        .flat_map(|(_, manifest)| manifest.external)
        .map(|external| external.hostname)
        .collect())
}

fn read_external_manifest(root: &Path) -> Result<Option<(PathBuf, ExternalManifest)>> {
    let path = root.join("control-external.toml");
    if !path.is_file() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not read {}", path.display()))?;
    let external: ExternalManifest = toml::from_str(&text)
        .into_diagnostic()
        .wrap_err_with(|| format!("invalid {}", path.display()))?;
    Ok(Some((path, external)))
}

pub fn apply_externals(
    manifests: &mut [LoadedManifest],
    external: &ExternalManifest,
    path: &Path,
) -> Result<BTreeSet<String>> {
    let packages = manifests
        .iter()
        .filter_map(|loaded| {
            loaded
                .manifest
                .package
                .as_ref()
                .map(|package| (package.name.clone(), loaded.manifest.endpoints.clone()))
        })
        .collect::<BTreeMap<_, _>>();
    let mut identifiers = BTreeSet::new();
    for item in &external.external {
        validate_identifier("external identifier", &item.identifier, path)?;
        if item.hostname.trim().is_empty() || item.hostname.contains(char::is_whitespace) {
            bail!(
                "{}: invalid external hostname {:?}",
                path.display(),
                item.hostname
            );
        }
        if !identifiers.insert(item.identifier.clone()) {
            bail!(
                "{}: duplicate external {:?}",
                path.display(),
                item.identifier
            );
        }
        let endpoints = packages.get(&item.identifier).ok_or_else(|| {
            miette::miette!(
                "{}: external references unknown dependency {:?}",
                path.display(),
                item.identifier
            )
        })?;
        for (name, port) in &item.mapping {
            if *port == 0 {
                bail!(
                    "{}: external endpoint {name:?} port cannot be zero",
                    path.display()
                );
            }
            if !endpoints.contains_key(name) {
                bail!(
                    "{}: external {:?} maps unknown endpoint {name:?}",
                    path.display(),
                    item.identifier
                );
            }
        }
        for loaded in manifests.iter() {
            for dependency in loaded
                .manifest
                .dependencies
                .iter()
                .filter(|dependency| dependency.identifier() == item.identifier)
            {
                for env in dependency.env() {
                    if !item.mapping.contains_key(&env.endpoint) {
                        bail!(
                            "{}: external {:?} is missing mapping for referenced endpoint {:?}",
                            path.display(),
                            item.identifier,
                            env.endpoint
                        );
                    }
                }
            }
        }
        for loaded in manifests.iter_mut() {
            if let Some(resolved) = loaded
                .manifest
                .dependency_endpoints
                .get_mut(&item.identifier)
            {
                for (name, port) in &item.mapping {
                    resolved.insert(
                        name.clone(),
                        ResolvedEndpoint {
                            hostname: item.hostname.clone(),
                            port: *port,
                        },
                    );
                }
            }
        }
    }
    validate_dependency_endpoints(manifests)?;
    Ok(identifiers)
}

fn validate_env(key: &str, value: &EnvValue, path: &Path) -> Result<()> {
    if key.is_empty() || !key.chars().all(|c| c == '_' || c.is_ascii_alphanumeric()) {
        bail!("{}: invalid environment key {key:?}", path.display());
    }
    match value {
        EnvValue::Lookup(false) => {
            bail!(
                "{}: environment booleans may only be true (lookup)",
                path.display()
            )
        }
        EnvValue::Detailed(spec) if spec.value.is_some() && spec.from.is_some() => {
            bail!(
                "{}: environment key {key:?} cannot set both value and from",
                path.display()
            )
        }
        _ => Ok(()),
    }
}

pub fn select<'a>(
    manifests: &'a [LoadedManifest],
    selectors: &[String],
    kind: &RootKind,
) -> Result<Vec<&'a LoadedManifest>> {
    if selectors.is_empty() {
        return Ok(manifests
            .iter()
            .filter(|manifest| manifest.manifest.mode.applies_to(kind))
            .collect());
    }
    let groups = manifests
        .iter()
        .flat_map(|manifest| manifest.manifest.groups.iter())
        .fold(
            BTreeMap::<String, BTreeSet<String>>::new(),
            |mut groups, (name, members)| {
                groups
                    .entry(name.clone())
                    .or_default()
                    .extend(members.iter().cloned());
                groups
            },
        );
    let mut selected = Vec::new();
    let mut matched = vec![false; selectors.len()];
    for manifest in manifests {
        if !manifest.manifest.mode.applies_to(kind) {
            continue;
        }
        let package = manifest.manifest.package.as_ref();
        if package.is_none() {
            selected.push(manifest);
            continue;
        }
        let mut hit = false;
        for (index, selector) in selectors.iter().enumerate() {
            let found = package.is_some_and(|p| {
                p.name == *selector
                    || p.groups.iter().any(|g| g == selector)
                    || groups
                        .get(selector)
                        .is_some_and(|members| members.contains(&p.name))
            });
            matched[index] |= found || groups.contains_key(selector);
            hit |= found;
        }
        if hit {
            selected.push(manifest);
        }
    }
    let unknown = selectors
        .iter()
        .zip(matched)
        .filter_map(|(s, hit)| (!hit).then_some(s.as_str()))
        .collect::<Vec<_>>();
    if !unknown.is_empty() {
        bail!("unknown package/group selector(s): {}", unknown.join(", "));
    }
    Ok(selected)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn parses_manifest_and_rejects_unknown_fields() {
        let parsed: Manifest = toml::from_str(
            r#"
                [package]
                name = "api"
                groups = ["backend"]
                [env]
                STATIC = "yes"
                INHERITED = true
                [postgres.main]
                database = "app"
                package = "api"
                [run.api]
                command = "bun dev"
            "#,
        )
        .unwrap();
        assert_eq!(parsed.run["api"].command, "bun dev");
        assert!(toml::from_str::<Manifest>("unexpected = true").is_err());
    }

    #[test]
    fn selectors_match_package_and_group() {
        let manifests = vec![LoadedManifest {
            path: "control.toml".into(),
            manifest: toml::from_str(
                "[package]\nname='api'\ngroups=['backend']\n[run.api]\ncommand='x'",
            )
            .unwrap(),
        }];
        assert_eq!(
            select(&manifests, &["backend".into()], &RootKind::Standalone)
                .unwrap()
                .len(),
            1
        );
        assert!(select(&manifests, &["missing".into()], &RootKind::Standalone).is_err());
    }

    #[test]
    fn normalizes_repository_manifest_schema() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("control.toml");
        fs::write(
            temp.path().join("package.json"),
            r#"{"scripts":{"dev:start":"true","test:start-e2e":"true","control:db:generate":"true","control:db:push":"true"}}"#,
        )
        .unwrap();
        fs::write(
            &path,
            r#"
                name = "@metorial/api"
                group = "oss"
                [dev]
                prepare = ["generate"]
                run = ["dev:start"]
                [[dev.expose]]
                port = 4310
                [dev.env]
                SECRET = true
                [dev.db.main]
                name = "metorial"
                engine = "postgres"
                env = "DATABASE_URL"
                package = "@metorial/api"
            "#,
        )
        .unwrap();
        let loaded = load(&path).unwrap();
        assert_eq!(loaded.manifest.package.unwrap().name, "@metorial/api");
        assert_eq!(loaded.manifest.run.len(), 1);
        assert!(loaded.manifest.run.contains_key("dev"));
        assert_eq!(loaded.manifest.expose, vec![Exposure { port: 4310 }]);
        assert_eq!(loaded.manifest.postgres["DATABASE_URL"].port, 35432);
    }

    #[test]
    fn validates_exposed_http_ports() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("control.toml");
        fs::write(temp.path().join("package.json"), "{}").unwrap();

        fs::write(
            &path,
            "name='api'\n[[dev.expose]]\nport=4310\n[[dev.expose]]\nport=4310",
        )
        .unwrap();
        assert!(load(&path).is_err());

        fs::write(&path, "name='api'\n[[dev.expose]]\nport=0").unwrap();
        assert!(load(&path).is_err());
    }

    #[test]
    fn validates_repository_and_database_owner_scripts() {
        let temp = tempdir().unwrap();
        fs::write(
            temp.path().join("package.json"),
            r#"{"name":"api","scripts":{}}"#,
        )
        .unwrap();
        fs::write(
            temp.path().join("control.toml"),
            "name='api'\n[dev]\nrun=['dev:start']",
        )
        .unwrap();
        assert!(load(&temp.path().join("control.toml")).is_err());

        fs::write(
            temp.path().join("package.json"),
            r#"{"name":"api","scripts":{"dev:start":"true"}}"#,
        )
        .unwrap();
        fs::write(
            temp.path().join("control.toml"),
            "name='api'\n[dev.db.main]\nname='api'\nengine='postgres'\nenv='DATABASE_URL'\npackage='api'",
        )
        .unwrap();
        assert!(discover(temp.path()).is_err());
    }

    fn write_package(root: &Path, directory: &str, manifest: &str) {
        let directory = root.join(directory);
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join("package.json"),
            format!(
                r#"{{"name":"{}","scripts":{{"dev:start":"true","test:start-e2e":"true","control:db:generate":"true","control:db:push":"true"}}}}"#,
                directory.file_name().unwrap().to_string_lossy()
            ),
        )
        .unwrap();
        fs::write(directory.join("control.toml"), manifest).unwrap();
    }

    #[test]
    fn validates_and_orders_package_dependencies() {
        let temp = tempdir().unwrap();
        fs::write(temp.path().join("control.toml"), "mode='both'").unwrap();
        write_package(temp.path(), "db", "name='db'");
        write_package(
            temp.path(),
            "api",
            "name='api'\ndependencies=['db']\n[test.e2e]\npackages=['tests']",
        );
        write_package(temp.path(), "tests", "name='tests'");
        let manifests = discover(temp.path()).unwrap();
        let roots = select(&manifests, &["api".into()], &RootKind::Standalone).unwrap();
        let closure = dependency_closure(&manifests, &roots, &RootKind::Standalone).unwrap();
        assert_eq!(
            closure
                .iter()
                .map(|loaded| loaded.manifest.package.as_ref().unwrap().name.as_str())
                .collect::<Vec<_>>(),
            ["db"]
        );
        let expanded = select_with_dependencies_excluding(
            &manifests,
            &["api".into()],
            &RootKind::Standalone,
            &BTreeSet::new(),
        )
        .unwrap();
        assert_eq!(
            expanded
                .iter()
                .filter_map(|loaded| loaded.manifest.package.as_ref().map(|p| p.name.as_str()))
                .collect::<Vec<_>>(),
            ["db", "api"]
        );
        assert!(expanded[0].manifest.package.is_none());
        assert_eq!(
            expanded[1..]
                .iter()
                .map(|loaded| loaded.manifest.package.as_ref().unwrap().name.as_str())
                .collect::<Vec<_>>(),
            ["db", "api"]
        );
    }

    #[test]
    fn rejects_unknown_self_cyclic_and_mode_incompatible_dependencies() {
        for (dependency, expected) in [
            ("missing", "unknown dependency"),
            ("api", "cannot reference itself"),
        ] {
            let temp = tempdir().unwrap();
            write_package(
                temp.path(),
                "api",
                &format!("name='api'\ndependencies=['{dependency}']"),
            );
            let error = discover(temp.path()).unwrap_err();
            assert!(format!("{error:?}").contains(expected));
        }

        let temp = tempdir().unwrap();
        write_package(temp.path(), "a", "name='a'\ndependencies=['b']");
        write_package(temp.path(), "b", "name='b'\ndependencies=['a']");
        let error = discover(temp.path()).unwrap_err();
        assert!(format!("{error:?}").contains("a -> b -> a"));

        let temp = tempdir().unwrap();
        write_package(temp.path(), "both", "name='both'\ndependencies=['oss']");
        write_package(temp.path(), "oss", "name='oss'\nmode='oss'");
        let error = discover(temp.path()).unwrap_err();
        assert!(format!("{error:?}").contains("incompatible mode"));
    }

    #[test]
    fn distinguishes_absent_and_present_e2e_configuration() {
        let parsed: Manifest =
            toml::from_str("name='api'\n[test.e2e]\npackages=['suite']").unwrap();
        assert_eq!(parsed.test.e2e.unwrap().packages, ["suite"]);
        let disabled: Manifest = toml::from_str("name='api'\n[test.e2e]\nprepare=[]").unwrap();
        assert_eq!(disabled.test.e2e.unwrap().prepare, Some(vec![]));
        let absent: Manifest = toml::from_str("name='api'").unwrap();
        assert!(absent.test.e2e.is_none());
        assert!(toml::from_str::<Manifest>("[test.e2e]\nunknown=true").is_err());
    }

    #[test]
    fn parses_and_validates_structured_wiring() {
        let temp = tempdir().unwrap();
        write_package(
            temp.path(),
            "upstream",
            r#"
                name = "upstream"
                [endpoints.http]
                port = 4310
                [[endpoints.http.env]]
                key = "LISTEN_PORT"
                value = "{{PORT}}"
            "#,
        );
        write_package(
            temp.path(),
            "consumer",
            r#"
                name = "consumer"
                [[dependencies]]
                identifier = "upstream"
                [[dependencies.env]]
                endpoint = "http"
                key = "UPSTREAM_URL"
                value = "http://{{HOSTNAME}}:{{PORT}}"
                [[resources]]
                type = "redis"
                [[resources.env]]
                key = "REDIS_URL"
                value = "redis://{{HOSTNAME}}:{{PORT}}"
            "#,
        );
        let manifests = discover(temp.path()).unwrap();
        let consumer = manifests
            .iter()
            .find(|loaded| loaded.manifest.package.as_ref().unwrap().name == "consumer")
            .unwrap();
        assert_eq!(consumer.manifest.dependencies[0].identifier(), "upstream");
        assert_eq!(
            consumer.manifest.dependency_endpoints["upstream"]["http"].port,
            4310
        );
        assert_eq!(
            consumer.manifest.resources[0].resource_type,
            ResourceType::Redis
        );
    }

    #[test]
    fn rejects_invalid_structured_wiring() {
        let temp = tempdir().unwrap();
        write_package(
            temp.path(),
            "upstream",
            "name='upstream'\n[endpoints.http]\nport=4310",
        );
        write_package(
            temp.path(),
            "consumer",
            "name='consumer'\n[[dependencies]]\nidentifier='upstream'\n[[dependencies.env]]\nendpoint='missing'\nkey='URL'\nvalue='http://{{HOSTNAME}}:{{PORT}}'",
        );
        assert!(format!("{:?}", discover(temp.path()).unwrap_err()).contains("unknown endpoint"));

        let temp = tempdir().unwrap();
        write_package(
            temp.path(),
            "invalid",
            "name='invalid'\n[[resources]]\ntype='redis'\n[[resources.env]]\nkey='URL'\nvalue='{{UNKNOWN}}'",
        );
        assert!(format!("{:?}", discover(temp.path()).unwrap_err()).contains("unknown template"));
    }

    #[test]
    fn external_mapping_overrides_development_dependency_endpoints() {
        let temp = tempdir().unwrap();
        write_package(
            temp.path(),
            "upstream",
            "name='upstream'\n[endpoints.http]\nport=4310",
        );
        write_package(
            temp.path(),
            "consumer",
            "name='consumer'\n[[dependencies]]\nidentifier='upstream'\n[[dependencies.env]]\nendpoint='http'\nkey='URL'\nvalue='http://{{HOSTNAME}}:{{PORT}}'",
        );
        fs::write(
            temp.path().join("control-external.toml"),
            "[[external]]\nidentifier='upstream'\nhostname='api.example.test'\n[external.mapping]\nhttp=443\n",
        )
        .unwrap();
        let mut manifests = discover(temp.path()).unwrap();
        let identifiers = load_externals(temp.path(), &mut manifests).unwrap();
        assert_eq!(identifiers, BTreeSet::from(["upstream".to_string()]));
        assert_eq!(
            load_external_hostnames(temp.path()).unwrap(),
            BTreeSet::from(["api.example.test".to_string()])
        );
        let consumer = manifests
            .iter()
            .find(|loaded| loaded.manifest.package.as_ref().unwrap().name == "consumer")
            .unwrap();
        assert_eq!(
            consumer.manifest.dependency_endpoints["upstream"]["http"],
            ResolvedEndpoint {
                hostname: "api.example.test".into(),
                port: 443,
            }
        );
    }

    #[test]
    fn external_dependencies_stop_local_closure_expansion() {
        let temp = tempdir().unwrap();
        write_package(temp.path(), "database", "name='database'");
        write_package(
            temp.path(),
            "upstream",
            "name='upstream'\ndependencies=['database']",
        );
        write_package(
            temp.path(),
            "consumer",
            "name='consumer'\ndependencies=['upstream']",
        );
        let manifests = discover(temp.path()).unwrap();
        let selected = select_with_dependencies_excluding(
            &manifests,
            &["consumer".into()],
            &RootKind::Standalone,
            &BTreeSet::from(["upstream".into()]),
        )
        .unwrap();
        assert_eq!(
            selected
                .iter()
                .filter_map(|loaded| loaded
                    .manifest
                    .package
                    .as_ref()
                    .map(|package| &package.name))
                .collect::<Vec<_>>(),
            ["consumer"]
        );
    }

    #[test]
    fn non_starting_endpoint_reference_does_not_create_a_cycle_or_closure_edge() {
        let temp = tempdir().unwrap();
        write_package(
            temp.path(),
            "api",
            "name='api'\n[endpoints.http]\nport=4310\n[[dependencies]]\nidentifier='worker'",
        );
        write_package(
            temp.path(),
            "worker",
            "name='worker'\n[endpoints.callback]\nport=4311\n[[dependencies]]\nidentifier='api'\nstart=false\n[[dependencies.env]]\nendpoint='http'\nkey='API_CALLBACK_URL'\nvalue='http://{{HOSTNAME}}:{{PORT}}'",
        );
        let manifests = discover(temp.path()).unwrap();
        let api = manifests
            .iter()
            .find(|loaded| loaded.manifest.package.as_ref().unwrap().name == "api")
            .unwrap();
        let worker = manifests
            .iter()
            .find(|loaded| loaded.manifest.package.as_ref().unwrap().name == "worker")
            .unwrap();
        assert!(api.manifest.dependencies[0].starts());
        assert!(!worker.manifest.dependencies[0].starts());
        assert_eq!(
            worker.manifest.dependency_endpoints["api"]["http"].port,
            4310
        );
        assert_eq!(
            dependency_closure(&manifests, &[api], &RootKind::Standalone)
                .unwrap()
                .iter()
                .map(|loaded| loaded.manifest.package.as_ref().unwrap().name.as_str())
                .collect::<Vec<_>>(),
            ["worker"]
        );
    }

    #[test]
    fn rejects_environment_key_collisions_across_manifest_sources() {
        for manifest in [
            "name='api'\n[endpoints.http]\nport=4310\n[[endpoints.http.env]]\nkey='URL'\nvalue='{{PORT}}'\n[dev.env]\nURL='duplicate'",
            "name='api'\n[endpoints.http]\nport=4310\n[[endpoints.http.env]]\nkey='URL'\nvalue='{{PORT}}'\n[[resources]]\ntype='redis'\n[[resources.env]]\nkey='URL'\nvalue='redis://{{HOSTNAME}}:{{PORT}}'",
            "name='api'\n[endpoints.http]\nport=4310\n[[endpoints.http.env]]\nkey='URL'\nvalue='{{PORT}}'\n[run.dev]\ncommand='run'\n[run.dev.env]\nURL='duplicate'",
            "name='api'\n[dev.env]\nURL='duplicate'\n[dev.db.main]\nname='api'\nengine='postgres'\nenv='URL'\npackage='api'",
        ] {
            let temp = tempdir().unwrap();
            write_package(temp.path(), "api", manifest);
            let error = discover(temp.path()).unwrap_err();
            assert!(
                format!("{error:?}").contains("environment key \"URL\" is declared by both"),
                "{error:?}"
            );
        }
    }

    #[test]
    fn rejects_environment_key_collision_between_dependencies() {
        let temp = tempdir().unwrap();
        write_package(
            temp.path(),
            "one",
            "name='one'\n[endpoints.http]\nport=4310",
        );
        write_package(
            temp.path(),
            "two",
            "name='two'\n[endpoints.http]\nport=4311",
        );
        write_package(
            temp.path(),
            "consumer",
            "name='consumer'\n[[dependencies]]\nidentifier='one'\n[[dependencies.env]]\nendpoint='http'\nkey='URL'\nvalue='{{HOSTNAME}}:{{PORT}}'\n[[dependencies]]\nidentifier='two'\n[[dependencies.env]]\nendpoint='http'\nkey='URL'\nvalue='{{HOSTNAME}}:{{PORT}}'",
        );
        assert!(
            format!("{:?}", discover(temp.path()).unwrap_err())
                .contains("environment key \"URL\" is declared by both")
        );
    }
}
