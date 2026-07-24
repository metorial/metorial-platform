use std::{
    collections::BTreeMap,
    io::{IsTerminal, stdin, stdout},
    path::Path,
};

use indicatif::{ProgressBar, ProgressStyle};
use miette::{Result, WrapErr, bail};

use crate::{
    docker, environment,
    infrastructure::Requirements,
    manifest::{self, LoadedManifest},
    process, proxy,
    root::ProjectRoot,
    turbo, workspace,
};

#[derive(Debug, Clone, Copy)]
pub enum DatabaseTask {
    Generate,
    Push,
}

pub async fn run(
    project: &ProjectRoot,
    selectors: &[String],
    no_docker: bool,
    no_prepare: bool,
    stop_docker: bool,
    dry_run: bool,
) -> Result<()> {
    if !dry_run {
        workspace::metadata(project).await?;
    }
    let mut manifests = manifest::discover(&project.root)?;
    workspace::configure_manifests(project, &mut manifests).await?;
    let externals = manifest::load_externals(&project.root, &mut manifests)?;
    let mut selected = manifest::select_with_dependencies_excluding(
        &manifests,
        selectors,
        &project.kind,
        &externals,
    )?;
    selected.retain(|loaded| {
        loaded
            .manifest
            .package
            .as_ref()
            .is_none_or(|package| !externals.contains(&package.name))
    });
    if selected.is_empty() {
        bail!("no control.toml manifests or run commands were selected");
    }
    let root_env = environment::root_environment(project)?;
    if dry_run {
        let packages = turbo::plan(&selected, &project.root, &root_env)?;
        println!("root: {}", project.root.display());
        println!(
            "infrastructure: {}",
            Requirements::from_manifests(&selected)
                .service_names()
                .join(", ")
        );
        if !no_prepare {
            let database_packages = database_packages(&selected);
            println!(
                "prepare: turbo run control:db:generate ({})",
                database_packages.join(", ")
            );
            println!(
                "prepare: turbo run control:db:push ({})",
                database_packages.join(", ")
            );
        }
        for loaded in &selected {
            let cwd = loaded.path.parent().unwrap_or(&project.root);
            for script in &loaded.manifest.prepare {
                println!(
                    "prepare [{}]: turbo run {script} --filter={}",
                    manifest_name(loaded),
                    package_filter(loaded)
                );
            }
            for (name, run) in &loaded.manifest.run {
                println!("dev [{}:{name}]: {}", cwd.display(), run.command);
            }
        }
        println!("would generate {} Turbo mirror package(s)", packages.len());
        return Ok(());
    }

    let workspace_id = std::env::var("CONTROL_WORKSPACE_ID")
        .ok()
        .filter(|value| !value.trim().is_empty());
    let start_docker = should_start_docker(no_docker, workspace_id.as_deref());
    if workspace_id.is_some() && !no_docker {
        println!("Using workspace-managed development services");
    }
    let projects = if !start_docker {
        Vec::new()
    } else {
        println!("Starting development services");
        match docker::start(&project.root, &selected, &root_env).await {
            Ok(projects) => {
                println!("Development services ready");
                projects
            }
            Err(error) => {
                if process::is_interrupted(&error) {
                    return Ok(());
                }
                return Err(error).wrap_err("Docker startup failed");
            }
        }
    };

    let prepared = prepare_selected(project, &selected, &root_env, no_prepare).await;
    if let Err(error) = prepared {
        docker::stop(&project.root, &projects, &root_env).await;
        if process::is_interrupted(&error) {
            return Ok(());
        }
        return Err(error);
    }

    let workspace_spinner = spinner("Generating development workspace");
    let packages = match turbo::plan(&selected, &project.root, &root_env) {
        Ok(packages) => packages,
        Err(error) => {
            workspace_spinner.finish_and_clear();
            docker::stop(&project.root, &projects, &root_env).await;
            return Err(error);
        }
    };
    if packages.is_empty() {
        workspace_spinner.finish_and_clear();
        docker::stop(&project.root, &projects, &root_env).await;
        bail!("selected manifests contain no run commands");
    }
    let workspace = project.root.join(".control/dev");
    if let Err(error) = turbo::generate(&workspace, &packages) {
        workspace_spinner.finish_and_clear();
        docker::stop(&project.root, &projects, &root_env).await;
        return Err(error);
    }
    workspace_spinner.finish_with_message(format!("Prepared {} run command(s)", packages.len()));

    let metadata = workspace::metadata(project).await?;
    if let Err(error) = proxy::ensure(
        project,
        &metadata,
        &proxy::public_ports(&manifests, project),
    )
    .await
    {
        docker::stop(&project.root, &projects, &root_env).await;
        return Err(error);
    }
    let registration = match proxy::register(project, &metadata, &selected) {
        Ok(registration) => registration,
        Err(error) => {
            docker::stop(&project.root, &projects, &root_env).await;
            return Err(error);
        }
    };

    let interactive = stdin().is_terminal() && stdout().is_terminal();
    let mut args = vec![
        "run".into(),
        "dev".into(),
        format!("--ui={}", if interactive { "tui" } else { "stream" }),
        "--continue=always".into(),
        format!("--concurrency={}", packages.len() + 1),
    ];
    args.extend(turbo::filters(&packages));
    let (program, command_args) = turbo::command(&project.root, args);
    let mut turbo_env = root_env.clone();
    turbo_env.insert("TURBO_GLOBAL_WARNING_DISABLED".into(), "1".into());
    let mut child =
        match process::spawn(&program, &command_args, &workspace, &turbo_env, interactive) {
            Ok(child) => child,
            Err(error) => {
                docker::stop(&project.root, &projects, &root_env).await;
                return Err(error);
            }
        };

    let result = tokio::select! {
        biased;
        signal = tokio::signal::ctrl_c() => {
            signal.into_diagnostic()?;
            eprintln!("\nreceived interrupt; stopping development processes");
            process::terminate_tree(&mut child, !interactive).await;
            Ok(())
        }
        status = child.wait() => {
            let status = status.into_diagnostic()?;
            if status.success() { Ok(()) } else { Err(miette::miette!("Turbo exited with {status}")) }
        }
    };

    let unregister_result = registration.unregister();
    let cleanup_result = cleanup(&project.root, &selected, &root_env).await;
    let should_stop = stop_docker || selected.iter().any(|loaded| loaded.manifest.docker.stop);
    if should_stop {
        docker::stop(&project.root, &projects, &root_env).await;
    }
    match (result, unregister_result, cleanup_result) {
        (Err(error), _, _) => Err(error),
        (Ok(()), Err(error), _) => Err(error),
        (Ok(()), Ok(()), Err(error)) => Err(error),
        (Ok(()), Ok(()), Ok(())) => Ok(()),
    }
}

