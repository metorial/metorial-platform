use std::{
    collections::{BTreeMap, BTreeSet, hash_map::DefaultHasher},
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use miette::{IntoDiagnostic, Result, WrapErr, bail};

use crate::{
    environment,
    infrastructure::{self, RenderOptions, Requirements},
    manifest::{self, LoadedManifest},
    process,
    root::{ProjectRoot, RootKind},
    workspace_dev,
};

pub async fn run(project: &ProjectRoot, selectors: &[String], all: bool) -> Result<()> {
    if std::env::var("CONTROL_WORKSPACE_ID").is_ok() {
        bail!(
            "`control test e2e` manages Docker itself; run it on the Docker host, not inside a workspace container"
        );
    }
    if all && !selectors.is_empty() {
        bail!("`control test e2e --all` cannot be combined with package selectors");
    }
    if !all && selectors.is_empty() {
        bail!("`control test e2e` requires at least one package selector or `--all`");
    }
    process::run_quiet(
        "docker",
        &["version".into()],
        &project.root,
        &Default::default(),
    )
    .await
    .wrap_err("Docker is required for `control test e2e`")?;

    let manifests = manifest::discover(&project.root)?;
    let selected = if all {
        manifests
            .iter()
            .filter(|loaded| loaded.manifest.test.e2e.is_some())
            .filter_map(|loaded| {
                loaded
                    .manifest
                    .package
                    .as_ref()
                    .map(|package| package.name.clone())
            })
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>()
    } else {
        selectors.to_vec()
    };

    for (index, selector) in selected.iter().enumerate() {
        let target_project = project_for_selector(project, &manifests, selector)?;
        println!(
            "Running E2E suite {}/{}: {selector}",
            index + 1,
            selected.len()
        );
        run_one(&target_project, selector).await?;
    }
    Ok(())
}

fn project_for_selector(
    project: &ProjectRoot,
    manifests: &[LoadedManifest],
    selector: &str,
) -> Result<ProjectRoot> {
    let matches = manifests
        .iter()
        .filter(|loaded| {
            loaded
                .manifest
                .package
                .as_ref()
                .is_some_and(|package| package.name == selector)
        })
        .collect::<Vec<_>>();
    if matches.len() != 1 {
        bail!(
            "E2E selector {selector:?} must resolve to exactly one package (resolved to {})",
            matches.len()
        );
    }

    let mut target = project.clone();
    if project.kind == RootKind::Enterprise && matches[0].path.starts_with(&project.oss) {
        target.kind = RootKind::Standalone;
        target.root = project.oss.clone();
    }
    Ok(target)
}

async fn run_one(project: &ProjectRoot, selector: &str) -> Result<()> {
    let mut manifests = manifest::discover(&project.root)?;
    configure_e2e_manifests(&mut manifests)?;
    let npm_packages = discover_npm_packages(&project.root)?;
    let plan = build_plan(&manifests, &npm_packages, selector, &project.kind)?;
    let root_environment = e2e_root_environment(project)?;
    let task_environment = task_environment(&plan.sources, &plan.sources, &root_environment)?;

    let assets = workspace_dev::test_assets(project);
    let image = workspace_dev::ensure_image(&project.root, &assets, false).await?;
    let generated = generate(
        project,
        &plan,
        &plan.sources,
        &root_environment,
        &task_environment,
        &image,
        &run_identifier(project, selector),
    )?;
    for volume in &generated.cache_volumes {
        process::run_quiet(
            "docker",
            &["volume".into(), "create".into(), volume.clone()],
            &project.root,
            &root_environment,
        )
        .await
        .wrap_err_with(|| format!("could not create persistent E2E cache volume {volume}"))?;
    }
    let compose_args = compose_args(&generated.compose, &generated.project);
    let mut down = compose_args.clone();
    down.extend(["down".into(), "--volumes".into(), "--remove-orphans".into()]);
    let _ = process::run_quiet("docker", &down, &project.root, &root_environment).await;

    println!("Starting fresh E2E environment for {selector}");
    let supports_attach = process::output("docker", &["compose", "up", "--help"], &project.root)
        .await
        .ok()
        .is_some_and(|help| help.contains("--attach"));
    let mut up = compose_args.clone();
    up.extend([
        "up".into(),
        "--abort-on-container-exit".into(),
        "--exit-code-from".into(),
        "control-e2e".into(),
    ]);
    if supports_attach {
        up.extend(["--attach".into(), "control-e2e".into()]);
    }
    let result = process::run("docker", &up, &project.root, &root_environment)
        .await
        .wrap_err("E2E Docker environment failed");
    println!("Cleaning up E2E containers and volumes");
    let cleanup = process::run("docker", &down, &project.root, &root_environment)
        .await
        .wrap_err("could not clean up the E2E Docker environment");
    let generated_cleanup = fs::remove_dir_all(&generated.directory)
        .into_diagnostic()
        .wrap_err("could not remove the generated E2E run directory");
    println!(
        "E2E test result for {selector}: {}",
        test_result(result.is_ok())
    );
    match (result, cleanup) {
        (Err(error), _) => Err(error),
        (Ok(()), Err(error)) => Err(error),
        (Ok(()), Ok(())) => generated_cleanup,
    }
}

fn test_result(succeeded: bool) -> &'static str {
    if succeeded { "PASSED" } else { "FAILED" }
}

#[derive(Debug, Clone)]
struct NpmPackage {
    name: String,
    directory: PathBuf,
}

#[derive(Debug)]
enum TestTarget<'a> {
    Control(&'a LoadedManifest),
    Npm(&'a NpmPackage),
}

#[derive(Debug)]
struct TestPlan<'a> {
    main: &'a LoadedManifest,
    sources: Vec<&'a LoadedManifest>,
    tests: Vec<TestTarget<'a>>,
}

fn configure_e2e_manifests(manifests: &mut [LoadedManifest]) -> Result<()> {
    let mut reserved = BTreeSet::from([2379, 2380, 4222, 5432, 6379, 27017]);
    let mut listeners = Vec::new();
    for loaded in manifests.iter_mut() {
        for database in loaded.manifest.postgres.values_mut() {
            database.host = "postgres-db2".into();
            database.port = 5432;
            database.user = "postgres".into();
            database.password = "postgres".into();
            database.compose = None;
            database.service = None;
        }
        for database in loaded.manifest.mongo.values_mut() {
            database.host = "mongodb".into();
            database.port = 27017;
            database.user = Some("mongo".into());
            database.password = Some("mongo".into());
            database.auth_source = Some("admin".into());
            database.compose = None;
            database.service = None;
        }
        for endpoint in loaded.manifest.endpoints.values_mut() {
            let listener = (30000..60000)
                .filter(|port| !reserved.contains(port))
                .find_map(|port| {
                    std::net::TcpListener::bind(("127.0.0.1", port))
                        .ok()
                        .map(|listener| (port, listener))
                })
                .ok_or_else(|| miette::miette!("could not allocate an E2E endpoint port"))?;
            reserved.insert(listener.0);
            endpoint.port = listener.0;
            endpoint.bind_port = None;
            listeners.push(listener.1);
        }
    }
    manifest::refresh_dependency_endpoints(manifests);
    manifest::validate_dependency_endpoints(manifests)?;
    Ok(())
}

fn e2e_root_environment(project: &ProjectRoot) -> Result<BTreeMap<String, String>> {
    let mut environment = environment::root_environment(project)?;
    environment.insert("METORIAL_HOSTNAME".into(), "localhost".into());
    environment.insert("TURBO_TELEMETRY_DISABLED".into(), "1".into());
    environment.insert("DO_NOT_TRACK".into(), "1".into());
    environment.insert("CONTROL_SERVICE_REDIS".into(), "redis-db:6379".into());
    environment.insert("CONTROL_SERVICE_NATS".into(), "nats-1:4222".into());
    environment.insert("CONTROL_SERVICE_ETCD".into(), "etcd:2379".into());
    for (key, port) in [
        ("CONTROL_PORT_POSTGRES", 35432),
        ("CONTROL_PORT_MONGO", 32707),
        ("CONTROL_PORT_REDIS", 36379),
        ("CONTROL_PORT_NATS", 34222),
        ("CONTROL_PORT_ETCD_CLIENT", 32379),
        ("CONTROL_PORT_ETCD_PEER", 32380),
    ] {
        environment.insert(key.into(), port.to_string());
    }
    Ok(environment)
}

