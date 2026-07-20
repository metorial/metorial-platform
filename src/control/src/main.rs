mod cleanup;
mod dev;
mod docker;
mod environment;
mod manifest;
mod process;
mod root;
mod turbo;
mod workspace;
mod workspace_dev;

use std::{env, path::PathBuf};

use clap::{Parser, Subcommand};
use miette::{IntoDiagnostic, Result, bail};

#[derive(Debug, Parser)]
#[command(
    name = "control",
    version,
    about = "Total Control. Full Dominion. All the Power.",
)]
struct Cli {
    /// Start root detection at this directory.
    #[arg(long, global = true, value_name = "PATH")]
    root: Option<PathBuf>,
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Start selected development services.
    Dev {
        /// Package names or group names. All packages are selected when omitted.
        selectors: Vec<String>,
        #[arg(long)]
        no_docker: bool,
        #[arg(long)]
        no_prepare: bool,
        /// Stop Compose services when development exits.
        #[arg(long)]
        stop_docker: bool,
        /// Resolve and print the execution plan without changing local state.
        #[arg(long)]
        dry_run: bool,
    },
    /// Write resolved development environment files.
    Env {
        selectors: Vec<String>,
        #[arg(long)]
        json: bool,
    },
    /// Remove generated development artifacts.
    Cleanup {
        #[arg(long)]
        dry_run: bool,
        /// Stop all Compose services declared by selected manifests.
        #[arg(long)]
        docker: bool,
        selectors: Vec<String>,
    },
    /// Create and run branch workspaces.
    Workspace {
        /// Backwards-compatible alias for `control workspace create BRANCH`.
        branch: Option<String>,
        #[arg(long)]
        no_open: bool,
        #[command(subcommand)]
        command: Option<WorkspaceCommand>,
    },
    /// Manage declared Docker Compose services.
    Docker {
        #[command(subcommand)]
        command: DockerCommand,
    },
}

#[derive(Debug, Subcommand)]
enum DockerCommand {
    /// Stop declared Compose services without removing volumes.
    Stop { selectors: Vec<String> },
}

#[derive(Debug, Subcommand)]
enum WorkspaceCommand {
    /// Create a branch worktree (paired enterprise and OSS worktrees when applicable).
    Create {
        branch: String,
        /// Do not open the resulting workspace with VS Code/Cursor's `code` command.
        #[arg(long)]
        no_open: bool,
    },
    /// Run this workspace in its Docker development container.
    Dev {
        /// Package names or group names. All packages are selected when omitted.
        selectors: Vec<String>,
        /// Give this workspace persistent private Postgres, MongoDB, Redis, NATS, and etcd.
        #[arg(long)]
        isolated_services: bool,
        /// Rebuild the development image even when its content tag already exists.
        #[arg(long)]
        rebuild: bool,
        /// Skip manifest preparation commands.
        #[arg(long)]
        no_prepare: bool,
    },
    /// Stop this workspace's development container and optional private services.
    Stop {
        #[arg(long)]
        services: bool,
        /// Remove private service volumes as well. Implies --services.
        #[arg(long)]
        volumes: bool,
    },
    /// Print this workspace's stable identity and container state.
    Status,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let start = match cli.root {
        Some(root) => root,
        None => env::current_dir().into_diagnostic()?,
    };
    let project = root::detect(&start)?;

    match cli.command {
        Commands::Dev {
            selectors,
            no_docker,
            no_prepare,
            stop_docker,
            dry_run,
        } => {
            dev::run(
                &project,
                &selectors,
                no_docker,
                no_prepare,
                stop_docker,
                dry_run,
            )
            .await
        }
        Commands::Env { selectors, json } => {
            let manifests = manifest::discover(&project.root)?;
            let selected = manifest::select(&manifests, &selectors, &project.kind)?;
            let root_env = environment::root_environment(&project)?;
            let mut written = Vec::new();
            for loaded in selected {
                if environment::has_values(loaded) {
                    written.push(environment::write_for_manifest(loaded, &root_env)?);
                }
            }
            if json {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&written).into_diagnostic()?
                );
            } else {
                for path in &written {
                    println!("wrote {}", path.display());
                }
                println!("updated {} environment file(s)", written.len());
            }
            Ok(())
        }
        Commands::Cleanup {
            dry_run,
            docker: stop_docker,
            selectors,
        } => {
            let manifests = manifest::discover(&project.root)?;
            let selected = manifest::select(&manifests, &selectors, &project.kind)?;
            if stop_docker {
                let env = environment::root_environment(&project)?;
                let projects = docker::compose_projects(&project.root, &selected);
                docker::stop(&project.root, &projects, &env).await;
            }
            let plan = cleanup::plan(&project.root, &manifests);
            let removed = cleanup::execute(&plan, dry_run)?;
            if !dry_run {
                println!("cleaned {removed} artifact(s)");
            }
            Ok(())
        }
        Commands::Workspace {
            branch,
            no_open,
            command,
        } => match (command, branch) {
            (Some(WorkspaceCommand::Create { branch, no_open }), None) => {
                workspace::create(&project, &branch, !no_open).await?;
                Ok(())
            }
            (
                Some(WorkspaceCommand::Dev {
                    selectors,
                    isolated_services,
                    rebuild,
                    no_prepare,
                }),
                None,
            ) => {
                workspace_dev::run(&project, &selectors, isolated_services, rebuild, no_prepare)
                    .await
            }
            (Some(WorkspaceCommand::Stop { services, volumes }), None) => {
                workspace_dev::stop(&project, services || volumes, volumes).await
            }
            (Some(WorkspaceCommand::Status), None) => workspace_dev::status(&project).await,
            (None, Some(branch)) => {
                workspace::create(&project, &branch, !no_open).await?;
                Ok(())
            }
            (None, None) => bail!("expected a workspace subcommand or branch name"),
            (Some(_), Some(_)) => bail!("branch cannot be combined with a workspace subcommand"),
        },
        Commands::Docker {
            command: DockerCommand::Stop { selectors },
        } => {
            let manifests = manifest::discover(&project.root)?;
            let selected = manifest::select(&manifests, &selectors, &project.kind)?;
            let env = environment::root_environment(&project)?;
            let projects = docker::compose_projects(&project.root, &selected);
            docker::stop(&project.root, &projects, &env).await;
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_workspace_dev_and_legacy_create_forms() {
        let dev = Cli::try_parse_from([
            "control",
            "workspace",
            "dev",
            "--isolated-services",
            "backend",
        ])
        .unwrap();
        assert!(matches!(
            dev.command,
            Commands::Workspace {
                command: Some(WorkspaceCommand::Dev {
                    isolated_services: true,
                    ..
                }),
                ..
            }
        ));

        let legacy =
            Cli::try_parse_from(["control", "workspace", "feature/control", "--no-open"]).unwrap();
        assert!(matches!(
            legacy.command,
            Commands::Workspace {
                branch: Some(branch),
                no_open: true,
                command: None,
            } if branch == "feature/control"
        ));
    }
}