pub async fn run_prepare(
    project: &ProjectRoot,
    selectors: &[String],
    no_docker: bool,
) -> Result<()> {
    workspace::metadata(project).await?;
    let mut manifests = manifest::discover(&project.root)?;
    workspace::configure_manifests(project, &mut manifests).await?;
    let externals = manifest::load_externals(&project.root, &mut manifests)?;
    let mut selected = manifest::select_with_dependencies_excluding(
        &manifests,
        selectors,
        &project.kind,
        &externals,
    )?;
    selected.retain(|loaded| {
        loaded
            .manifest
            .package
            .as_ref()
            .is_none_or(|package| !externals.contains(&package.name))
    });
    if selected.is_empty() {
        bail!("no control.toml manifests were selected");
    }
    let root_env = environment::root_environment(project)?;
    if !no_docker {
        println!("Starting development services");
        docker::start(&project.root, &selected, &root_env)
            .await
            .wrap_err("Docker startup failed")?;
        println!("Development services ready");
    }
    prepare_selected(project, &selected, &root_env, false).await
}

pub async fn run_database_task(
    project: &ProjectRoot,
    selectors: &[String],
    task: DatabaseTask,
) -> Result<()> {
    workspace::metadata(project).await?;
    let mut manifests = manifest::discover(&project.root)?;
    workspace::configure_manifests(project, &mut manifests).await?;
    let externals = manifest::load_externals(&project.root, &mut manifests)?;
    let mut selected = manifest::select_with_dependencies_excluding(
        &manifests,
        selectors,
        &project.kind,
        &externals,
    )?;
    selected.retain(|loaded| {
        loaded
            .manifest
            .package
            .as_ref()
            .is_none_or(|package| !externals.contains(&package.name))
    });
    if selected.is_empty() {
        bail!("no control.toml manifests were selected");
    }

    let root_env = environment::root_environment(project)?;
    if matches!(task, DatabaseTask::Push) {
        println!("Starting required development database services");
        docker::start_databases(&project.root, &selected, &root_env)
            .await
            .wrap_err("Docker startup failed")?;
    }
    prepare_selected(project, &selected, &root_env, true).await?;
    write_database_owner_environments(&project.root, &selected, &root_env)?;

    let packages = database_packages(&selected);
    if packages.is_empty() {
        println!("No database packages selected");
        return Ok(());
    }
    let (name, label) = match task {
        DatabaseTask::Generate => (
            "control:db:generate",
            "Generating selected database clients",
        ),
        DatabaseTask::Push => ("control:db:push", "Pushing selected database schemas"),
    };
    println!("{label}: {}", packages.join(", "));
    run_turbo_task(&project.root, &root_env, name, &packages, Some(3))
        .await
        .wrap_err_with(|| format!("turbo run {name} failed"))
}

