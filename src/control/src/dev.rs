use std::{
    collections::BTreeMap,
    io::{IsTerminal, stdin, stdout},
    path::Path,
};

use indicatif::{ProgressBar, ProgressStyle};
use miette::{Result, WrapErr, bail};

use crate::{
    docker, environment,
    manifest::{self, LoadedManifest},
    process,
    root::ProjectRoot,
    turbo, workspace,
};

pub async fn run(
    project: &ProjectRoot,
    selectors: &[String],
    no_docker: bool,
    no_prepare: bool,
    stop_docker: bool,
    dry_run: bool,
) -> Result<()> {
    let mut manifests = manifest::discover(&project.root)?;
    workspace::configure_manifests(project, &mut manifests)?;
    let selected = manifest::select(&manifests, selectors, &project.kind)?;
    if selected.is_empty() {
        bail!("no control.toml manifests or run commands were selected");
    }
    let all = manifest::select(&manifests, &[], &project.kind)?;
    let root_env = environment::root_environment(project)?;
    if dry_run {
        let packages = turbo::plan(&selected, &project.root, &root_env)?;
        println!("root: {}", project.root.display());
        if !no_prepare {
            println!("prepare: turbo run prisma:generate");
            println!("prepare: turbo run prisma:push");
            println!("prepare: bun run build");
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

    // Prepare runs prisma:push for every package, so dependency services must
    // cover the full workspace even when only a subset of apps will run.
    let docker_manifests = if no_prepare { &selected } else { &all };
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
        match docker::start(&project.root, docker_manifests, &root_env).await {
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

    let prepared = prepare_selected(project, &all, &selected, &root_env, no_prepare).await;
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

    let cleanup_result = cleanup(&project.root, &selected, &root_env).await;
    let should_stop = stop_docker || selected.iter().any(|loaded| loaded.manifest.docker.stop);
    if should_stop {
        docker::stop(&project.root, &projects, &root_env).await;
    }
    match (result, cleanup_result) {
        (Err(error), _) => Err(error),
        (Ok(()), Err(error)) => Err(error),
        (Ok(()), Ok(())) => Ok(()),
    }
}

pub async fn run_prepare(
    project: &ProjectRoot,
    selectors: &[String],
    no_docker: bool,
) -> Result<()> {
    let mut manifests = manifest::discover(&project.root)?;
    workspace::configure_manifests(project, &mut manifests)?;
    let selected = manifest::select(&manifests, selectors, &project.kind)?;
    if selected.is_empty() {
        bail!("no control.toml manifests were selected");
    }
    let all = manifest::select(&manifests, &[], &project.kind)?;
    let root_env = environment::root_environment(project)?;
    if !no_docker {
        println!("Starting development services");
        docker::start(&project.root, &all, &root_env)
            .await
            .wrap_err("Docker startup failed")?;
        println!("Development services ready");
    }
    prepare_selected(project, &all, &selected, &root_env, false).await
}

async fn prepare_selected(
    project: &ProjectRoot,
    all: &[&LoadedManifest],
    selected: &[&LoadedManifest],
    env: &BTreeMap<String, String>,
    skip_commands: bool,
) -> Result<()> {
    let environment_spinner = spinner("Preparing development environment");
    // Always write every package `.env` when preparing so turbo `prisma:push`
    // can reach every schema; with `--no-prepare` only write selected ones.
    let env_targets = if skip_commands { selected } else { all };
    for loaded in env_targets {
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
    // Workspace-wide turbo tasks (cached) before package-local prepare scripts.
    for (label, task, concurrency) in [
        ("Generating Prisma clients", "prisma:generate", Some(3_u32)),
        ("Pushing Prisma schemas", "prisma:push", Some(3)),
    ] {
        println!("{label}");
        if let Err(error) = run_turbo_task(&project.root, env, task, &[], concurrency).await {
            if process::is_interrupted(&error) {
                return Err(error);
            }
            return Err(error).wrap_err_with(|| format!("turbo run {task} failed"));
        }
    }
    // Root `build` script applies workspace filters (enterprise vs OSS).
    println!("Building packages");
    if let Err(error) =
        process::run("bun", &["run".into(), "build".into()], &project.root, env).await
    {
        if process::is_interrupted(&error) {
            return Err(error);
        }
        return Err(error).wrap_err("bun run build failed");
    }
    prepare_scripts(&project.root, selected, env).await
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
