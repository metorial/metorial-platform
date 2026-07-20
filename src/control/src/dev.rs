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
    turbo,
};

pub async fn run(
    project: &ProjectRoot,
    selectors: &[String],
    no_docker: bool,
    no_prepare: bool,
    stop_docker: bool,
    dry_run: bool,
) -> Result<()> {
    let manifests = manifest::discover(&project.root)?;
    let selected = manifest::select(&manifests, selectors, &project.kind)?;
    if selected.is_empty() {
        bail!("no control.toml manifests or run commands were selected");
    }
    let root_env = environment::root_environment(project)?;
    if dry_run {
        let packages = turbo::plan(&selected, &project.root, &root_env)?;
        println!("root: {}", project.root.display());
        for loaded in &selected {
            let cwd = loaded.path.parent().unwrap_or(&project.root);
            for command in &loaded.manifest.prepare {
                println!("prepare [{}]: {command}", manifest_name(loaded));
            }
            for (name, run) in &loaded.manifest.run {
                println!("dev [{}:{name}]: {}", cwd.display(), run.command);
            }
        }
        println!("would generate {} Turbo mirror package(s)", packages.len());
        return Ok(());
    }

    let projects = if no_docker {
        Vec::new()
    } else {
        let services_spinner = spinner("Waiting for development services");
        match docker::start(&project.root, &selected, &root_env).await {
            Ok(projects) => {
                services_spinner.finish_with_message("Development services ready");
                projects
            }
            Err(error) => {
                services_spinner.finish_and_clear();
                if process::is_interrupted(&error) {
                    return Ok(());
                }
                return Err(error).wrap_err("Docker startup failed");
            }
        }
    };

    let environment_spinner = spinner("Preparing development environment");
    for loaded in &selected {
        if !environment::has_values(loaded) {
            continue;
        }
        if let Err(error) = environment::write_for_manifest(loaded, &root_env) {
            environment_spinner.finish_and_clear();
            docker::stop(&project.root, &projects, &root_env).await;
            return Err(error);
        }
    }
    environment_spinner.finish_and_clear();

    let prepared = if no_prepare {
        Ok(())
    } else {
        prepare(&project.root, &selected, &root_env).await
    };
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
    let (program, command_args) = turbo_command(&project.root, args);
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

async fn prepare(
    root: &Path,
    manifests: &[&LoadedManifest],
    env: &BTreeMap<String, String>,
) -> Result<()> {
    for loaded in manifests {
        let cwd = loaded.path.parent().unwrap_or(root);
        let manifest_env = environment::all_for_manifest(loaded, env)?;
        for command in &loaded.manifest.prepare {
            println!("Preparing [{}]: {command}", manifest_name(loaded));
            if let Err(error) = process::shell(command, cwd, &manifest_env).await {
                if process::is_interrupted(&error) {
                    return Err(error);
                }
                return Err(error)
                    .wrap_err_with(|| format!("prepare command failed in {}", cwd.display()));
            }
        }
    }
    Ok(())
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
    loaded
        .manifest
        .package
        .as_ref()
        .map(|package| package.name.clone())
        .unwrap_or_else(|| loaded.path.display().to_string())
}

fn turbo_command(root: &Path, args: Vec<String>) -> (String, Vec<String>) {
    let local = root.join("node_modules/.bin/turbo");
    if local.is_file() {
        (local.to_string_lossy().into(), args)
    } else {
        let mut bun_args = vec!["x".into(), "turbo".into()];
        bun_args.extend(args);
        ("bun".into(), bun_args)
    }
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

use miette::IntoDiagnostic;
