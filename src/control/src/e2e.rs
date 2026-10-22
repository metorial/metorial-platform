use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    hash::{DefaultHasher, Hash, Hasher},
    path::{Component, Path, PathBuf},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use miette::{IntoDiagnostic, Result, WrapErr, bail};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tokio::time::sleep;

use crate::{
    dev, docker, environment,
    manifest::{self, E2eResourceType, LoadedManifest, Mongo, Postgres},
    process,
    root::{ProjectRoot, RootKind},
    turbo,
};

const DEFAULT_HEALTH_TIMEOUT: u64 = 300;
const DEFAULT_CONCURRENCY: u32 = 4;
const OBJECT_STORAGE_IMAGE: &str = "ghcr.io/metorial/object-storage:latest";
const INFRASTRUCTURE: [&str; 4] = ["postgres-db2", "mongodb", "redis-db", "nats-1"];
const FINGERPRINT_TASK: &str = "e2e:fingerprint";
const HOST_ALIAS: &str = "host.docker.internal";
const REMOTE_CACHE_SECRETS: [&str; 3] = [
    "TURBO_TEAM",
    "TURBO_TOKEN",
    "TURBO_REMOTE_CACHE_SIGNATURE_KEY",
];

pub struct Options {
    pub filters: Vec<String>,
    pub images: Option<PathBuf>,
    pub workspace: Option<PathBuf>,
    pub keep: bool,
    pub plan_only: bool,
    pub concurrency: Option<u32>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Local,
    Images,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub mode: Mode,
    pub concurrency: u32,
    pub health_timeout_seconds: u64,
    pub files: Vec<EnvFile>,
    pub prepare: Vec<Step>,
    pub dependencies: Vec<Service>,
    pub suts: Vec<Service>,
    pub stacks: Vec<Stack>,
    #[serde(skip)]
    pub postgres: Vec<Postgres>,
    #[serde(skip)]
    pub mongo: Vec<Mongo>,
    #[serde(skip)]
    pub object_storage: bool,
}

