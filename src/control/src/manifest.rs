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
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    #[default]
    Both,
    Oss,
    Enterprise,
}

impl Mode {
    fn applies_to(&self, kind: &RootKind) -> bool {
        matches!(
            (self, kind),
            (Self::Both, _)
                | (Self::Oss, RootKind::Standalone)
                | (Self::Enterprise, RootKind::Enterprise)
        )
    }
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
    let manifests = paths
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
    Ok(manifests)
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
        for (index, command) in std::mem::take(&mut manifest.dev.run)
            .into_iter()
            .enumerate()
        {
            // Primary script is "dev" so mirrors are named `api`, not `api-run-1`.
            let key = if index == 0 {
                "dev".into()
            } else {
                format!("{}", index + 1)
            };
            manifest.run.insert(
                key,
                Run {
                    command,
                    cwd: None,
                    env: BTreeMap::new(),
                    depends_on: Vec::new(),
                },
            );
        }
        let compose = services_compose(path);
        if let Some(compose) = &compose {
            manifest.docker.compose.push(compose.clone());
            manifest.docker.services.extend(
                ["etcd", "mongodb", "redis-db", "postgres-db2", "nats-1"]
                    .into_iter()
                    .map(String::from),
            );
        }
        for (_, database) in std::mem::take(&mut manifest.dev.db) {
            match database.engine {
                DatabaseEngine::Postgres => {
                    manifest.postgres.insert(
                        database.env,
                        Postgres {
                            host: default_localhost(),
                            port: 35432,
                            user: default_postgres(),
                            password: default_postgres(),
                            database: database.name,
                            service: Some("postgres-db2".into()),
                            compose: compose.clone(),
                        },
                    );
                }
                DatabaseEngine::Mongodb => {
                    manifest.mongo.insert(
                        database.env,
                        Mongo {
                            host: default_localhost(),
                            port: 32707,
                            user: Some("mongo".into()),
                            password: Some("mongo".into()),
                            database: database.name,
                            service: Some("mongodb".into()),
                            compose: compose.clone(),
                            auth_source: Some("admin".into()),
                        },
                    );
                }
            }
        }
    }
    Ok(())
}

fn services_compose(manifest_path: &Path) -> Option<PathBuf> {
    manifest_path.ancestors().find_map(|ancestor| {
        [
            ancestor.join("oss/scripts/dev-tools/services.docker-compose.yml"),
            ancestor.join("scripts/dev-tools/services.docker-compose.yml"),
        ]
        .into_iter()
        .find(|candidate| candidate.is_file())
    })
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
    for (key, value) in &manifest.env {
        validate_env(key, value, path)?;
    }
    for (key, value) in manifest.run.iter().flat_map(|(_, r)| r.env.iter()) {
        validate_env(key, value, path)?;
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
        if db.database.is_empty() || db.database.contains(['\0', '\'', '"']) {
            bail!("{}: invalid Postgres database {name:?}", path.display());
        }
    }
    for (name, db) in &manifest.mongo {
        if db.database.is_empty() || db.database.contains(['\0', '\'', '"']) {
            bail!("{}: invalid Mongo database {name:?}", path.display());
        }
    }
    Ok(())
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
        fs::write(temp.path().join("package.json"), "{}").unwrap();
        fs::write(
            &path,
            r#"
                name = "@metorial/api"
                group = "oss"
                [dev]
                prepare = ["bun generate"]
                run = ["bun dev"]
                [[dev.expose]]
                port = 4310
                [dev.env]
                SECRET = true
                [dev.db.main]
                name = "metorial"
                engine = "postgres"
                env = "DATABASE_URL"
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
}