async fn prepare_selected(
    project: &ProjectRoot,
    selected: &[&LoadedManifest],
    env: &BTreeMap<String, String>,
    skip_commands: bool,
) -> Result<()> {
    let environment_spinner = spinner("Preparing development environment");
    for loaded in selected {
        if environment::has_values(loaded) {
            environment::write_for_manifest(loaded, env)?;
        }
    }
    environment_spinner.finish_and_clear();
    if skip_commands {
        return Ok(());
    }
    prepare_workspace(project, selected, env).await
}

async fn prepare_workspace(
    project: &ProjectRoot,
    selected: &[&LoadedManifest],
    env: &BTreeMap<String, String>,
) -> Result<()> {
    write_database_owner_environments(&project.root, selected, env)?;
    let packages = database_packages(selected);
    for (label, task, concurrency) in [
        (
            "Generating selected database clients",
            "control:db:generate",
            Some(3_u32),
        ),
        (
            "Pushing selected database schemas",
            "control:db:push",
            Some(3),
        ),
    ] {
        if packages.is_empty() {
            continue;
        }
        println!("{label}");
        if let Err(error) = run_turbo_task(&project.root, env, task, &packages, concurrency).await {
            if process::is_interrupted(&error) {
                return Err(error);
            }
            return Err(error).wrap_err_with(|| format!("turbo run {task} failed"));
        }
    }
    prepare_scripts(&project.root, selected, env).await
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
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn write_database_owner_environments(
    root: &Path,
    manifests: &[&LoadedManifest],
    root_env: &BTreeMap<String, String>,
) -> Result<()> {
    let mut values = BTreeMap::<String, BTreeMap<String, String>>::new();
    for loaded in manifests {
        let resolved = environment::all_for_manifest(loaded, root_env)?;
        if let Some(package) = &loaded.manifest.package
            && database_packages(manifests).contains(&package.name)
        {
            values
                .entry(package.name.clone())
                .or_default()
                .extend(resolved.clone());
        }
        for (name, database) in &loaded.manifest.postgres {
            values
                .entry(database.package.clone())
                .or_default()
                .insert(name.clone(), resolved[name].clone());
        }
        for (name, database) in &loaded.manifest.mongo {
            values
                .entry(database.package.clone())
                .or_default()
                .insert(name.clone(), resolved[name].clone());
        }
    }
    let package_paths = discover_package_paths(root)?;
    for (package, environment) in values {
        let directory = package_paths
            .get(&package)
            .ok_or_else(|| miette::miette!("unknown database package {package:?}"))?;
        environment::write_dotenv(&directory.join(".env"), &environment)?;
    }
    Ok(())
}

fn discover_package_paths(root: &Path) -> Result<BTreeMap<String, std::path::PathBuf>> {
    let mut output = BTreeMap::new();
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
        let text = std::fs::read_to_string(entry.path()).into_diagnostic()?;
        let value: serde_json::Value = serde_json::from_str(&text).into_diagnostic()?;
        if let Some(name) = value.get("name").and_then(serde_json::Value::as_str) {
            output
                .entry(name.to_string())
                .or_insert_with(|| entry.path().parent().unwrap_or(root).to_path_buf());
        }
    }
    Ok(output)
}