#[derive(Debug, Serialize)]
pub struct EnvFile {
    pub path: String,
    pub values: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
pub struct Step {
    pub label: String,
    pub cwd: String,
    pub command: Vec<String>,
    pub env: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
pub struct Service {
    pub name: String,
    pub directory: String,
    pub start: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    pub env: BTreeMap<String, String>,
    pub health: Vec<HealthUrl>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct HealthUrl {
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stack {
    pub name: String,
    pub tests: Vec<String>,
    pub services: Vec<String>,
    pub env: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_key_inputs: Option<Value>,
}

#[derive(Debug)]
struct PackageInfo {
    name: String,
    directory: PathBuf,
    scripts: BTreeSet<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImageArtifact {
    name: String,
    image: String,
}

pub async fn run(project: &ProjectRoot, options: Options) -> Result<()> {
    let manifests = manifest::discover(&project.root)?;
    let mut plan = build_plan(project, &manifests, &options)?;
    match service_fingerprints(project, &plan).await {
        Ok(fingerprints) => attach_cache_keys(&mut plan, &fingerprints),
        Err(error) => eprintln!(
            "Could not fingerprint the e2e services, so e2e results will not be cached: {error:?}"
        ),
    }
    if options.plan_only {
        println!("{}", serde_json::to_string_pretty(&plan).into_diagnostic()?);
        return Ok(());
    }
    print_summary(&plan);

    let assets = project.oss.join("scripts/dev-tools/e2e");
    let run_id = format!(
        "{}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or_default(),
        std::process::id()
    );
    let run_dir = project.root.join(".control/e2e").join(&run_id);
    fs::create_dir_all(run_dir.join("logs"))
        .into_diagnostic()
        .wrap_err_with(|| format!("could not create {}", run_dir.display()))?;
    fs::copy(assets.join("runner.ts"), run_dir.join("runner.ts"))
        .into_diagnostic()
        .wrap_err("could not stage the e2e runner")?;
    write_json(&run_dir.join("plan.json"), &plan)?;

    let image = ensure_runner_image(&project.root, &assets).await?;
    let root_hash = short_hash(&project.root.to_string_lossy());
    let mounts = match plan.mode {
        Mode::Local => {
            let volume = format!("control-e2e-{root_hash}");
            process::run_quiet(
                "docker",
                &["volume".into(), "create".into(), volume.clone()],
                &project.root,
                &BTreeMap::new(),
            )
            .await
            .wrap_err("could not create the e2e workspace volume")?;
            Mounts::Local {
                source: project.root.clone(),
                volume,
            }
        }
        Mode::Images => Mounts::Workspace(
            options
                .workspace
                .clone()
                .unwrap_or_else(|| project.root.clone()),
        ),
    };
    let compose = Compose {
        root: project.root.clone(),
        file: run_dir.join("compose.yml"),
    };
    let project_name = format!("control-e2e-{root_hash}-{}", std::process::id());
    let rendered = render_compose(&plan, &project_name, &image, &mounts, &run_dir);
    fs::write(
        &compose.file,
        serde_json::to_string_pretty(&rendered).into_diagnostic()?,
    )
    .into_diagnostic()
    .wrap_err("could not write the e2e compose file")?;

    let result = execute(&compose, &plan).await;

    if let Ok(logs) = compose
        .output(&["logs", "--no-color", "--timestamps"])
        .await
    {
        let _ = fs::write(run_dir.join("logs/compose.log"), logs);
    }
    if options.keep {
        println!(
            "Kept e2e containers; stop them with: docker compose --file {} down -v",
            compose.file.display()
        );
    } else {
        let _ = compose
            .quiet(&["down", "--volumes", "--remove-orphans", "--timeout", "5"])
            .await;
    }
    println!("E2E logs: {}", run_dir.join("logs").display());
    result
}

pub fn build_plan(
    project: &ProjectRoot,
    manifests: &[LoadedManifest],
    options: &Options,
) -> Result<Plan> {
    let mode = if options.images.is_some() {
        Mode::Images
    } else {
        Mode::Local
    };
    let kind = &project.kind;
    let root_values = root_environment(project);
    let applicable = manifests
        .iter()
        .filter(|loaded| loaded.manifest.mode.applies_to(kind))
        .collect::<Vec<_>>();
    let by_name = applicable
        .iter()
        .filter_map(|loaded| {
            loaded
                .manifest
                .package
                .as_ref()
                .map(|package| (package.name.as_str(), *loaded))
        })
        .collect::<BTreeMap<_, _>>();
    let packages = discover_packages(&project.root)?;

    let mut stacks = Vec::<(&LoadedManifest, Vec<String>)>::new();
    let mut owners = BTreeMap::<String, String>::new();
    for loaded in applicable
        .iter()
        .copied()
        .filter(|loaded| loaded.manifest.e2e.is_stack())
    {
        let stack = package_name(loaded);
        let base = loaded.path.parent().unwrap_or(&project.root);
        let mut tests = BTreeSet::new();
        for pattern in &loaded.manifest.e2e.tests {
            let pattern_path = normalize_path(&base.join(pattern));
            let matched = packages
                .iter()
                .filter(|package| glob_match(&pattern_path, &package.directory))
                .collect::<Vec<_>>();
            if matched.is_empty() {
                bail!(
                    "{}: e2e test glob {pattern:?} matches no packages",
                    loaded.path.display()
                );
            }
            for package in matched {
                if !package.scripts.contains("test:e2e") {
                    bail!(
                        "{}: e2e test package {:?} ({}) does not declare a \"test:e2e\" script",
                        loaded.path.display(),
                        package.name,
                        package.directory.display()
                    );
                }
                tests.insert(package.name.clone());
            }
        }
        for test in &tests {
            if let Some(previous) = owners.insert(test.clone(), stack.clone())
                && previous != stack
            {
                bail!("e2e test package {test:?} belongs to both {previous:?} and {stack:?}");
            }
        }
        stacks.push((loaded, tests.into_iter().collect()));
    }
    if stacks.is_empty() {
        bail!("no e2e stacks are declared for this checkout");
    }
    let stacks = filter_stacks(stacks, &options.filters)?;

    let sut_names = stacks
        .iter()
        .map(|(loaded, _)| package_name(loaded))
        .collect::<BTreeSet<_>>();
    let mut roots = stacks.iter().map(|(loaded, _)| *loaded).collect::<Vec<_>>();
    let mut extra = Vec::new();
    for (loaded, _) in &stacks {
        for service in &loaded.manifest.e2e.services {
            let target = by_name.get(service.as_str()).copied().ok_or_else(|| {
                miette::miette!("{}: unknown e2e service {service:?}", loaded.path.display())
            })?;
            extra.push(target);
        }
    }
    roots.extend(extra.iter().copied());
    let closure = manifest::dependency_closure(manifests, &roots, kind)?;
    let mut seen = BTreeSet::new();
    let dependency_manifests = closure
        .into_iter()
        .chain(extra)
        .filter(|loaded| {
            let name = package_name(loaded);
            !sut_names.contains(&name) && seen.insert(name)
        })
        .collect::<Vec<_>>();
    let sut_manifests = stacks.iter().map(|(loaded, _)| *loaded).collect::<Vec<_>>();
    let all_manifests = dependency_manifests
        .iter()
        .chain(&sut_manifests)
        .copied()
        .collect::<Vec<_>>();

    let images = match &options.images {
        Some(directory) => Some(read_images(directory, &all_manifests)?),
        None => None,
    };
    validate_ports(&all_manifests)?;
    let service = |loaded: &LoadedManifest, role: &str| {
        build_service(project, loaded, role, mode, images.as_ref(), &root_values)
    };
    let dependencies = dependency_manifests
        .iter()
        .map(|loaded| service(loaded, "dependency"))
        .collect::<Result<Vec<_>>>()?;
    let suts = sut_manifests
        .iter()
        .map(|loaded| service(loaded, "system under test"))
        .collect::<Result<Vec<_>>>()?;

    let endpoints = all_manifests
        .iter()
        .map(|loaded| {
            let endpoints = loaded
                .manifest
                .endpoints
                .iter()
                .map(|(name, endpoint)| {
                    (
                        name.clone(),
                        Value::String(format!("http://localhost:{}", endpoint.port)),
                    )
                })
                .collect::<serde_json::Map<_, _>>();
            (package_name(loaded), Value::Object(endpoints))
        })
        .collect::<serde_json::Map<_, _>>();
    let endpoints = serde_json::to_string(&endpoints).into_diagnostic()?;
    let stack_services = stacks
        .iter()
        .map(|(loaded, _)| {
            let mut roots = vec![*loaded];
            roots.extend(
                loaded
                    .manifest
                    .e2e
                    .services
                    .iter()
                    .filter_map(|service| by_name.get(service.as_str()).copied()),
            );
            let closure = manifest::dependency_closure(manifests, &roots, kind)?;
            Ok(roots
                .into_iter()
                .chain(closure)
                .map(package_name)
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect::<Vec<_>>())
        })
        .collect::<Result<Vec<_>>>()?;
    let stacks = stacks
        .iter()
        .zip(&suts)
        .zip(stack_services)
        .map(|(((_, tests), sut), services)| {
            let mut env = sut.env.clone();
            env.insert("CONTROL_E2E_ENDPOINTS".into(), endpoints.clone());
            Stack {
                name: sut.name.clone(),
                tests: tests.clone(),
                services,
                env,
                cache_key_inputs: None,
            }
        })
        .collect();

    let (files, prepare) = match mode {
        Mode::Local => (
            env_files(project, &all_manifests, &dependencies, &suts, &root_values)?,
            prepare_steps(&all_manifests, &root_values)?,
        ),
        Mode::Images => (Vec::new(), Vec::new()),
    };

    let mut postgres = BTreeMap::<String, Postgres>::new();
    let mut mongo = BTreeMap::<String, Mongo>::new();
    for loaded in &all_manifests {
        for database in loaded.manifest.postgres.values() {
            postgres
                .entry(database.database.clone())
                .or_insert_with(|| database.clone());
        }
        for database in loaded.manifest.mongo.values() {
            mongo
                .entry(database.database.clone())
                .or_insert_with(|| database.clone());
        }
    }

    Ok(Plan {
        mode,
        concurrency: options.concurrency.unwrap_or(DEFAULT_CONCURRENCY).max(1),
        health_timeout_seconds: sut_manifests
            .iter()
            .filter_map(|loaded| loaded.manifest.e2e.health_timeout)
            .max()
            .unwrap_or(DEFAULT_HEALTH_TIMEOUT),
        files,
        prepare,
        dependencies,
        suts,
        stacks,
        postgres: postgres.into_values().collect(),
        mongo: mongo.into_values().collect(),
        object_storage: sut_manifests.iter().any(|loaded| {
            loaded
                .manifest
                .e2e
                .resources
                .iter()
                .any(|resource| resource.resource_type == E2eResourceType::ObjectStorage)
        }),
    })
}

async fn service_fingerprints(
    project: &ProjectRoot,
    plan: &Plan,
) -> Result<BTreeMap<String, String>> {
    let names = plan
        .dependencies
        .iter()
        .chain(&plan.suts)
        .map(|service| service.name.clone())
        .collect::<BTreeSet<_>>();
    let mut args = vec![
        "run".to_string(),
        FINGERPRINT_TASK.into(),
        "--dry=json".into(),
        "--cache=local:,remote:".into(),
    ];
    args.extend(names.iter().map(|name| format!("--filter={name}")));
    let (program, args) = match std::env::var("TURBO_EXECUTABLE") {
        Ok(executable) if !executable.is_empty() => (executable, args),
        _ => turbo::command(&project.root, args),
    };
    let args = args.iter().map(String::as_str).collect::<Vec<_>>();
    let output = process::output(&program, &args, &project.root).await?;
    parse_fingerprints(&output, &names)
}

fn parse_fingerprints(output: &str, names: &BTreeSet<String>) -> Result<BTreeMap<String, String>> {
    let start = output
        .find('{')
        .ok_or_else(|| miette::miette!("Turbo printed no dry-run summary"))?;
    let summary: Value = serde_json::from_str(&output[start..])
        .into_diagnostic()
        .wrap_err("invalid Turbo dry-run summary")?;
    let suffix = format!("#{FINGERPRINT_TASK}");
    let fingerprints = summary["tasks"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|task| {
            let name = task["taskId"].as_str()?.strip_suffix(&suffix)?;
            Some((name.to_string(), task["hash"].as_str()?.to_string()))
        })
        .filter(|(name, _)| names.contains(name))
        .collect::<BTreeMap<_, _>>();
    if let Some(missing) = names.iter().find(|name| !fingerprints.contains_key(*name)) {
        bail!("Turbo did not fingerprint {missing:?}");
    }
    Ok(fingerprints)
}

fn attach_cache_keys(plan: &mut Plan, fingerprints: &BTreeMap<String, String>) {
    let mode = plan.mode;
    let environments = plan
        .dependencies
        .iter()
        .chain(&plan.suts)
        .map(|service| (service.name.clone(), service.env.clone()))
        .collect::<BTreeMap<_, _>>();
    for stack in &mut plan.stacks {
        let services = stack
            .services
            .iter()
            .map(|name| {
                (
                    name.clone(),
                    json!({
                        "fingerprint": fingerprints.get(name),
                        "env": environments.get(name),
                    }),
                )
            })
            .collect::<serde_json::Map<_, _>>();
        stack.cache_key_inputs = Some(json!({
            "version": 1,
            "mode": mode,
            "env": stack.env,
            "services": services,
        }));
    }
}

fn remote_cache_environment(api: Option<&str>) -> Vec<Value> {
    let Some(api) = api.filter(|api| !api.is_empty()) else {
        return Vec::new();
    };
    std::iter::once(format!("TURBO_API={}", escape(&container_url(api))))
        .chain(REMOTE_CACHE_SECRETS.iter().map(|name| name.to_string()))
        .map(Value::String)
        .collect()
}

fn container_url(url: &str) -> String {
    let Some((scheme, rest)) = url.split_once("://") else {
        return url.into();
    };
    let end = rest.find([':', '/']).unwrap_or(rest.len());
    match &rest[..end] {
        "127.0.0.1" | "localhost" | "0.0.0.0" => {
            format!("{scheme}://{HOST_ALIAS}{}", &rest[end..])
        }
        _ => url.into(),
    }
}

fn root_environment(project: &ProjectRoot) -> BTreeMap<String, String> {
    let enterprise = matches!(project.kind, RootKind::Enterprise);
    [
        ("METORIAL_ENV", "development"),
        (
            "METORIAL_SOURCE",
            if enterprise { "enterprise" } else { "oss" },
        ),
        ("IS_ENTERPRISE", if enterprise { "true" } else { "false" }),
        ("METORIAL_HOSTNAME", "localhost"),
        ("NODE_ENV", "development"),
        ("CONTROL_PORT_POSTGRES", "35432"),
        ("CONTROL_PORT_MONGO", "32707"),
        ("CONTROL_PORT_REDIS", "36379"),
        ("CONTROL_PORT_NATS", "34222"),
        ("CONTROL_PORT_ETCD_CLIENT", "32379"),
        ("CONTROL_PORT_ETCD_PEER", "32380"),
        (environment::ISOLATED, "1"),
    ]
    .into_iter()
    .map(|(key, value)| (key.to_string(), value.to_string()))
    .collect()
}

fn process_environment(root_values: &BTreeMap<String, String>) -> BTreeMap<String, String> {
    let mut env = root_values.clone();
    env.remove(environment::ISOLATED);
    env.insert("CONTROL_E2E".into(), "1".into());
    env.insert("TURBO_GLOBAL_WARNING_DISABLED".into(), "1".into());
    env
}

fn filter_stacks<'a>(
    stacks: Vec<(&'a LoadedManifest, Vec<String>)>,
    filters: &[String],
) -> Result<Vec<(&'a LoadedManifest, Vec<String>)>> {
    if filters.is_empty() {
        return Ok(stacks);
    }
    for filter in filters {
        let matches = stacks.iter().any(|(loaded, tests)| {
            wildcard(filter, &package_name(loaded))
                || tests.iter().any(|test| wildcard(filter, test))
        });
        if !matches {
            bail!("e2e filter {filter:?} matches no stack or test package");
        }
    }
    Ok(stacks
        .into_iter()
        .filter_map(|(loaded, tests)| {
            let stack = package_name(loaded);
            let selected = if filters.iter().any(|filter| wildcard(filter, &stack)) {
                tests
            } else {
                tests
                    .into_iter()
                    .filter(|test| filters.iter().any(|filter| wildcard(filter, test)))
                    .collect()
            };
            (!selected.is_empty()).then_some((loaded, selected))
        })
        .collect())
}

fn build_service(
    project: &ProjectRoot,
    loaded: &LoadedManifest,
    role: &str,
    mode: Mode,
    images: Option<&BTreeMap<String, String>>,
    root_values: &BTreeMap<String, String>,
) -> Result<Service> {
    let name = package_name(loaded);
    let health = loaded
        .manifest
        .health_checks()
        .into_iter()
        .map(|check| HealthUrl {
            url: format!("http://localhost:{}{}", check.port, check.path),
            status: check.status,
        })
        .collect::<Vec<_>>();
    if health.is_empty() {
        bail!(
            "{}: e2e {role} {name:?} declares no health check (add `health` to an endpoint or a [[health]] entry)",
            loaded.path.display()
        );
    }
    let e2e = &loaded.manifest.e2e;
    let image = match mode {
        Mode::Local => {
            if e2e.start.is_empty() {
                bail!(
                    "{}: e2e {role} {name:?} declares no [e2e] start scripts",
                    loaded.path.display()
                );
            }
            None
        }
        Mode::Images => {
            let artifact = e2e.image.as_ref().ok_or_else(|| {
                miette::miette!(
                    "{}: e2e {role} {name:?} declares no [e2e] image",
                    loaded.path.display()
                )
            })?;
            images.and_then(|images| images.get(artifact)).cloned()
        }
    };
    let mut env = environment::all_for_manifest(loaded, root_values)?;
    env.extend(environment::resolve(&e2e.env, root_values)?);
    env.insert("CONTROL_E2E".into(), "1".into());
    Ok(Service {
        name,
        directory: relative(&project.root, loaded.path.parent().unwrap_or(&project.root)),
        start: e2e.start.clone(),
        image,
        env,
        health,
    })
}

fn validate_ports(manifests: &[&LoadedManifest]) -> Result<()> {
    let mut owners = BTreeMap::<u16, String>::new();
    for loaded in manifests {
        let name = package_name(loaded);
        let ports = loaded
            .manifest
            .endpoints
            .values()
            .map(|endpoint| endpoint.port)
            .chain(loaded.manifest.health.iter().map(|check| check.port))
            .collect::<BTreeSet<_>>();
        for port in ports {
            if let Some(previous) = owners.insert(port, name.clone()) {
                bail!(
                    "e2e services {previous:?} and {name:?} both listen on port {port}; they share one network namespace"
                );
            }
        }
    }
    Ok(())
}

fn read_images(
    directory: &Path,
    manifests: &[&LoadedManifest],
) -> Result<BTreeMap<String, String>> {
    let strict = std::env::var("GITHUB_ACTIONS").is_ok_and(|value| value == "true");
    let mut output = BTreeMap::new();
    for loaded in manifests {
        let Some(name) = &loaded.manifest.e2e.image else {
            continue;
        };
        let path = directory.join(format!("{name}.json"));
        let text = fs::read_to_string(&path)
            .into_diagnostic()
            .wrap_err_with(|| format!("missing tested image artifact {}", path.display()))?;
        let artifact: ImageArtifact = serde_json::from_str(&text)
            .into_diagnostic()
            .wrap_err_with(|| format!("invalid tested image artifact {}", path.display()))?;
        if &artifact.name != name {
            bail!(
                "{}: artifact name {:?} does not match {name:?}",
                path.display(),
                artifact.name
            );
        }
        if strict && !is_pinned_image(&artifact.image) {
            bail!(
                "{}: image {:?} must be a digest-pinned ghcr.io/metorial reference",
                path.display(),
                artifact.image
            );
        }
        output.insert(name.clone(), artifact.image);
    }
    Ok(output)
}

fn is_pinned_image(image: &str) -> bool {
    let Some((repository, digest)) = image.split_once("@sha256:") else {
        return false;
    };
    repository
        .strip_prefix("ghcr.io/metorial/")
        .is_some_and(|name| {
            !name.is_empty()
                && name
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        })
        && digest.len() == 64
        && digest
            .chars()
            .all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c))
}

fn env_files(
    project: &ProjectRoot,
    manifests: &[&LoadedManifest],
    dependencies: &[Service],
    suts: &[Service],
    root_values: &BTreeMap<String, String>,
) -> Result<Vec<EnvFile>> {
    let mut files = BTreeMap::<String, BTreeMap<String, String>>::new();
    let packages = discover_packages(&project.root)?;
    for (package, values) in dev::database_owner_environments(manifests, root_values)? {
        let directory = packages
            .iter()
            .find(|candidate| candidate.name == package)
            .ok_or_else(|| miette::miette!("unknown database package {package:?}"))?;
        files
            .entry(relative(&project.root, &directory.directory.join(".env")))
            .or_default()
            .extend(values);
    }
    for service in dependencies.iter().chain(suts) {
        let path = if service.directory == "." {
            ".env".to_string()
        } else {
            format!("{}/.env", service.directory)
        };
        files.entry(path).or_default().extend(service.env.clone());
    }
    Ok(files
        .into_iter()
        .map(|(path, values)| EnvFile { path, values })
        .collect())
}

fn prepare_steps(
    manifests: &[&LoadedManifest],
    root_values: &BTreeMap<String, String>,
) -> Result<Vec<Step>> {
    let env = process_environment(root_values);
    let turbo_step = |label: String, task: &str, filters: &[String], concurrency, env| Step {
        label,
        cwd: ".".into(),
        command: ["bun", "x", "turbo"]
            .into_iter()
            .map(String::from)
            .chain(turbo::run_args(task, filters, concurrency))
            .collect(),
        env,
    };
    let mut steps = Vec::new();
    let database_packages = dev::database_packages(manifests);
    if !database_packages.is_empty() {
        for (label, task) in [
            ("Generating database clients", "control:db:generate"),
            ("Pushing database schemas", "control:db:push"),
        ] {
            steps.push(turbo_step(
                label.into(),
                task,
                &database_packages,
                Some(3),
                env.clone(),
            ));
        }
    }
    steps.push(Step {
        label: "Building packages".into(),
        cwd: ".".into(),
        command: vec!["bun".into(), "run".into(), "build".into()],
        env: env.clone(),
    });
    for loaded in manifests {
        let name = package_name(loaded);
        let mut manifest_env = environment::all_for_manifest(loaded, root_values)?;
        manifest_env.extend(env.clone());
        for script in &loaded.manifest.prepare {
            steps.push(turbo_step(
                format!("Preparing {name}: {script}"),
                script,
                std::slice::from_ref(&name),
                None,
                manifest_env.clone(),
            ));
        }
    }
    Ok(steps)
}

fn discover_packages(root: &Path) -> Result<Vec<PackageInfo>> {
    let mut output = Vec::new();
    let mut names = BTreeSet::new();
    for entry in walkdir::WalkDir::new(root)
        .follow_links(false)
        .sort_by_file_name()
        .into_iter()
        .filter_entry(|entry| {
            !manifest::is_ignored_entry(entry)
                && !matches!(entry.file_name().to_str(), Some(".turbo" | "dist"))
        })
        .filter_map(std::result::Result::ok)
        .filter(|entry| entry.file_type().is_file() && entry.file_name() == "package.json")
    {
        let text = fs::read_to_string(entry.path())
            .into_diagnostic()
            .wrap_err_with(|| format!("could not read {}", entry.path().display()))?;
        let Ok(value) = serde_json::from_str::<Value>(&text) else {
            continue;
        };
        let Some(name) = value.get("name").and_then(Value::as_str) else {
            continue;
        };
        if !names.insert(name.to_string()) {
            continue;
        }
        let scripts = value
            .get("scripts")
            .and_then(Value::as_object)
            .into_iter()
            .flatten()
            .filter(|(_, command)| command.is_string())
            .map(|(script, _)| script.clone())
            .collect();
        output.push(PackageInfo {
            name: name.into(),
            directory: normalize_path(entry.path().parent().unwrap_or(root)),
            scripts,
        });
    }
    Ok(output)
}

fn print_summary(plan: &Plan) {
    let tests = plan
        .stacks
        .iter()
        .map(|stack| stack.tests.len())
        .sum::<usize>();
    println!(
        "E2E plan ({:?} mode): {tests} test package(s) across {} stack(s)",
        plan.mode,
        plan.stacks.len()
    );
    for (label, services) in [("dependencies", &plan.dependencies), ("suts", &plan.suts)] {
        let names = services
            .iter()
            .map(|service| service.name.as_str())
            .collect::<Vec<_>>();
        println!(
            "  {label}: {}",
            if names.is_empty() {
                "(none)".into()
            } else {
                names.join(", ")
            }
        );
    }
}

enum Mounts {
    Local { source: PathBuf, volume: String },
    Workspace(PathBuf),
}

fn render_compose(
    plan: &Plan,
    project_name: &str,
    runner_image: &str,
    mounts: &Mounts,
    run_dir: &Path,
) -> Value {
    let mut services = serde_json::Map::new();
    services.insert(
        "postgres-db2".into(),
        json!({
            "image": "postgres:17",
            "command": ["postgres", "-c", "max_connections=1000", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off"],
            "environment": { "POSTGRES_USER": "postgres", "POSTGRES_PASSWORD": "postgres" },
            "tmpfs": ["/var/lib/postgresql/data"],
            "healthcheck": { "test": ["CMD-SHELL", "pg_isready -U postgres -d postgres"], "interval": "1s", "timeout": "5s", "retries": 120 }
        }),
    );
    services.insert(
        "mongodb".into(),
        json!({
            "image": "mongo:7",
            "environment": { "MONGO_INITDB_ROOT_USERNAME": "mongo", "MONGO_INITDB_ROOT_PASSWORD": "mongo" },
            "tmpfs": ["/data/db", "/data/configdb"],
            "healthcheck": { "test": ["CMD-SHELL", "mongosh --quiet --username mongo --password mongo --authenticationDatabase admin --eval 'quit(db.runCommand({ ping: 1 }).ok ? 0 : 2)'"], "interval": "1s", "timeout": "5s", "retries": 120 }
        }),
    );
    services.insert(
        "redis-db".into(),
        json!({
            "image": "redis:7.4-alpine",
            "command": ["redis-server", "--save", "", "--appendonly", "no"],
            "healthcheck": { "test": ["CMD", "redis-cli", "ping"], "interval": "1s", "timeout": "3s", "retries": 120 }
        }),
    );
    services.insert(
        "nats-1".into(),
        json!({
            "image": "nats:2.11-alpine",
            "command": ["--jetstream", "--store_dir=/tmp/nats", "--http_port=8222"],
            "healthcheck": { "test": ["CMD-SHELL", "wget -q -O - http://127.0.0.1:8222/healthz >/dev/null"], "interval": "1s", "timeout": "3s", "retries": 120 }
        }),
    );
    if plan.object_storage {
        services.insert(
            "object-storage".into(),
            json!({
                "image": OBJECT_STORAGE_IMAGE,
                "platform": "linux/amd64",
                "environment": {
                    "RUST_LOG": "info",
                    "AWS_ACCESS_KEY_ID": "e2e",
                    "AWS_SECRET_ACCESS_KEY": "e2e",
                    "AWS_REGION": "us-east-1",
                    "OBJECT_STORE__SERVER__HOST": "0.0.0.0",
                    "OBJECT_STORE__SERVER__PORT": "52010",
                    "OBJECT_STORE__BACKEND__TYPE": "local",
                    "OBJECT_STORE__BACKEND__ROOT_PATH": "/app/data",
                    "OBJECT_STORE__BACKEND__REGION": "us-east-1",
                    "OBJECT_STORE__BACKEND__PHYSICAL_BUCKET": "e2e"
                },
                "tmpfs": ["/app/data:mode=1777"],
                "networks": { "default": { "aliases": ["services"] } },
                "healthcheck": { "test": ["CMD-SHELL", "curl -f http://localhost:52010/health || exit 1"], "interval": "1s", "timeout": "5s", "retries": 120 }
            }),
        );
    }
    services.insert(
        "gateway".into(),
        json!({
            "image": runner_image,
            "command": ["gateway"],
            "extra_hosts": [format!("{HOST_ALIAS}:host-gateway")],
            "healthcheck": { "test": ["CMD-SHELL", "test -f /tmp/control-e2e-gateway-ready"], "interval": "1s", "timeout": "3s", "retries": 60 }
        }),
    );

    let mut volumes = vec![json!({
        "type": "bind",
        "source": escape(&run_dir.to_string_lossy()),
        "target": "/e2e"
    })];
    let mut top_level_volumes = serde_json::Map::new();
    match mounts {
        Mounts::Local { source, volume } => {
            volumes.push(json!({
                "type": "bind",
                "source": escape(&source.to_string_lossy()),
                "target": "/source",
                "read_only": true
            }));
            volumes.push(json!({ "type": "volume", "source": volume, "target": "/workspace" }));
            top_level_volumes.insert(volume.clone(), json!({ "external": true }));
        }
        Mounts::Workspace(workspace) => {
            volumes.push(json!({
                "type": "bind",
                "source": escape(&workspace.to_string_lossy()),
                "target": "/workspace"
            }));
        }
    }
    services.insert(
        "runner".into(),
        json!({
            "image": runner_image,
            "command": ["run", "/e2e/plan.json"],
            "network_mode": "service:gateway",
            "profiles": ["runner"],
            "init": true,
            "working_dir": "/workspace",
            "volumes": volumes,
            "environment": remote_cache_environment(std::env::var("TURBO_API").ok().as_deref()),
        }),
    );
    for service in plan.dependencies.iter().chain(&plan.suts) {
        let Some(image) = &service.image else {
            continue;
        };
        services.insert(
            app_service_name(&service.name),
            json!({
                "image": image,
                "network_mode": "service:gateway",
                "profiles": ["apps"],
                "init": true,
                "environment": service
                    .env
                    .iter()
                    .map(|(key, value)| (key.clone(), Value::String(escape(value))))
                    .collect::<serde_json::Map<_, _>>(),
            }),
        );
    }
    let mut compose = json!({ "name": project_name, "services": services });
    if !top_level_volumes.is_empty() {
        compose["volumes"] = Value::Object(top_level_volumes);
    }
    compose
}

fn app_service_name(package: &str) -> String {
    let sanitized = package
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    format!("app-{}", sanitized.trim_matches('-'))
}

fn escape(value: &str) -> String {
    value.replace('$', "$$")
}

struct Compose {
    root: PathBuf,
    file: PathBuf,
}

impl Compose {
    fn args(&self, args: &[&str]) -> Vec<String> {
        ["compose", "--file"]
            .into_iter()
            .map(String::from)
            .chain([self.file.to_string_lossy().into_owned()])
            .chain(args.iter().map(|arg| arg.to_string()))
            .collect()
    }

    async fn run(&self, args: &[&str]) -> Result<()> {
        process::run("docker", &self.args(args), &self.root, &BTreeMap::new()).await
    }

    async fn quiet(&self, args: &[&str]) -> Result<()> {
        process::run_quiet("docker", &self.args(args), &self.root, &BTreeMap::new()).await
    }

    async fn output(&self, args: &[&str]) -> Result<String> {
        let args = self.args(args);
        let args = args.iter().map(String::as_str).collect::<Vec<_>>();
        process::output("docker", &args, &self.root).await
    }
}

async fn execute(compose: &Compose, plan: &Plan) -> Result<()> {
    let mut infrastructure = INFRASTRUCTURE.to_vec();
    if plan.object_storage {
        infrastructure.push("object-storage");
    }
    infrastructure.push("gateway");
    println!("Starting e2e infrastructure: {}", infrastructure.join(", "));
    let mut args = vec!["up", "--detach", "--wait", "--wait-timeout", "180"];
    args.extend(&infrastructure);
    compose
        .run(&args)
        .await
        .wrap_err("e2e infrastructure did not become healthy")?;
    create_databases(compose, plan).await?;

    if plan.mode == Mode::Images {
        let timeout = Duration::from_secs(plan.health_timeout_seconds);
        for (label, services) in [("dependencies", &plan.dependencies), ("suts", &plan.suts)] {
            if services.is_empty() {
                continue;
            }
            let names = services
                .iter()
                .map(|service| app_service_name(&service.name))
                .collect::<Vec<_>>();
            println!("Starting e2e {label}: {}", names.join(", "));
            let mut args = vec!["up", "--detach", "--no-deps"];
            args.extend(names.iter().map(String::as_str));
            compose.run(&args).await?;
            wait_for_health(compose, services, timeout).await?;
        }
    }

    compose
        .run(&["run", "--rm", "--no-deps", "-T", "runner"])
        .await
        .wrap_err("e2e tests failed")
}

async fn create_databases(compose: &Compose, plan: &Plan) -> Result<()> {
    let env = BTreeMap::new();
    for database in &plan.postgres {
        let mut database = database.clone();
        database.compose = Some(compose.file.clone());
        database.service = Some("postgres-db2".into());
        docker::wait_postgres(&compose.root, &compose.root, &database, &env).await?;
        docker::create_postgres(&compose.root, &compose.root, &database, &env)
            .await
            .wrap_err_with(|| format!("could not create database {}", database.database))?;
    }
    for database in &plan.mongo {
        let mut database = database.clone();
        database.compose = Some(compose.file.clone());
        database.service = Some("mongodb".into());
        docker::wait_mongo(&compose.root, &compose.root, &database, &env).await?;
        docker::create_mongo(&compose.root, &compose.root, &database, &env)
            .await
            .wrap_err_with(|| format!("could not create database {}", database.database))?;
    }
    Ok(())
}

async fn wait_for_health(compose: &Compose, services: &[Service], timeout: Duration) -> Result<()> {
    let deadline = Instant::now() + timeout;
    let mut pending = services
        .iter()
        .flat_map(|service| service.health.iter().map(move |check| (service, check)))
        .collect::<Vec<_>>();
    loop {
        let mut remaining = Vec::new();
        for (service, check) in pending {
            if !probe(compose, check).await {
                remaining.push((service, check));
            }
        }
        if remaining.is_empty() {
            return Ok(());
        }
        let exited = compose
            .output(&[
                "ps",
                "--all",
                "--status",
                "exited",
                "--format",
                "{{.Service}}",
            ])
            .await
            .unwrap_or_default();
        for (service, _) in &remaining {
            let name = app_service_name(&service.name);
            if exited.lines().any(|line| line.trim() == name) {
                let logs = compose
                    .output(&["logs", "--no-color", "--tail", "80", &name])
                    .await
                    .unwrap_or_default();
                bail!(
                    "e2e service {} exited before becoming healthy:\n{logs}",
                    service.name
                );
            }
        }
        if Instant::now() >= deadline {
            let urls = remaining
                .iter()
                .map(|(service, check)| format!("{} ({})", service.name, check.url))
                .collect::<Vec<_>>();
            bail!(
                "e2e services did not become healthy within {}s: {}",
                timeout.as_secs(),
                urls.join(", ")
            );
        }
        pending = remaining;
        sleep(Duration::from_secs(1)).await;
    }
}

async fn probe(compose: &Compose, check: &HealthUrl) -> bool {
    let Ok(code) = compose
        .output(&[
            "exec",
            "-T",
            "gateway",
            "curl",
            "--silent",
            "--output",
            "/dev/null",
            "--max-time",
            "3",
            "--write-out",
            "%{http_code}",
            &check.url,
        ])
        .await
    else {
        return false;
    };
    let Ok(code) = code.trim().parse::<u16>() else {
        return false;
    };
    match check.status {
        Some(status) => code == status,
        None => (200..300).contains(&code),
    }
}

async fn ensure_runner_image(root: &Path, assets: &Path) -> Result<String> {
    let mut hasher = DefaultHasher::new();
    for file in ["Dockerfile", "entrypoint.sh"] {
        fs::read(assets.join(file))
            .into_diagnostic()
            .wrap_err_with(|| format!("could not read {}", assets.join(file).display()))?
            .hash(&mut hasher);
    }
    let image = format!("metorial-control-e2e:{:016x}", hasher.finish());
    if process::run_quiet(
        "docker",
        &["image".into(), "inspect".into(), image.clone()],
        root,
        &BTreeMap::new(),
    )
    .await
    .is_ok()
    {
        return Ok(image);
    }
    println!("Building e2e runner image {image}");
    process::run(
        "docker",
        &[
            "build".into(),
            "--progress".into(),
            "plain".into(),
            "--tag".into(),
            image.clone(),
            "--file".into(),
            assets.join("Dockerfile").to_string_lossy().into_owned(),
            assets.to_string_lossy().into_owned(),
        ],
        root,
        &BTreeMap::new(),
    )
    .await
    .wrap_err("could not build the e2e runner image")?;
    Ok(image)
}

fn package_name(loaded: &LoadedManifest) -> String {
    loaded
        .manifest
        .package
        .as_ref()
        .map(|package| package.name.clone())
        .unwrap_or_else(|| loaded.path.display().to_string())
}

fn relative(root: &Path, path: &Path) -> String {
    let root = normalize_path(root);
    let path = normalize_path(path);
    match path.strip_prefix(&root) {
        Ok(relative) if relative.as_os_str().is_empty() => ".".into(),
        Ok(relative) => relative.to_string_lossy().into_owned(),
        Err(_) => path.to_string_lossy().into_owned(),
    }
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut output = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                output.pop();
            }
            other => output.push(other.as_os_str()),
        }
    }
    output
}

fn glob_match(pattern: &Path, path: &Path) -> bool {
    let segments = |path: &Path| {
        path.components()
            .map(|component| component.as_os_str().to_string_lossy().into_owned())
            .collect::<Vec<_>>()
    };
    match_segments(&segments(pattern), &segments(path))
}

fn match_segments(pattern: &[String], path: &[String]) -> bool {
    match pattern.first() {
        None => path.is_empty(),
        Some(segment) if segment == "**" => {
            (0..=path.len()).any(|skip| match_segments(&pattern[1..], &path[skip..]))
        }
        Some(segment) => {
            !path.is_empty()
                && wildcard(segment, &path[0])
                && match_segments(&pattern[1..], &path[1..])
        }
    }
}

fn wildcard(pattern: &str, value: &str) -> bool {
    fn matches(pattern: &[char], value: &[char]) -> bool {
        match pattern.first() {
            None => value.is_empty(),
            Some('*') => (0..=value.len()).any(|skip| matches(&pattern[1..], &value[skip..])),
            Some(character) => {
                value.first() == Some(character) && matches(&pattern[1..], &value[1..])
            }
        }
    }
    let pattern = pattern.chars().collect::<Vec<_>>();
    let value = value.chars().collect::<Vec<_>>();
    matches(&pattern, &value)
}

fn short_hash(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:012x}", hasher.finish() & 0xffff_ffff_ffff)
}