fn task_environment(
    active_manifests: &[&LoadedManifest],
    all_manifests: &[&LoadedManifest],
    root_environment: &BTreeMap<String, String>,
) -> Result<BTreeMap<String, String>> {
    let mut output = root_environment.clone();
    // Database values from packages outside the active graph must not leak
    // through the process environment and override their mounted local dotenv.
    output.remove("DATABASE_URL");
    for name in all_manifests.iter().flat_map(|loaded| {
        loaded
            .manifest
            .postgres
            .keys()
            .chain(loaded.manifest.mongo.keys())
    }) {
        output.remove(name);
    }
    let mut database_values = BTreeMap::<String, String>::new();
    for loaded in active_manifests {
        let resolved = environment::all_for_manifest(loaded, root_environment)?;
        for name in loaded
            .manifest
            .postgres
            .keys()
            .chain(loaded.manifest.mongo.keys())
            .filter(|name| name.as_str() != "DATABASE_URL")
        {
            let value = resolved
                .get(name)
                .expect("declared database environment was resolved");
            if let Some(previous) = database_values.insert(name.clone(), value.clone())
                && previous != *value
            {
                bail!("conflicting E2E database environment {name:?}: {previous:?} and {value:?}");
            }
        }
    }
    output.extend(database_values);
    Ok(output)
}

fn discover_npm_packages(root: &Path) -> Result<BTreeMap<String, Vec<NpmPackage>>> {
    let mut paths = walkdir::WalkDir::new(root)
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
        .map(|entry| entry.into_path())
        .collect::<Vec<_>>();
    paths.sort();
    let mut packages = BTreeMap::new();
    for path in paths {
        let value: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(&path)
                .into_diagnostic()
                .wrap_err_with(|| format!("could not read {}", path.display()))?,
        )
        .into_diagnostic()
        .wrap_err_with(|| format!("invalid {}", path.display()))?;
        let Some(name) = value.get("name").and_then(serde_json::Value::as_str) else {
            continue;
        };
        let package = NpmPackage {
            name: name.into(),
            directory: path.parent().unwrap_or(root).to_path_buf(),
        };
        packages
            .entry(name.to_string())
            .or_insert_with(Vec::new)
            .push(package);
    }
    Ok(packages)
}

fn build_plan<'a>(
    manifests: &'a [LoadedManifest],
    npm_packages: &'a BTreeMap<String, Vec<NpmPackage>>,
    selector: &str,
    kind: &RootKind,
) -> Result<TestPlan<'a>> {
    let selected = manifest::select(manifests, &[selector.to_string()], kind)?;
    let named = selected
        .into_iter()
        .filter(|loaded| loaded.manifest.package.is_some())
        .collect::<Vec<_>>();
    if named.len() != 1 {
        bail!(
            "E2E selector {selector:?} must resolve to exactly one package (resolved to {})",
            named.len()
        );
    }
    let main = named[0];
    let e2e = main.manifest.test.e2e.as_ref().ok_or_else(|| {
        miette::miette!(
            "package {:?} has not opted into E2E tests with [test.e2e]",
            package_name(main).unwrap_or(selector)
        )
    })?;
    let dependencies = manifest::dependency_closure(manifests, &[main], kind)?;
    let mut sources = dependencies.clone();
    sources.push(main);

    let mut tests = vec![TestTarget::Control(main)];
    let mut names = BTreeSet::new();
    names.insert(package_name(main)?.to_string());
    for name in &e2e.packages {
        let matches = npm_packages
            .get(name)
            .ok_or_else(|| miette::miette!("unknown npm workspace E2E package {name:?}"))?;
        if matches.len() != 1 {
            bail!(
                "npm workspace E2E package {name:?} is ambiguous; found {} package.json files: {}",
                matches.len(),
                matches
                    .iter()
                    .map(|package| package.directory.display().to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            );
        }
        let package = &matches[0];
        if names.insert(package.name.clone()) {
            tests.push(TestTarget::Npm(package));
        }
    }
    Ok(TestPlan {
        main,
        sources,
        tests,
    })
}

struct Generated {
    directory: PathBuf,
    compose: PathBuf,
    project: String,
    cache_volumes: Vec<String>,
}