async fn prepare_scripts(
    root: &Path,
    manifests: &[&LoadedManifest],
    env: &BTreeMap<String, String>,
) -> Result<()> {
    for loaded in manifests {
        let filter = package_filter(loaded);
        let manifest_env = environment::all_for_manifest(loaded, env)?;
        for script in &loaded.manifest.prepare {
            println!("Preparing [{filter}]: turbo run {script}");
            if let Err(error) = run_turbo_task(
                root,
                &manifest_env,
                script,
                std::slice::from_ref(&filter),
                None,
            )
            .await
            {
                if process::is_interrupted(&error) {
                    return Err(error);
                }
                return Err(error).wrap_err_with(|| {
                    format!("prepare script {script:?} failed for package {filter}")
                });
            }
        }
    }
    Ok(())
}

async fn run_turbo_task(
    root: &Path,
    env: &BTreeMap<String, String>,
    task: &str,
    package_filters: &[String],
    concurrency: Option<u32>,
) -> Result<()> {
    let args = turbo::run_args(task, package_filters, concurrency);
    let (program, command_args) = turbo::command(root, args);
    let mut turbo_env = env.clone();
    turbo_env.insert("TURBO_GLOBAL_WARNING_DISABLED".into(), "1".into());
    process::run(&program, &command_args, root, &turbo_env).await
}

async fn cleanup(
    root: &Path,
    manifests: &[&LoadedManifest],
    env: &BTreeMap<String, String>,
) -> Result<()> {
    let mut first_error = None;
    for loaded in manifests.iter().rev() {
        let cwd = loaded.path.parent().unwrap_or(root);
        let manifest_env = environment::all_for_manifest(loaded, env)?;
        for command in loaded.manifest.cleanup.commands.iter().rev() {
            if let Err(error) = process::shell(command, cwd, &manifest_env).await {
                eprintln!(
                    "warning: cleanup command failed in {}: {error:?}",
                    cwd.display()
                );
                if first_error.is_none() {
                    first_error = Some(error);
                }
            }
        }
    }
    if let Some(error) = first_error {
        Err(error)
    } else {
        Ok(())
    }
}

fn manifest_name(loaded: &LoadedManifest) -> String {
    package_filter(loaded)
}

fn package_filter(loaded: &LoadedManifest) -> String {
    loaded
        .manifest
        .package
        .as_ref()
        .map(|package| package.name.clone())
        .unwrap_or_else(|| loaded.path.display().to_string())
}

fn spinner(message: &str) -> ProgressBar {
    let spinner = ProgressBar::new_spinner();
    spinner.set_style(
        ProgressStyle::with_template("{spinner:.cyan} {msg}")
            .expect("static progress template is valid"),
    );
    spinner.enable_steady_tick(std::time::Duration::from_millis(80));
    spinner.set_message(message.to_string());
    spinner
}

fn should_start_docker(no_docker: bool, workspace_id: Option<&str>) -> bool {
    !no_docker && workspace_id.is_none()
}

use miette::IntoDiagnostic;

#[cfg(test)]
mod tests {
    use super::should_start_docker;

    #[test]
    fn starts_docker_for_native_development() {
        assert!(should_start_docker(false, None));
    }

    #[test]
    fn skips_docker_when_explicitly_disabled() {
        assert!(!should_start_docker(true, None));
    }

    #[test]
    fn skips_docker_in_a_managed_workspace() {
        assert!(!should_start_docker(false, Some("feature-auth")));
    }
}