fn write_json(path: &Path, value: &impl Serialize) -> Result<()> {
    let mut text = serde_json::to_string_pretty(value).into_diagnostic()?;
    text.push('\n');
    fs::write(path, text)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not write {}", path.display()))
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;

    fn write_package(
        root: &Path,
        directory: &str,
        name: &str,
        scripts: &[&str],
        manifest: Option<&str>,
    ) {
        let directory = root.join(directory);
        fs::create_dir_all(&directory).unwrap();
        let scripts = scripts
            .iter()
            .map(|script| format!("\"{script}\":\"true\""))
            .collect::<Vec<_>>()
            .join(",");
        fs::write(
            directory.join("package.json"),
            format!(r#"{{"name":"{name}","scripts":{{{scripts}}}}}"#),
        )
        .unwrap();
        if let Some(manifest) = manifest {
            fs::write(directory.join("control.toml"), manifest).unwrap();
        }
    }

    fn project(root: &Path) -> ProjectRoot {
        ProjectRoot {
            kind: RootKind::Standalone,
            root: root.to_path_buf(),
            oss: root.to_path_buf(),
        }
    }

    fn options(filters: &[&str], images: Option<PathBuf>) -> Options {
        Options {
            filters: filters.iter().map(|filter| filter.to_string()).collect(),
            images,
            workspace: None,
            keep: false,
            plan_only: true,
            concurrency: None,
        }
    }

    fn fixture(root: &Path) {
        fs::write(root.join("control.toml"), "mode='both'").unwrap();
        write_package(
            root,
            "db",
            "@x/db",
            &["control:db:generate", "control:db:push"],
            None,
        );
        write_package(
            root,
            "services/worker",
            "@x/worker",
            &["e2e:start"],
            Some(
                "name='@x/worker'\n[[health]]\nport=12121\npath='/'\n[e2e]\nstart=['e2e:start']\nimage='worker'",
            ),
        );
        write_package(
            root,
            "services/signal",
            "@x/signal",
            &["e2e:start"],
            Some(
                "name='@x/signal'\n[endpoints.rpc]\nport=4400\nhealth='/ping'\n[e2e]\nstart=['e2e:start']\nimage='signal'",
            ),
        );
        write_package(
            root,
            "services/api",
            "@x/api",
            &["e2e:start"],
            Some(
                r#"
                name = "@x/api"
                dependencies = [{ identifier = "@x/signal", env = [{ endpoint = "rpc", key = "SIGNAL_URL", value = "http://{{HOSTNAME}}:{{PORT}}" }] }]
                [endpoints.api]
                port = 4310
                health = "/ping"
                [dev.env]
                SECRET = true
                [dev.db.main]
                name = "app"
                engine = "postgres"
                env = "DATABASE_URL"
                package = "@x/db"
                [e2e]
                start = ["e2e:start"]
                image = "app-api"
                tests = ["../../modules/*"]
                services = ["@x/worker"]
                [[e2e.resources]]
                type = "object-storage"
                [e2e.env]
                AWS_REGION = "us-east-1"
                "#,
            ),
        );
        write_package(
            root,
            "modules/users",
            "@x/module-users",
            &["test:e2e"],
            None,
        );
        write_package(
            root,
            "modules/files",
            "@x/module-files",
            &["test:e2e"],
            None,
        );
    }

    #[test]
    fn plans_dependencies_suts_and_test_environment() {
        let temp = tempdir().unwrap();
        fixture(temp.path());
        let manifests = manifest::discover(temp.path()).unwrap();
        let plan = build_plan(&project(temp.path()), &manifests, &options(&[], None)).unwrap();

        assert_eq!(plan.mode, Mode::Local);
        assert_eq!(
            plan.dependencies
                .iter()
                .map(|s| s.name.as_str())
                .collect::<Vec<_>>(),
            ["@x/signal", "@x/worker"]
        );
        assert_eq!(plan.suts.len(), 1);
        let api = &plan.suts[0];
        assert_eq!(api.directory, "services/api");
        assert_eq!(api.env["SIGNAL_URL"], "http://localhost:4400");
        assert_eq!(api.env["AWS_REGION"], "us-east-1");
        assert!(!api.env.contains_key("SECRET"));
        assert_eq!(
            api.env["DATABASE_URL"],
            "postgresql://postgres:postgres@127.0.0.1:35432/app"
        );
        assert_eq!(
            api.health,
            vec![HealthUrl {
                url: "http://localhost:4310/ping".into(),
                status: None
            }]
        );
        assert_eq!(plan.stacks[0].tests, ["@x/module-files", "@x/module-users"]);
        let endpoints: Value =
            serde_json::from_str(&plan.stacks[0].env["CONTROL_E2E_ENDPOINTS"]).unwrap();
        assert_eq!(endpoints["@x/signal"]["rpc"], "http://localhost:4400");
        assert!(plan.object_storage);
        assert_eq!(plan.postgres.len(), 1);
        assert!(plan.files.iter().any(|file| file.path == "db/.env"));
        assert!(
            plan.files
                .iter()
                .any(|file| file.path == "services/api/.env")
        );
        assert!(
            plan.prepare
                .iter()
                .any(|step| step.command.contains(&"control:db:push".to_string()))
        );
    }

    #[test]
    fn filters_tests_by_package_and_stack() {
        let temp = tempdir().unwrap();
        fixture(temp.path());
        let manifests = manifest::discover(temp.path()).unwrap();
        let project = project(temp.path());
        let plan = build_plan(&project, &manifests, &options(&["*-users"], None)).unwrap();
        assert_eq!(plan.stacks[0].tests, ["@x/module-users"]);
        let plan = build_plan(&project, &manifests, &options(&["@x/api"], None)).unwrap();
        assert_eq!(plan.stacks[0].tests.len(), 2);
        assert!(build_plan(&project, &manifests, &options(&["@x/nope"], None)).is_err());
    }

    #[test]
    fn requires_health_start_and_test_scripts() {
        let temp = tempdir().unwrap();
        fixture(temp.path());
        let project = project(temp.path());

        write_package(
            temp.path(),
            "services/worker",
            "@x/worker",
            &["e2e:start"],
            Some("name='@x/worker'\n[e2e]\nstart=['e2e:start']"),
        );
        let manifests = manifest::discover(temp.path()).unwrap();
        let error = build_plan(&project, &manifests, &options(&[], None)).unwrap_err();
        assert!(
            error.to_string().contains("declares no health check"),
            "{error}"
        );

        write_package(
            temp.path(),
            "services/worker",
            "@x/worker",
            &[],
            Some("name='@x/worker'\n[[health]]\nport=12121\npath='/'"),
        );
        let manifests = manifest::discover(temp.path()).unwrap();
        let error = build_plan(&project, &manifests, &options(&[], None)).unwrap_err();
        assert!(error.to_string().contains("no [e2e] start"), "{error}");

        fixture(temp.path());
        write_package(temp.path(), "modules/broken", "@x/module-broken", &[], None);
        let manifests = manifest::discover(temp.path()).unwrap();
        let error = build_plan(&project, &manifests, &options(&[], None)).unwrap_err();
        assert!(
            error
                .to_string()
                .contains("does not declare a \"test:e2e\""),
            "{error}"
        );
    }

    #[test]
    fn images_mode_requires_artifacts_and_renders_app_containers() {
        let temp = tempdir().unwrap();
        fixture(temp.path());
        let manifests = manifest::discover(temp.path()).unwrap();
        let project = project(temp.path());
        let images = temp.path().join("images");
        fs::create_dir_all(&images).unwrap();
        assert!(build_plan(&project, &manifests, &options(&[], Some(images.clone()))).is_err());

        for name in ["app-api", "worker", "signal"] {
            fs::write(
                images.join(format!("{name}.json")),
                format!(r#"{{"name":"{name}","image":"ghcr.io/metorial/{name}@sha256:{}","sourceRevision":"abc"}}"#, "a".repeat(64)),
            )
            .unwrap();
        }
        let plan = build_plan(&project, &manifests, &options(&[], Some(images))).unwrap();
        assert!(plan.files.is_empty() && plan.prepare.is_empty());
        let compose = render_compose(
            &plan,
            "control-e2e-test",
            "runner:latest",
            &Mounts::Workspace(temp.path().into()),
            temp.path(),
        );
        let api = &compose["services"]["app-x-api"];
        assert_eq!(api["network_mode"], "service:gateway");
        assert_eq!(
            api["image"],
            format!("ghcr.io/metorial/app-api@sha256:{}", "a".repeat(64))
        );
        assert_eq!(
            compose["services"]["object-storage"]["networks"]["default"]["aliases"][0],
            "services"
        );
        assert_eq!(compose["services"]["runner"]["profiles"][0], "runner");
    }

    #[test]
    fn keys_stack_caches_on_service_fingerprints_and_environment() {
        let temp = tempdir().unwrap();
        fixture(temp.path());
        let manifests = manifest::discover(temp.path()).unwrap();
        let mut plan = build_plan(&project(temp.path()), &manifests, &options(&[], None)).unwrap();
        assert_eq!(
            plan.stacks[0].services,
            ["@x/api", "@x/signal", "@x/worker"]
        );

        let names = ["@x/api", "@x/signal", "@x/worker"]
            .map(String::from)
            .into_iter()
            .collect::<BTreeSet<_>>();
        let summary = r#"warning
{"tasks":[
  {"taskId":"@x/api#e2e:fingerprint","hash":"a1"},
  {"taskId":"@x/signal#e2e:fingerprint","hash":"s1"},
  {"taskId":"@x/worker#e2e:fingerprint","hash":"w1"},
  {"taskId":"@x/db#e2e:fingerprint","hash":"d1"}
]}"#;
        let fingerprints = parse_fingerprints(summary, &names).unwrap();
        assert_eq!(fingerprints.len(), 3);
        assert!(parse_fingerprints(r#"{"tasks":[]}"#, &names).is_err());

        attach_cache_keys(&mut plan, &fingerprints);
        let inputs = plan.stacks[0].cache_key_inputs.as_ref().unwrap();
        assert_eq!(inputs["mode"], "local");
        assert_eq!(inputs["services"]["@x/signal"]["fingerprint"], "s1");
        assert_eq!(
            inputs["services"]["@x/api"]["env"]["SIGNAL_URL"],
            "http://localhost:4400"
        );
        assert!(inputs["env"]["CONTROL_E2E_ENDPOINTS"].is_string());
    }

    #[test]
    fn forwards_the_remote_cache_through_the_host_gateway() {
        assert!(remote_cache_environment(None).is_empty());
        assert_eq!(
            remote_cache_environment(Some("http://127.0.0.1:8787")),
            [
                "TURBO_API=http://host.docker.internal:8787",
                "TURBO_TEAM",
                "TURBO_TOKEN",
                "TURBO_REMOTE_CACHE_SIGNATURE_KEY"
            ]
            .map(|value| Value::String(value.into()))
        );
        assert_eq!(
            container_url("https://cache.example.com/v8"),
            "https://cache.example.com/v8"
        );
        assert_eq!(
            container_url("http://localhost/"),
            "http://host.docker.internal/"
        );

        let temp = tempdir().unwrap();
        fixture(temp.path());
        let manifests = manifest::discover(temp.path()).unwrap();
        let plan = build_plan(&project(temp.path()), &manifests, &options(&[], None)).unwrap();
        let compose = render_compose(
            &plan,
            "control-e2e-test",
            "runner:latest",
            &Mounts::Workspace(temp.path().into()),
            temp.path(),
        );
        assert_eq!(
            compose["services"]["gateway"]["extra_hosts"][0],
            "host.docker.internal:host-gateway"
        );
    }

    #[test]
    fn rejects_port_collisions_in_the_shared_namespace() {
        let temp = tempdir().unwrap();
        fixture(temp.path());
        write_package(
            temp.path(),
            "services/worker",
            "@x/worker",
            &["e2e:start"],
            Some("name='@x/worker'\n[[health]]\nport=4310\npath='/'\n[e2e]\nstart=['e2e:start']"),
        );
        let manifests = manifest::discover(temp.path()).unwrap();
        let error = build_plan(&project(temp.path()), &manifests, &options(&[], None)).unwrap_err();
        assert!(
            error.to_string().contains("both listen on port 4310"),
            "{error}"
        );
    }

    #[test]
    fn matches_globs_and_wildcards() {
        let path = Path::new("/r/products/users/modules/user");
        assert!(glob_match(Path::new("/r/products/*/modules/*"), path));
        assert!(glob_match(Path::new("/r/**/modules/user"), path));
        assert!(!glob_match(Path::new("/r/products/*"), path));
        assert!(wildcard("@metorial/module-*", "@metorial/module-user"));
        assert!(!wildcard("@metorial/module-*", "@metorial/api"));
        assert_eq!(
            normalize_path(Path::new("/r/services/api/../../apis/./core")),
            PathBuf::from("/r/apis/core")
        );
        assert!(is_pinned_image(&format!(
            "ghcr.io/metorial/app-api@sha256:{}",
            "0".repeat(64)
        )));
        assert!(!is_pinned_image("ghcr.io/metorial/app-api:latest"));
    }
}