fn generate(
    project: &ProjectRoot,
    plan: &TestPlan<'_>,
    all_manifests: &[&LoadedManifest],
    root_environment: &BTreeMap<String, String>,
    task_environment: &BTreeMap<String, String>,
    image: &str,
    run_id: &str,
) -> Result<Generated> {
    let directory = project.root.join(".control/test").join(run_id);
    let runners = directory.join("runners");
    if directory.exists() {
        fs::remove_dir_all(&directory)
            .into_diagnostic()
            .wrap_err("could not reset generated E2E workspace")?;
    }
    fs::create_dir_all(&runners).into_diagnostic()?;
    let overlays = directory.join("env");
    fs::create_dir_all(&overlays).into_diagnostic()?;

    let main_test_environment = control_test_environment(plan.main, root_environment)?;
    let main_test_env_file = overlays.join("main.env");
    environment::write_dotenv(&main_test_env_file, &main_test_environment)?;
    let main_directory = plan.main.path.parent().unwrap_or(&project.root);
    let mut environment_mounts = BTreeMap::new();
    insert_environment_mount(
        &mut environment_mounts,
        container_path(project, &main_directory.join(".env")),
        main_test_env_file.clone(),
    )?;
    insert_environment_mount(
        &mut environment_mounts,
        container_path(project, &main_directory.join(".env.test")),
        main_test_env_file.clone(),
    )?;
    for (index, loaded) in all_manifests.iter().enumerate() {
        if loaded.path == plan.main.path {
            continue;
        }
        if !environment::has_values(loaded) {
            continue;
        }
        let manifest_environment = source_environment(plan, loaded, root_environment)?;
        let manifest_env_file = overlays.join(format!("manifest-{index}.env"));
        environment::write_dotenv(&manifest_env_file, &manifest_environment)?;
        let manifest_directory = loaded.path.parent().unwrap_or(&project.root);
        insert_environment_mount(
            &mut environment_mounts,
            container_path(project, &manifest_directory.join(".env")),
            manifest_env_file,
        )?;
    }
    let npm_packages = discover_npm_packages(&project.root)?;
    for (index, (package, values)) in database_owner_environments(plan, root_environment)?
        .into_iter()
        .enumerate()
    {
        let matches = npm_packages
            .get(&package)
            .ok_or_else(|| miette::miette!("unknown database package {package:?}"))?;
        if matches.len() != 1 {
            bail!(
                "database package {package:?} is ambiguous; found {} package.json files",
                matches.len()
            );
        }
        let owner_env_file = overlays.join(format!("database-owner-{index}.env"));
        environment::write_dotenv(&owner_env_file, &values)?;
        environment_mounts.insert(
            container_path(project, &matches[0].directory.join(".env")),
            owner_env_file,
        );
    }
    let environment_mounts = environment_mounts
        .into_iter()
        .map(|(target, source)| (source, target))
        .collect::<Vec<_>>();

    let mut script = String::from(
        "#!/usr/bin/env bash\n\
         set -Eeuo pipefail\n\
         pids=()\n\
         cleanup() {\n\
           status=$?\n\
           trap - EXIT INT TERM\n\
           if ((${#pids[@]})); then kill \"${pids[@]}\" 2>/dev/null || true; fi\n\
           for pid in \"${pids[@]}\"; do wait \"$pid\" 2>/dev/null || true; done\n\
           exit \"$status\"\n\
         }\n\
         trap cleanup EXIT INT TERM\n\
         check_children() {\n\
           for pid in \"${pids[@]}\"; do\n\
             kill -0 \"$pid\" 2>/dev/null || {\n\
               echo \"Development command $pid exited before readiness\" >&2\n\
               ps -ef >&2 || true\n\
               ss -ltnp >&2 || true\n\
               exit 1\n\
             }\n\
           done\n\
         }\n\
         echo 'Installing E2E container dependencies'\n\
         bun install\n",
    );
    let control_test_manifests = plan
        .tests
        .iter()
        .filter_map(|target| match target {
            TestTarget::Control(loaded) => Some(*loaded),
            TestTarget::Npm(_) => None,
        })
        .collect::<Vec<_>>();
    let requirements = Requirements::from_manifests(&plan.sources);
    script.push_str(&provisioning_script(
        &plan.sources,
        &control_test_manifests,
        &requirements,
    ));
    let root_env_file = runners.join("root.env");
    environment::write_dotenv(&root_env_file, task_environment)?;
    let root_env = shell_quote(&container_path(project, &root_env_file));
    let database_packages = database_packages(&plan.sources);
    if !database_packages.is_empty() {
        let filters = database_packages
            .iter()
            .map(|package| format!(" --filter={}", shell_quote(package)))
            .collect::<String>();
        script.push_str(&format!(
            "echo 'Generating selected database clients'\n\
             bun --env-file={root_env} x turbo run control:db:generate --ui=stream --concurrency=3{filters}\n\
             echo 'Pushing selected database schemas'\n\
             bun --env-file={root_env} x turbo run control:db:push --ui=stream --concurrency=3{filters}\n"
        ));
    }

    let build_filters = plan
        .sources
        .iter()
        .map(|loaded| {
            Ok(format!(
                " --filter={}",
                shell_quote(&format!("{}...", package_name(loaded)?))
            ))
        })
        .collect::<Result<String>>()?;
    script.push_str(&format!(
        "echo 'Building selected E2E package dependency graphs'\n\
         bun --env-file={root_env} x turbo run build --ui=stream --env-mode=loose --concurrency=3{build_filters}\n"
    ));

    let mut runner_index = 0;

    for loaded in &plan.sources {
        let package_environment = source_environment(plan, loaded, root_environment)?;
        let prepares = loaded
            .manifest
            .test
            .e2e
            .as_ref()
            .and_then(|e2e| e2e.prepare.as_ref())
            .unwrap_or(&loaded.manifest.prepare);
        for prepare in prepares {
            let env_file = runners.join(format!("prepare-{runner_index}.env"));
            environment::write_dotenv(&env_file, &package_environment)?;
            script.push_str(&format!(
                "echo {}\n\
                 bun --env-file={} x turbo run {} --ui=stream --filter={}\n",
                shell_quote(&format!(
                    "Preparing {}: turbo run {prepare}",
                    package_name(loaded)?
                )),
                shell_quote(&container_path(project, &env_file)),
                shell_quote(prepare),
                shell_quote(package_name(loaded)?),
            ));
            runner_index += 1;
        }
    }

    let mut ready_ports = BTreeSet::new();
    for loaded in &plan.sources {
        let source_name = package_name(loaded)?;
        let manifest_environment = source_environment(plan, loaded, root_environment)?;
        let cwd = loaded.path.parent().unwrap_or(&project.root);
        for endpoint in loaded.manifest.endpoints.values() {
            if !ready_ports.contains(&endpoint.port) {
                script.push_str(&format!(
                    "if nc -z 127.0.0.1 {port} 2>/dev/null; then\n\
                       echo {}\n\
                       ss -ltnp || true\n\
                       exit 1\n\
                     fi\n",
                    shell_quote(&format!(
                        "Port {} is already occupied before starting {source_name}",
                        endpoint.port
                    )),
                    port = endpoint.port,
                ));
            }
        }
        let source_runs = loaded
            .manifest
            .test
            .e2e
            .as_ref()
            .filter(|e2e| !e2e.start.is_empty())
            .map(|e2e| {
                e2e.start
                    .iter()
                    .enumerate()
                    .map(|(index, command)| {
                        (
                            format!("e2e-{}", index + 1),
                            format!("bun run {command}"),
                            BTreeMap::new(),
                        )
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_else(|| {
                loaded
                    .manifest
                    .run
                    .iter()
                    .map(|(name, run)| {
                        (
                            name.clone(),
                            e2e_source_command(&run.command),
                            run.env.clone(),
                        )
                    })
                    .collect()
            });
        for (run_name, command, run_env) in &source_runs {
            let mut run_environment = manifest_environment.clone();
            run_environment.extend(environment::resolve(run_env, root_environment)?);
            let runner = runners.join(format!("{runner_index}.mjs"));
            let env_file = runners.join(format!("{runner_index}.env"));
            environment::write_dotenv(&env_file, &run_environment)?;
            write_runner(&runner, &container_path(project, cwd), command)?;
            script.push_str(&format!(
                "echo {}\nbun --env-file={} {} &\npids+=(\"$!\")\n",
                shell_quote(&format!("Starting {source_name}:{run_name}")),
                shell_quote(&container_path(project, &env_file)),
                shell_quote(&container_path(project, &runner)),
            ));
            runner_index += 1;
        }
        if source_runs.is_empty() {
            continue;
        }
        if loaded.manifest.endpoints.is_empty() {
            script.push_str(&format!(
                "echo {}\n\
                 for attempt in 1 2; do sleep 1; check_children; done\n\
                 echo {}\n",
                shell_quote(&format!("Verifying worker {source_name} survives startup")),
                shell_quote(&format!("Worker {source_name} survived startup")),
            ));
            continue;
        }
        for endpoint in loaded.manifest.endpoints.values() {
            let port = endpoint.port;
            if !ready_ports.insert(port) {
                script.push_str(&format!(
                    "echo {}\n\
                     for attempt in 1 2; do sleep 1; check_children; done\n\
                     echo {}\n",
                    shell_quote(&format!(
                        "Port {port} was already exposed by an earlier source; verifying {source_name} survives instead"
                    )),
                    shell_quote(&format!(
                        "Duplicate port {port} survival check passed for {source_name}"
                    )),
                ));
                continue;
            }
            script.push_str(&format!(
                "echo {}\n\
                 ready=0\n\
                 for attempt in $(seq 1 120); do\n\
                   check_children\n\
                   if nc -z 127.0.0.1 {port}; then ready=1; break; fi\n\
                   sleep 1\n\
                 done\n\
                 if ((ready == 0)); then echo {} >&2; exit 1; fi\n\
                 check_children\n\
                 echo {}\n",
                shell_quote(&format!("Waiting for {source_name} port {port}")),
                shell_quote(&format!(
                    "Port {port} for {source_name} did not become ready within 120 seconds"
                )),
                shell_quote(&format!("Port {port} ready for {source_name}")),
            ));
        }
        let stable_ports = loaded
            .manifest
            .endpoints
            .values()
            .map(|endpoint| {
                format!(
                    "nc -z 127.0.0.1 {} || {{ echo {} >&2; ss -ltnp >&2 || true; exit 1; }}\n",
                    endpoint.port,
                    shell_quote(&format!(
                        "Port {} disappeared while stabilizing {source_name}",
                        endpoint.port
                    ))
                )
            })
            .collect::<String>();
        script.push_str(&format!(
            "echo {}\n\
             for attempt in 1 2; do\n\
               sleep 1\n\
               check_children\n\
               {stable_ports}\
             done\n\
             echo {}\n",
            shell_quote(&format!("Stabilizing {source_name}")),
            shell_quote(&format!("{source_name} remained stable")),
        ));
    }

    let main_environment = main_test_environment;
    for target in &plan.tests {
        let (name, cwd, test_command, test_environment) = match target {
            TestTarget::Control(loaded) => {
                let cwd = loaded.path.parent().unwrap_or(&project.root);
                (
                    package_name(loaded)?,
                    cwd,
                    e2e_test_command(&cwd.join("package.json"))?,
                    control_test_environment(loaded, root_environment)?,
                )
            }
            TestTarget::Npm(package) => (
                package.name.as_str(),
                package.directory.as_path(),
                e2e_test_command(&package.directory.join("package.json"))?,
                main_environment.clone(),
            ),
        };
        let Some(test_command) = test_command else {
            script.push_str(&format!(
                "echo {} >&2\n",
                shell_quote(&format!(
                    "warning: package {name:?} has no test:e2e script; skipping"
                ))
            ));
            continue;
        };
        let runner = runners.join(format!("{runner_index}.mjs"));
        let env_file = runners.join(format!("{runner_index}.env"));
        environment::write_dotenv(&env_file, &test_environment)?;
        write_runner(&runner, &container_path(project, cwd), &test_command)?;
        script.push_str(&format!(
            "echo {}\nbun --env-file={} {}\n",
            shell_quote(&format!("Running test:e2e for {name}")),
            shell_quote(&container_path(project, &env_file)),
            shell_quote(&container_path(project, &runner)),
        ));
        runner_index += 1;
    }
    fs::write(directory.join("run.sh"), script)
        .into_diagnostic()
        .wrap_err("could not write generated E2E runner")?;

    let compose = directory.join("docker-compose.yml");
    let checkout_id = checkout_id(&project.root);
    let cache_volumes = cache_volume_names(&checkout_id);
    let mut reserved_ports = all_manifests
        .iter()
        .flat_map(|loaded| loaded.manifest.endpoints.values())
        .map(|endpoint| endpoint.port)
        .collect::<BTreeSet<_>>();
    reserved_ports.extend([32707, 35432]);
    let reserved_ports = reserved_ports
        .iter()
        .map(u16::to_string)
        .collect::<Vec<_>>()
        .join(",");
    fs::write(
        &compose,
        render_compose(
            &requirements,
            &project.root,
            image,
            &container_path(project, &directory.join("run.sh")),
            &cache_volumes,
            &environment_mounts,
            &reserved_ports,
        ),
    )
    .into_diagnostic()
    .wrap_err("could not write generated E2E Compose file")?;
    Ok(Generated {
        directory,
        compose,
        project: format!("control_test_{checkout_id}_{run_id}"),
        cache_volumes,
    })
}

fn database_packages(manifests: &[&LoadedManifest]) -> Vec<String> {
    manifests
        .iter()
        .flat_map(|loaded| {
            loaded
                .manifest
                .postgres
                .values()
                .map(|database| database.package.clone())
                .chain(
                    loaded
                        .manifest
                        .mongo
                        .values()
                        .map(|database| database.package.clone()),
                )
        })
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn database_owner_environments(
    plan: &TestPlan<'_>,
    root_environment: &BTreeMap<String, String>,
) -> Result<BTreeMap<String, BTreeMap<String, String>>> {
    let mut output = BTreeMap::<String, BTreeMap<String, String>>::new();
    for loaded in &plan.sources {
        let resolved = source_environment(plan, loaded, root_environment)?;
        for (name, database) in &loaded.manifest.postgres {
            output
                .entry(database.package.clone())
                .or_default()
                .insert(name.clone(), resolved[name].clone());
        }
        for (name, database) in &loaded.manifest.mongo {
            output
                .entry(database.package.clone())
                .or_default()
                .insert(name.clone(), resolved[name].clone());
        }
    }
    Ok(output)
}

fn insert_environment_mount(
    mounts: &mut BTreeMap<String, PathBuf>,
    target: String,
    source: PathBuf,
) -> Result<()> {
    if let Some(previous) = mounts.insert(target.clone(), source.clone())
        && previous != source
    {
        bail!(
            "multiple E2E environment overlays target {target:?}: {} and {}",
            previous.display(),
            source.display()
        );
    }
    Ok(())
}

fn provisioning_script(
    manifests: &[&LoadedManifest],
    control_test_manifests: &[&LoadedManifest],
    requirements: &Requirements,
) -> String {
    let mut postgres = manifests
        .iter()
        .flat_map(|loaded| loaded.manifest.postgres.values())
        .map(|database| database.database.clone())
        .collect::<BTreeSet<_>>();
    postgres.extend(
        control_test_manifests
            .iter()
            .flat_map(|loaded| loaded.manifest.postgres.values())
            .map(|database| test_database_name(&database.database)),
    );
    let database_ports = [
        requirements.postgres.then_some(35432),
        requirements.mongo.then_some(32707),
    ]
    .into_iter()
    .flatten()
    .map(|port| port.to_string())
    .collect::<Vec<_>>()
    .join(" ");
    let mut script = if database_ports.is_empty() {
        String::new()
    } else {
        format!(
            "echo 'Waiting for isolated database forwarding'\n\
         for port in {database_ports}; do\n\
           ready=0\n\
           for attempt in $(seq 1 60); do nc -z 127.0.0.1 \"$port\" && {{ ready=1; break; }}; sleep 1; done\n\
           if ((ready == 0)); then echo \"Database forwarding on port $port did not become ready\" >&2; exit 1; fi\n\
         done\n"
        )
    };
    if !postgres.is_empty() {
        script.push_str("echo 'Provisioning isolated Postgres databases'\n");
    }
    for database in &postgres {
        script.push_str(&format!(
            "psql 'postgresql://postgres:postgres@127.0.0.1:35432/postgres' \
             -v ON_ERROR_STOP=1 -v database={} <<'CONTROL_E2E_SQL'\n\
             SELECT format('CREATE DATABASE %I', :'database')\n\
             WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'database')\n\
             \\gexec\n\
             CONTROL_E2E_SQL\n",
            shell_quote(database)
        ));
    }
    script
}

fn control_test_environment(
    loaded: &LoadedManifest,
    root_environment: &BTreeMap<String, String>,
) -> Result<BTreeMap<String, String>> {
    let mut output = environment::all_for_manifest(loaded, root_environment)?;
    output.insert("NODE_ENV".into(), "test".into());
    set_test_database_urls(&mut output, loaded);
    Ok(output)
}

fn source_environment(
    plan: &TestPlan<'_>,
    loaded: &LoadedManifest,
    root_environment: &BTreeMap<String, String>,
) -> Result<BTreeMap<String, String>> {
    if loaded.path == plan.main.path {
        return control_test_environment(loaded, root_environment);
    }
    let mut output = environment::all_for_manifest(loaded, root_environment)?;
    for (name, database) in &loaded.manifest.postgres {
        if plan
            .main
            .manifest
            .postgres
            .values()
            .any(|main| main.package == database.package && main.database == database.database)
        {
            let mut test_database = database.clone();
            test_database.database = test_database_name(&database.database);
            output.insert(name.clone(), environment::postgres_url(&test_database));
        }
    }
    for (name, database) in &loaded.manifest.mongo {
        if plan
            .main
            .manifest
            .mongo
            .values()
            .any(|main| main.package == database.package && main.database == database.database)
        {
            let mut test_database = database.clone();
            test_database.database = test_database_name(&database.database);
            output.insert(name.clone(), environment::mongo_url(&test_database));
        }
    }
    Ok(output)
}

fn set_test_database_urls(output: &mut BTreeMap<String, String>, loaded: &LoadedManifest) {
    for (name, database) in &loaded.manifest.postgres {
        let mut test_database = database.clone();
        test_database.database = test_database_name(&database.database);
        output.insert(name.clone(), environment::postgres_url(&test_database));
    }
    for (name, database) in &loaded.manifest.mongo {
        let mut test_database = database.clone();
        test_database.database = test_database_name(&database.database);
        output.insert(name.clone(), environment::mongo_url(&test_database));
    }
}

fn test_database_name(database: &str) -> String {
    if database.ends_with("-test") {
        database.to_string()
    } else {
        format!("{database}-test")
    }
}

fn checkout_id(root: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    root.canonicalize()
        .unwrap_or_else(|_| root.to_path_buf())
        .hash(&mut hasher);
    format!("{:08x}", hasher.finish() as u32)
}

fn run_identifier(project: &ProjectRoot, selector: &str) -> String {
    let mut hasher = DefaultHasher::new();
    project.root.hash(&mut hasher);
    selector.hash(&mut hasher);
    std::process::id().hash(&mut hasher);
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
        .hash(&mut hasher);
    format!("{:08x}", hasher.finish() as u32)
}

fn cache_volume_names(checkout_id: &str) -> Vec<String> {
    [
        "node-modules",
        "bun-cache",
        "cargo-target",
        "cargo-registry",
        "go-build",
        "go-mod",
    ]
    .into_iter()
    .map(|suffix| format!("control-e2e-{checkout_id}-{suffix}"))
    .collect()
}

fn render_compose(
    requirements: &Requirements,
    root: &Path,
    image: &str,
    runner: &str,
    caches: &[String],
    environment_mounts: &[(PathBuf, String)],
    reserved_ports: &str,
) -> String {
    assert_eq!(caches.len(), 6, "all persistent E2E caches are required");
    let root = yaml_string(&root.to_string_lossy());
    let image = yaml_string(image);
    let runner = yaml_string(runner);
    let reserved_ports = yaml_string(reserved_ports);
    let cache_names = caches
        .iter()
        .map(|name| yaml_string(name))
        .collect::<Vec<_>>();
    let environment_mounts = environment_mounts
        .iter()
        .map(|(source, target)| {
            format!(
                "      - {{ type: bind, source: {}, target: {}, read_only: true }}\n",
                yaml_string(&source.to_string_lossy()),
                yaml_string(target)
            )
        })
        .collect::<String>();
    let services = infrastructure::render_service_blocks(
        requirements,
        &RenderOptions {
            project_name: None,
            network: "workspace-services",
            network_name: None,
            ports: None,
            restart: false,
        },
    );
    let depends_on_entries = requirements
        .service_names()
        .into_iter()
        .map(|name| format!("      {name}: {{ condition: service_healthy }}\n"))
        .collect::<String>();
    let depends_on = if depends_on_entries.is_empty() {
        String::new()
    } else {
        format!("    depends_on:\n{depends_on_entries}")
    };
    let infrastructure_volumes = infrastructure::volume_names(requirements)
        .into_iter()
        .map(|name| format!("  {name}:\n"))
        .collect::<String>();
    let service_environment = [
        requirements
            .postgres
            .then_some("      CONTROL_SERVICE_POSTGRES: postgres-db2:5432\n"),
        requirements
            .mongo
            .then_some("      CONTROL_SERVICE_MONGO: mongodb:27017\n"),
        requirements
            .redis
            .then_some("      CONTROL_SERVICE_REDIS: redis-db:6379\n"),
        requirements
            .nats
            .then_some("      CONTROL_SERVICE_NATS: nats-1:4222\n"),
        requirements
            .etcd
            .then_some("      CONTROL_SERVICE_ETCD: etcd:2379\n"),
    ]
    .into_iter()
    .flatten()
    .collect::<String>();
    let sysctls = if reserved_ports.is_empty() {
        String::new()
    } else {
        format!("    sysctls:\n      net.ipv4.ip_local_reserved_ports: {reserved_ports}\n")
    };
    format!(
        "services:\n\
{services}\
         \x20 control-e2e:\n\
         \x20   image: {image}\n\
         \x20   init: true\n\
{sysctls}\
         \x20   working_dir: /workspace\n\
         \x20   command: [\"/bin/bash\", {runner}]\n\
         \x20   environment:\n\
         \x20     CONTROL_WORKSPACE_ID: e2e\n\
{service_environment}\
         \x20     CARGO_TARGET_DIR: /control-cache/cargo-target\n\
         \x20     METORIAL_HOSTNAME: localhost\n\
         \x20   extra_hosts:\n\
         \x20     - mcp-test-server:127.0.0.1\n\
         \x20   volumes:\n\
         \x20     - {{ type: bind, source: {root}, target: /workspace }}\n\
{environment_mounts}\
         \x20     - node-modules:/workspace/node_modules\n\
         \x20     - cargo-target:/control-cache/cargo-target\n\
         \x20     - bun-cache:/root/.bun/install/cache\n\
         \x20     - cargo-registry:/opt/cargo/registry\n\
         \x20     - go-build:/root/.cache/go-build\n\
         \x20     - go-mod:/opt/go/pkg/mod\n\
         \x20   networks: [default, workspace-services]\n\
{depends_on}\
         networks:\n\
         \x20 workspace-services: {{ internal: true }}\n\
         volumes:\n\
{infrastructure_volumes}\
         \x20 node-modules: {{ external: true, name: {} }}\n\
         \x20 bun-cache: {{ external: true, name: {} }}\n\
         \x20 cargo-target: {{ external: true, name: {} }}\n\
         \x20 cargo-registry: {{ external: true, name: {} }}\n\
         \x20 go-build: {{ external: true, name: {} }}\n\
         \x20 go-mod: {{ external: true, name: {} }}\n",
        cache_names[0],
        cache_names[1],
        cache_names[2],
        cache_names[3],
        cache_names[4],
        cache_names[5],
    )
}

fn e2e_test_command(package_json: &Path) -> Result<Option<String>> {
    let value: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(package_json)
            .into_diagnostic()
            .wrap_err_with(|| format!("could not read {}", package_json.display()))?,
    )
    .into_diagnostic()
    .wrap_err_with(|| format!("invalid {}", package_json.display()))?;
    let Some(_) = value
        .get("scripts")
        .and_then(|scripts| scripts.get("test:e2e"))
        .and_then(serde_json::Value::as_str)
    else {
        return Ok(None);
    };
    Ok(Some("bun run test:e2e".into()))
}

fn write_runner(path: &Path, cwd: &str, command: &str) -> Result<()> {
    let cwd = serde_json::to_string(cwd).into_diagnostic()?;
    let command = serde_json::to_string(command).into_diagnostic()?;
    fs::write(
        path,
        format!(
            "let cwd = {cwd};\n\
             let env = {{ ...process.env, PATH: `${{cwd}}/node_modules/.bin:/workspace/node_modules/.bin:${{process.env.PATH ?? ''}}` }};\n\
             let child = Bun.spawn({{ cmd: ['/bin/sh', '-eu', '-c', {command}], cwd, env, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }});\n\
             for (let signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));\n\
             process.exit(await child.exited);\n"
        ),
    )
    .into_diagnostic()
}

fn package_name(loaded: &LoadedManifest) -> Result<&str> {
    loaded
        .manifest
        .package
        .as_ref()
        .map(|package| package.name.as_str())
        .ok_or_else(|| miette::miette!("E2E packages must have a name"))
}

fn container_path(project: &ProjectRoot, path: &Path) -> String {
    let relative = path.strip_prefix(&project.root).unwrap_or(path);
    Path::new("/workspace")
        .join(relative)
        .to_string_lossy()
        .into_owned()
}

fn yaml_string(value: &str) -> String {
    serde_json::to_string(value).expect("strings always serialize")
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn compose_args(compose: &Path, project: &str) -> Vec<String> {
    vec![
        "compose".into(),
        "--project-name".into(),
        project.into(),
        "--file".into(),
        compose.to_string_lossy().into_owned(),
    ]
}

fn e2e_source_command(command: &str) -> String {
    command
        .strip_prefix("bun --watch ")
        .map(|rest| format!("bun {rest}"))
        .unwrap_or_else(|| command.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disables_bun_watch_mode_for_e2e_sources() {
        assert_eq!(
            e2e_source_command("bun --watch ./src/server.ts"),
            "bun ./src/server.ts"
        );
        assert_eq!(e2e_source_command("cargo run"), "cargo run");
    }

    #[test]
    fn formats_post_cleanup_test_results() {
        assert_eq!(test_result(true), "PASSED");
        assert_eq!(test_result(false), "FAILED");
    }

    use tempfile::tempdir;

    fn package(root: &Path, directory: &str, control: Option<&str>, e2e: bool) {
        let directory = root.join(directory);
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join("package.json"),
            format!(
                r#"{{"name":"{directory_name}","scripts":{scripts}}}"#,
                directory_name = directory.file_name().unwrap().to_string_lossy(),
                scripts = if e2e {
                    r#"{"test:e2e":"true","dev:start":"true","test:start-e2e":"true","control:db:generate":"true","control:db:push":"true"}"#
                } else {
                    r#"{"dev:start":"true","test:start-e2e":"true","control:db:generate":"true","control:db:push":"true"}"#
                }
            ),
        )
        .unwrap();
        if let Some(control) = control {
            fs::write(directory.join("control.toml"), control).unwrap();
        }
    }

    fn set_package_scripts(root: &Path, directory: &str, scripts: &str) {
        fs::write(
            root.join(directory).join("package.json"),
            format!(r#"{{"name":"{directory}","scripts":{scripts}}}"#),
        )
        .unwrap();
    }

    #[test]
    fn runs_the_declared_package_e2e_script() {
        let temp = tempdir().unwrap();
        package(temp.path(), "service", None, false);
        set_package_scripts(
            temp.path(),
            "service",
            r#"{"test":"vitest run --configLoader native","test:e2e":"bun run test"}"#,
        );
        assert_eq!(
            e2e_test_command(&temp.path().join("service/package.json")).unwrap(),
            Some("bun run test:e2e".into())
        );
    }

    #[test]
    fn discovers_included_npm_packages_without_control_manifests() {
        let temp = tempdir().unwrap();
        package(temp.path(), "suite", None, true);
        fs::create_dir_all(temp.path().join("node_modules/ignored")).unwrap();
        fs::write(
            temp.path().join("node_modules/ignored/package.json"),
            r#"{"name":"ignored"}"#,
        )
        .unwrap();
        let packages = discover_npm_packages(temp.path()).unwrap();
        assert!(packages.contains_key("suite"));
        assert!(!packages.contains_key("ignored"));
    }

    #[test]
    fn requires_opt_in_and_orders_control_then_npm_tests() {
        let temp = tempdir().unwrap();
        package(temp.path(), "db", Some("name='db'"), true);
        package(
            temp.path(),
            "api",
            Some("name='api'\ndependencies=['db']\n[test.e2e]\npackages=['suite']"),
            true,
        );
        package(temp.path(), "suite", None, true);
        let mut manifests = manifest::discover(temp.path()).unwrap();
        configure_e2e_manifests(&mut manifests).unwrap();
        let npm = discover_npm_packages(temp.path()).unwrap();
        let plan = build_plan(&manifests, &npm, "api", &RootKind::Standalone).unwrap();
        assert!(matches!(plan.tests[0], TestTarget::Control(_)));
        assert!(matches!(plan.tests[1], TestTarget::Npm(_)));
        assert_eq!(plan.tests.len(), 2);
        assert_eq!(
            plan.sources
                .iter()
                .map(|loaded| package_name(loaded).unwrap())
                .collect::<Vec<_>>(),
            ["db", "api"]
        );

        package(temp.path(), "plain", Some("name='plain'"), false);
        let manifests = manifest::discover(temp.path()).unwrap();
        assert!(
            build_plan(&manifests, &npm, "plain", &RootKind::Standalone)
                .unwrap_err()
                .to_string()
                .contains("opted into")
        );
    }

    #[test]
    fn endpoint_only_dependencies_are_not_started_by_e2e() {
        let temp = tempdir().unwrap();
        package(
            temp.path(),
            "callback",
            Some("name='callback'\n[endpoints.http]\nport=4310"),
            false,
        );
        package(
            temp.path(),
            "api",
            Some(
                "name='api'\n[test.e2e]\n[[dependencies]]\nidentifier='callback'\nstart=false\n[[dependencies.env]]\nendpoint='http'\nkey='CALLBACK_URL'\nvalue='http://{{HOSTNAME}}:{{PORT}}'",
            ),
            true,
        );
        let manifests = manifest::discover(temp.path()).unwrap();
        let npm = discover_npm_packages(temp.path()).unwrap();
        let plan = build_plan(&manifests, &npm, "api", &RootKind::Standalone).unwrap();
        assert_eq!(
            plan.sources
                .iter()
                .map(|loaded| package_name(loaded).unwrap())
                .collect::<Vec<_>>(),
            ["api"]
        );
        let environment = environment::all_for_manifest(plan.main, &BTreeMap::new()).unwrap();
        assert_eq!(environment["CALLBACK_URL"], "http://localhost:4310");
    }

    #[test]
    fn infers_oss_mode_from_the_selected_manifest_location() {
        let temp = tempdir().unwrap();
        let oss = temp.path().join("oss");
        package(
            &oss,
            "api",
            Some("name='@metorial/app-api'\nmode='oss'\n[test.e2e]"),
            true,
        );
        package(
            temp.path(),
            "enterprise-api",
            Some("name='@metorial/mte-core-api'\nmode='enterprise'\n[test.e2e]"),
            true,
        );
        let manifests = manifest::discover(temp.path()).unwrap();
        let project = ProjectRoot {
            kind: RootKind::Enterprise,
            root: temp.path().into(),
            oss: oss.clone(),
        };

        let selected = project_for_selector(&project, &manifests, "@metorial/app-api").unwrap();
        assert_eq!(selected.kind, RootKind::Standalone);
        assert_eq!(selected.root, oss);

        let selected =
            project_for_selector(&project, &manifests, "@metorial/mte-core-api").unwrap();
        assert_eq!(selected.kind, RootKind::Enterprise);
        assert_eq!(selected.root, temp.path());
    }

    #[test]
    fn rejects_unknown_included_npm_package() {
        let temp = tempdir().unwrap();
        package(
            temp.path(),
            "api",
            Some("name='api'\n[test.e2e]\npackages=['missing']"),
            true,
        );
        let manifests = manifest::discover(temp.path()).unwrap();
        let npm = discover_npm_packages(temp.path()).unwrap();
        assert!(build_plan(&manifests, &npm, "api", &RootKind::Standalone).is_err());
    }

    #[test]
    fn compose_is_self_contained_and_declares_fresh_infrastructure() {
        let caches = cache_volume_names("abcd1234");
        let compose = render_compose(
            &Requirements {
                postgres: true,
                mongo: true,
                redis: true,
                nats: true,
                etcd: true,
            },
            Path::new("/code/project"),
            "metorial-control-dev:abc",
            "/workspace/.control/test/run.sh",
            &caches,
            &[(
                PathBuf::from("/code/project/.control/test/env/main.env"),
                "/workspace/service/.env.test".into(),
            )],
            "52010,52070",
        );
        for image in [
            "postgres:17",
            "mongo:8",
            "redis:7.4-alpine",
            "nats:2.11-alpine",
            "bitnamilegacy/etcd:latest",
        ] {
            assert!(compose.contains(image));
        }
        assert!(!compose.contains("include:"));
        assert!(!compose.contains("services.docker-compose.yml"));
        assert!(compose.contains("workspace-services: { internal: true }"));
        assert!(!compose.contains("services:127.0.0.1"));
        assert!(compose.contains("mcp-test-server:127.0.0.1"));
        assert!(compose.contains("net.ipv4.ip_local_reserved_ports: \"52010,52070\""));
        assert!(compose.contains("target: \"/workspace/service/.env.test\", read_only: true"));
        assert_eq!(compose.matches("healthcheck:").count(), 5);
        for cache in caches {
            assert!(compose.contains(&format!("external: true, name: \"{cache}\"")));
        }
        assert!(!compose.contains("postgres-data: { external: true"));
    }

    #[test]
    fn docker_compose_accepts_generated_schema_when_available() {
        if !std::process::Command::new("docker")
            .args(["compose", "version"])
            .output()
            .is_ok_and(|output| output.status.success())
        {
            return;
        }
        let temp = tempdir().unwrap();
        let path = temp.path().join("docker-compose.yml");
        fs::write(
            &path,
            render_compose(
                &Requirements {
                    postgres: true,
                    mongo: true,
                    redis: true,
                    nats: true,
                    etcd: true,
                },
                Path::new("/code/project"),
                "metorial-control-dev:abc",
                "/workspace/.control/test/run.sh",
                &cache_volume_names("abcd1234"),
                &[(
                    PathBuf::from("/code/project/.control/test/env/main.env"),
                    "/workspace/service/.env.test".into(),
                )],
                "52010,52070",
            ),
        )
        .unwrap();
        let output = std::process::Command::new("docker")
            .args(["compose", "--file"])
            .arg(&path)
            .arg("config")
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        fs::write(
            &path,
            render_compose(
                &Requirements::default(),
                Path::new("/code/project"),
                "metorial-control-dev:abc",
                "/workspace/.control/test/run.sh",
                &cache_volume_names("abcd1234"),
                &[],
                "",
            ),
        )
        .unwrap();
        let output = std::process::Command::new("docker")
            .args(["compose", "--file"])
            .arg(&path)
            .arg("config")
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[test]
    fn generated_runner_builds_source_dependency_graphs_and_uses_main_test_env_for_npm_suite() {
        let temp = tempdir().unwrap();
        package(temp.path(), "db", Some("name='db'"), false);
        package(
            temp.path(),
            "api",
            Some(
                "name='api'\ndependencies=['db']\n[dev]\nprepare=['seed']\nrun=['dev:start']\n[[dev.expose]]\nport=4310\n[dev.env]\nE2E_TOKEN='main-token'\n[dev.db.main]\nname='main-db'\nengine='postgres'\nenv='DATABASE_URL'\npackage='api'\n[test.e2e]\npackages=['suite']",
            ),
            true,
        );
        package(temp.path(), "suite", None, true);
        let manifests = manifest::discover(temp.path()).unwrap();
        let npm = discover_npm_packages(temp.path()).unwrap();
        let plan = build_plan(&manifests, &npm, "api", &RootKind::Standalone).unwrap();
        let all = manifest::select(&manifests, &[], &RootKind::Standalone).unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: temp.path().into(),
            oss: temp.path().into(),
        };
        generate(
            &project,
            &plan,
            &all,
            &BTreeMap::new(),
            &BTreeMap::new(),
            "dev:image",
            "test-run",
        )
        .unwrap();
        let runner = fs::read_to_string(temp.path().join(".control/test/test-run/run.sh")).unwrap();
        assert!(!runner.contains("mongosh"));
        assert!(
            runner.find("Provisioning isolated Postgres").unwrap()
                < runner.find("control:db:generate").unwrap()
        );
        assert!(runner.contains("main-db-test"));
        assert!(runner.contains("control:db:generate"));
        assert!(runner.contains("control:db:push"));
        assert!(runner.contains("turbo run build"));
        assert!(runner.contains("--filter='db...'"));
        assert!(runner.contains("--filter='api...'"));
        assert!(runner.contains("turbo run 'seed'"));
        assert!(runner.contains("Waiting for api port "));
        let install = runner
            .find("Installing E2E container dependencies")
            .unwrap();
        let database_push = runner.find("Pushing selected database schemas").unwrap();
        let build = runner
            .find("Building selected E2E package dependency graphs")
            .unwrap();
        let prepare = runner.find("Preparing api: turbo run seed").unwrap();
        let start = runner.find("Starting api:dev").unwrap();
        assert!(install < database_push);
        assert!(database_push < build);
        assert!(build < prepare);
        assert!(prepare < start);
        let env_files = fs::read_dir(temp.path().join(".control/test/test-run/runners"))
            .unwrap()
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "env"))
            .map(|entry| fs::read_to_string(entry.path()).unwrap())
            .collect::<Vec<_>>();
        assert!(
            env_files
                .iter()
                .filter(|contents| contents.contains("E2E_TOKEN=main-token"))
                .count()
                >= 2
        );
        assert!(
            env_files
                .iter()
                .any(|contents| contents.contains("/main-db-test"))
        );
        assert!(
            !env_files
                .iter()
                .any(|contents| contents.contains("/main-db\n"))
        );
    }

    #[test]
    fn empty_e2e_prepare_override_skips_development_prepare() {
        let temp = tempdir().unwrap();
        package(
            temp.path(),
            "api",
            Some("name='api'\n[dev]\nprepare=['frontend:build']\n[test.e2e]\nprepare=[]"),
            true,
        );
        let mut manifests = manifest::discover(temp.path()).unwrap();
        configure_e2e_manifests(&mut manifests).unwrap();
        let npm = discover_npm_packages(temp.path()).unwrap();
        let plan = build_plan(&manifests, &npm, "api", &RootKind::Standalone).unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: temp.path().into(),
            oss: temp.path().into(),
        };
        generate(
            &project,
            &plan,
            &plan.sources,
            &BTreeMap::new(),
            &BTreeMap::new(),
            "dev:image",
            "test-run",
        )
        .unwrap();
        let runner = fs::read_to_string(temp.path().join(".control/test/test-run/run.sh")).unwrap();
        assert!(!runner.contains("frontend:build"));
    }

    #[test]
    fn prepares_only_selected_database_owner_packages() {
        let temp = tempdir().unwrap();
        package(
            temp.path(),
            "db",
            Some(
                "name='db'\n[dev.db.main]\nname='db'\nengine='postgres'\nenv='DATABASE_URL'\npackage='db'",
            ),
            true,
        );
        set_package_scripts(
            temp.path(),
            "db",
            r#"{"test:e2e":"true","control:db:generate":"true","control:db:push":"true"}"#,
        );
        package(
            temp.path(),
            "api",
            Some(
                "name='api'\ndependencies=['db']\n[test.e2e]\n[dev]\nrun=['dev:start']\n[dev.db.main]\nname='api'\nengine='postgres'\nenv='DATABASE_URL'\npackage='api'",
            ),
            true,
        );
        set_package_scripts(
            temp.path(),
            "api",
            r#"{"test:e2e":"true","dev:start":"true","control:db:generate":"true","control:db:push":"true"}"#,
        );
        let mut manifests = manifest::discover(temp.path()).unwrap();
        configure_e2e_manifests(&mut manifests).unwrap();
        let npm = discover_npm_packages(temp.path()).unwrap();
        let plan = build_plan(&manifests, &npm, "api", &RootKind::Standalone).unwrap();
        let all = manifest::select(&manifests, &[], &RootKind::Standalone).unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: temp.path().into(),
            oss: temp.path().into(),
        };
        let roots = BTreeMap::from([("CONTROL_PORT_POSTGRES".into(), "35432".into())]);
        let tasks = task_environment(&plan.sources, &all, &roots).unwrap();
        generate(
            &project,
            &plan,
            &all,
            &roots,
            &tasks,
            "dev:image",
            "test-run",
        )
        .unwrap();

        let runner = fs::read_to_string(temp.path().join(".control/test/test-run/run.sh")).unwrap();
        let push = runner.find("Pushing selected database schemas").unwrap();
        let source = runner.find("Starting api:dev").unwrap();
        assert!(push < source);
        assert!(runner.contains("--filter='api'"));
        assert!(runner.contains("--filter='db'"));
        assert!(!runner.contains("Preparing test schema"));

        let api_env =
            fs::read_to_string(temp.path().join(".control/test/test-run/env/main.env")).unwrap();
        let db_env = fs::read_dir(temp.path().join(".control/test/test-run/env"))
            .unwrap()
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_name().to_string_lossy().starts_with("manifest-"))
            .map(|entry| fs::read_to_string(entry.path()).unwrap())
            .find(|contents| contents.contains("postgres-db2:5432/db"))
            .unwrap();
        assert!(api_env.contains("postgres-db2:5432/api-test"));
        assert!(db_env.contains("postgres-db2:5432/db"));
        assert!(!db_env.contains("db-test"));
        assert!(!api_env.contains("30000"));
        assert!(!db_env.contains("30000"));
    }

    #[test]
    fn gates_each_source_and_workers_before_starting_dependents() {
        let temp = tempdir().unwrap();
        package(
            temp.path(),
            "a",
            Some("name='a'\n[dev]\nrun=['dev:start']\n[[dev.expose]]\nport=4101"),
            false,
        );
        package(
            temp.path(),
            "worker",
            Some("name='worker'\ndependencies=['a']\n[dev]\nrun=['dev:start']"),
            false,
        );
        package(
            temp.path(),
            "b",
            Some(
                "name='b'\ndependencies=['worker']\n[test.e2e]\n[dev]\nrun=['dev:start']\n[[dev.expose]]\nport=4101",
            ),
            true,
        );
        let mut manifests = manifest::discover(temp.path()).unwrap();
        configure_e2e_manifests(&mut manifests).unwrap();
        let npm = discover_npm_packages(temp.path()).unwrap();
        let plan = build_plan(&manifests, &npm, "b", &RootKind::Standalone).unwrap();
        let all = manifest::select(&manifests, &[], &RootKind::Standalone).unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: temp.path().into(),
            oss: temp.path().into(),
        };
        generate(
            &project,
            &plan,
            &all,
            &BTreeMap::new(),
            &BTreeMap::new(),
            "dev:image",
            "test-run",
        )
        .unwrap();
        let runner = fs::read_to_string(temp.path().join(".control/test/test-run/run.sh")).unwrap();
        let start_a = runner.find("Starting a:dev").unwrap();
        let ready_a = runner.find(" ready for a").unwrap();
        let start_worker = runner.find("Starting worker:dev").unwrap();
        let worker_ready = runner.find("Worker worker survived startup").unwrap();
        let start_b = runner.find("Starting b:dev").unwrap();
        let ready_b = runner.find(" ready for b").unwrap();
        assert!(
            start_a < ready_a
                && ready_a < start_worker
                && start_worker < worker_ready
                && worker_ready < start_b
                && start_b < ready_b
        );
        assert!(runner.contains("Waiting for b port "));
        assert!(runner.matches("check_children").count() >= 4);
    }

    #[test]
    fn isolates_task_database_env_and_provisions_all_databases() {
        let temp = tempdir().unwrap();
        package(
            temp.path(),
            "api",
            Some(
                "name='api'\n[test.e2e]\n[dev.db.main]\nname='main-db'\nengine='postgres'\nenv='DATABASE_URL'\npackage='api'",
            ),
            true,
        );
        package(
            temp.path(),
            "cargo",
            Some(
                "name='cargo'\nmode='enterprise'\n[dev.db.cargo]\nname='cargo-db'\nengine='postgres'\nenv='CARGO_DATABASE_URL'\npackage='cargo'\n[dev.db.usage]\nname='usage-db'\nengine='mongodb'\nenv='USAGE_MONGO_URL'\npackage='cargo'",
            ),
            false,
        );
        let mut manifests = manifest::discover(temp.path()).unwrap();
        configure_e2e_manifests(&mut manifests).unwrap();
        let all = manifests.iter().collect::<Vec<_>>();
        let npm = discover_npm_packages(temp.path()).unwrap();
        let plan = build_plan(&manifests, &npm, "api", &RootKind::Standalone).unwrap();
        assert_eq!(plan.sources.len(), 1);
        let roots = BTreeMap::from([
            (
                "CARGO_DATABASE_URL".into(),
                "postgresql://stale:30000/cargo".into(),
            ),
            (
                "DATABASE_URL".into(),
                "postgresql://stale:30000/generic".into(),
            ),
            ("CONTROL_PORT_POSTGRES".into(), "30000".into()),
        ]);
        let tasks = task_environment(&plan.sources, &all, &roots).unwrap();
        assert!(!tasks.contains_key("CARGO_DATABASE_URL"));
        assert!(!tasks.contains_key("USAGE_MONGO_URL"));
        assert!(!tasks.contains_key("DATABASE_URL"));
        let script = provisioning_script(
            &plan.sources,
            &[],
            &Requirements::from_manifests(&plan.sources),
        );
        assert!(script.contains("main-db"));
        assert!(!script.contains("cargo-db"));
        assert!(!script.contains("mongosh"));

        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: temp.path().into(),
            oss: temp.path().into(),
        };
        generate(
            &project,
            &plan,
            &plan.sources,
            &roots,
            &tasks,
            "dev:image",
            "test-run",
        )
        .unwrap();
        let generated = temp.path().join(".control/test/test-run");
        let compose = fs::read_to_string(generated.join("docker-compose.yml")).unwrap();
        assert!(!compose.contains("target: \"/workspace/cargo/.env\", read_only: true"));
        let root_overlay = fs::read_to_string(generated.join("runners/root.env")).unwrap();
        assert!(
            !root_overlay
                .lines()
                .any(|line| line.starts_with("DATABASE_URL="))
        );
        assert!(
            !fs::read_to_string(generated.join("run.sh"))
                .unwrap()
                .contains("database='cargo-db'")
        );
    }

    #[test]
    fn mode_exclusive_database_envs_do_not_conflict_in_task_environment() {
        let temp = tempdir().unwrap();
        package(
            temp.path(),
            "oss-db",
            Some(
                "name='oss-db'\nmode='oss'\n[dev.db.global]\nname='metorial-oss-global'\nengine='postgres'\nenv='GLOBAL_DATABASE_URL'\npackage='oss-db'",
            ),
            false,
        );
        package(
            temp.path(),
            "enterprise-db",
            Some(
                "name='enterprise-db'\nmode='enterprise'\n[dev.db.global]\nname='metorial-enterprise-global'\nengine='postgres'\nenv='GLOBAL_DATABASE_URL'\npackage='enterprise-db'",
            ),
            false,
        );
        package(
            temp.path(),
            "oss-api",
            Some("name='oss-api'\nmode='oss'\ndependencies=['oss-db']\n[test.e2e]"),
            true,
        );
        package(
            temp.path(),
            "enterprise-api",
            Some(
                "name='enterprise-api'\nmode='enterprise'\ndependencies=['enterprise-db']\n[test.e2e]",
            ),
            true,
        );
        let mut manifests = manifest::discover(temp.path()).unwrap();
        configure_e2e_manifests(&mut manifests).unwrap();
        let npm = discover_npm_packages(temp.path()).unwrap();
        let all = manifests.iter().collect::<Vec<_>>();
        let roots = BTreeMap::from([(
            "GLOBAL_DATABASE_URL".into(),
            "postgresql://stale:30000/global".into(),
        )]);

        for (selector, kind, expected, unexpected) in [
            (
                "oss-api",
                RootKind::Standalone,
                "metorial-oss-global",
                "metorial-enterprise-global",
            ),
            (
                "enterprise-api",
                RootKind::Enterprise,
                "metorial-enterprise-global",
                "metorial-oss-global",
            ),
        ] {
            let plan = build_plan(&manifests, &npm, selector, &kind).unwrap();
            let tasks = task_environment(&plan.sources, &all, &roots).unwrap();
            assert!(tasks["GLOBAL_DATABASE_URL"].contains(expected));
            assert!(!tasks["GLOBAL_DATABASE_URL"].contains(unexpected));
        }
    }

    #[test]
    fn control_tests_use_and_provision_suffixed_databases() {
        let temp = tempdir().unwrap();
        package(
            temp.path(),
            "forge",
            Some(
                "name='@metorial/forge'\n[test.e2e]\n[dev.env]\nOBJECT_STORAGE_URL='http://services:52010'\nRELAY_URL='http://services:52110/metorial-relay'\n[dev.db.main]\nname='forge'\nengine='postgres'\nenv='DATABASE_URL'\npackage='forge'",
            ),
            true,
        );
        let mut manifests = manifest::discover(temp.path()).unwrap();
        configure_e2e_manifests(&mut manifests).unwrap();
        let forge = &manifests[0];
        let source = environment::all_for_manifest(forge, &BTreeMap::new()).unwrap();
        let test = control_test_environment(forge, &BTreeMap::new()).unwrap();
        assert_eq!(
            source["DATABASE_URL"],
            "postgresql://postgres:postgres@postgres-db2:5432/forge"
        );
        assert_eq!(
            test["DATABASE_URL"],
            "postgresql://postgres:postgres@postgres-db2:5432/forge-test"
        );
        assert_eq!(test["OBJECT_STORAGE_URL"], "http://services:52010");
        assert_eq!(test["RELAY_URL"], "http://services:52110/metorial-relay");
        assert_eq!(test["NODE_ENV"], "test");
        let script =
            provisioning_script(&[forge], &[forge], &Requirements::from_manifests(&[forge]));
        assert!(script.contains("database='forge'"));
        assert!(script.contains("database='forge-test'"));
        assert_eq!(test_database_name("already-test"), "already-test");
    }

    #[test]
    fn dependencies_share_the_main_test_database_for_the_same_owner() {
        let temp = tempdir().unwrap();
        package(temp.path(), "schema", None, false);
        package(
            temp.path(),
            "dependency",
            Some(
                "name='dependency'\n[dev.db.main]\nname='shared'\nengine='postgres'\nenv='DATABASE_URL'\npackage='schema'",
            ),
            false,
        );
        package(
            temp.path(),
            "api",
            Some(
                "name='api'\ndependencies=['dependency']\n[test.e2e]\n[dev.db.shared]\nname='shared'\nengine='postgres'\nenv='SHARED_DATABASE_URL'\npackage='schema'",
            ),
            true,
        );
        let mut manifests = manifest::discover(temp.path()).unwrap();
        configure_e2e_manifests(&mut manifests).unwrap();
        let npm = discover_npm_packages(temp.path()).unwrap();
        let plan = build_plan(&manifests, &npm, "api", &RootKind::Standalone).unwrap();
        let dependency = plan
            .sources
            .iter()
            .find(|loaded| loaded.manifest.package.as_ref().unwrap().name == "dependency")
            .unwrap();
        let environment = source_environment(&plan, dependency, &BTreeMap::new()).unwrap();
        assert!(environment["DATABASE_URL"].ends_with("/shared-test"));
        let owners = database_owner_environments(&plan, &BTreeMap::new()).unwrap();
        assert!(owners["schema"]["DATABASE_URL"].ends_with("/shared-test"));
        assert!(owners["schema"]["SHARED_DATABASE_URL"].ends_with("/shared-test"));
    }

    #[test]
    fn enterprise_core_api_dependencies_use_its_shared_test_databases() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../..");
        if !root
            .join("src/metorial/services/core-api/control.toml")
            .is_file()
        {
            return;
        }
        let mut manifests = manifest::discover(&root).unwrap();
        configure_e2e_manifests(&mut manifests).unwrap();
        let npm = discover_npm_packages(&root).unwrap();
        let plan = build_plan(
            &manifests,
            &npm,
            "@metorial/mte-core-api",
            &RootKind::Enterprise,
        )
        .unwrap();
        let dependency = plan
            .sources
            .iter()
            .find(|loaded| {
                loaded.manifest.package.as_ref().unwrap().name
                    == "@metorial-subspace/app-controller"
            })
            .unwrap();
        let environment = source_environment(
            &plan,
            dependency,
            &BTreeMap::from([
                ("CONTROL_PORT_POSTGRES".into(), "35432".into()),
                ("CONTROL_PORT_MONGO".into(), "32707".into()),
                ("CONTROL_PORT_REDIS".into(), "36379".into()),
                ("CONTROL_PORT_NATS".into(), "34222".into()),
                ("CONTROL_PORT_ETCD_CLIENT".into(), "32379".into()),
                ("CONTROL_PORT_ETCD_PEER".into(), "32380".into()),
                ("METORIAL_HOSTNAME".into(), "localhost".into()),
            ]),
        )
        .unwrap();
        assert!(environment["DATABASE_URL"].ends_with("/subspace-test"));
        assert!(!environment.contains_key("SUBSPACE_DATABASE_URL"));

        let project = ProjectRoot {
            kind: RootKind::Enterprise,
            root: root.clone(),
            oss: root.join("oss"),
        };
        let generated = generate(
            &project,
            &plan,
            &plan.sources,
            &BTreeMap::from([
                ("CONTROL_PORT_POSTGRES".into(), "35432".into()),
                ("CONTROL_PORT_MONGO".into(), "32707".into()),
                ("CONTROL_PORT_REDIS".into(), "36379".into()),
                ("CONTROL_PORT_NATS".into(), "34222".into()),
                ("CONTROL_PORT_ETCD_CLIENT".into(), "32379".into()),
                ("CONTROL_PORT_ETCD_PEER".into(), "32380".into()),
                ("METORIAL_HOSTNAME".into(), "localhost".into()),
            ]),
            &BTreeMap::new(),
            "dev:image",
            "shared-database-regression",
        )
        .unwrap();
        let controller_environment = fs::read_dir(generated.directory.join("runners"))
            .unwrap()
            .filter_map(std::result::Result::ok)
            .filter(|entry| {
                entry
                    .path()
                    .extension()
                    .is_some_and(|extension| extension == "env")
            })
            .map(|entry| fs::read_to_string(entry.path()).unwrap())
            .find(|contents| contents.contains("SUBSPACE_CONTROLLER_PORT="))
            .unwrap();
        assert!(controller_environment.contains("/subspace-test"));
        assert!(!controller_environment.contains("SUBSPACE_DATABASE_URL="));
        fs::remove_dir_all(generated.directory).unwrap();
    }

    #[test]
    fn overrides_stale_host_workspace_ports_for_e2e() {
        let temp = tempdir().unwrap();
        fs::create_dir_all(temp.path().join(".control")).unwrap();
        fs::write(
            temp.path().join(".control/workspace.json"),
            format!(
                r#"{{"id":"test","hostname":"test.localhost","branch":"test","source_root":{},"runtime":"host","service_ports":{{"postgres":30000,"mongo":30001,"redis":30002,"nats":30003,"etcd_client":30004,"etcd_peer":30005}}}}"#,
                serde_json::to_string(temp.path()).unwrap()
            ),
        )
        .unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: temp.path().into(),
            oss: temp.path().into(),
        };
        let environment = e2e_root_environment(&project).unwrap();
        assert_eq!(environment["CONTROL_PORT_POSTGRES"], "35432");
        assert_eq!(environment["CONTROL_PORT_MONGO"], "32707");
        assert_eq!(environment["METORIAL_HOSTNAME"], "localhost");
    }

    #[test]
    fn node_modules_cache_is_stable_external_and_mounted() {
        let first = cache_volume_names("checkout123");
        let second = cache_volume_names("checkout123");
        assert_eq!(first, second);
        assert_ne!(first, cache_volume_names("another-checkout"));
        assert_eq!(first[0], "control-e2e-checkout123-node-modules");
        let compose = render_compose(
            &Requirements {
                postgres: true,
                mongo: true,
                redis: true,
                nats: true,
                etcd: true,
            },
            Path::new("/code/project"),
            "dev:image",
            "/workspace/.control/test/run.sh",
            &first,
            &[],
            "52010,52070",
        );
        assert!(compose.contains("- node-modules:/workspace/node_modules"));
        assert!(compose.contains(
            "node-modules: { external: true, name: \"control-e2e-checkout123-node-modules\" }"
        ));
    }

    #[test]
    fn compose_arguments_are_isolated_by_project() {
        assert_eq!(
            compose_args(
                Path::new("/code/.control/test/docker-compose.yml"),
                "control_test_abcd"
            ),
            [
                "compose",
                "--project-name",
                "control_test_abcd",
                "--file",
                "/code/.control/test/docker-compose.yml"
            ]
        );
        assert_eq!(shell_quote("it's"), "'it'\"'\"'s'");
    }
}
