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
use miette::{IntoDiagnostic, Result};

#[derive(Debug, Parser)]
#[command(
    name = "control",
    version,
    about = "Total Control. Full Dominion. All the Power."
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
    #[command(visible_alias = "start")]
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
    /// Write environment files and run preparation without starting applications.
    Prepare {
        /// Package names or group names. All packages are selected when omitted.
        selectors: Vec<String>,
        /// Do not start declared Docker dependency services.
        #[arg(long)]
        no_docker: bool,
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
        #[command(subcommand)]
        command: WorkspaceCommand,
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
        /// Do not open the resulting workspace with VS Code.
        #[arg(long)]
        no_open: bool,
    },
    /// List branch workspaces for this repository.
    List,
    /// Remove a branch workspace worktree.
    Remove { branch: String },
    /// Start this workspace and open it in VS Code.
    #[command(visible_alias = "start")]
    Dev {
        /// Branch workspace to target. Defaults to the current checkout.
        branch: Option<String>,
        /// Rebuild the development image even when its content tag already exists.
        #[arg(long)]
        rebuild: bool,
        /// Do not open VS Code after starting the workspace.
        #[arg(long)]
        no_open: bool,
    },
    /// Open an interactive zsh shell in this workspace.
    Shell {
        /// Branch workspace to target. Defaults to the current checkout.
        branch: Option<String>,
    },
    /// Stop this workspace's development container and dependency services.
    Stop {
        /// Branch workspace to target. Defaults to the current checkout.
        branch: Option<String>,
        /// Remove all persistent workspace and dependency volumes.
        #[arg(long)]
        volumes: bool,
    },
    /// Print this workspace's stable identity and container state.
    Status {
        /// Branch workspace to target. Defaults to the current checkout.
        branch: Option<String>,
    },
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
        Commands::Prepare {
            selectors,
            no_docker,
        } => dev::run_prepare(&project, &selectors, no_docker).await,
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
        Commands::Workspace { command } => match command {
            WorkspaceCommand::Create { branch, no_open } => {
                workspace::create(&project, &branch, !no_open).await?;
                Ok(())
            }
            WorkspaceCommand::List => {
                let workspaces = workspace::list(&project).await?;
                if workspaces.is_empty() {
                    println!("no workspaces");
                    return Ok(());
                }
                for entry in workspaces {
                    match (&entry.id, &entry.hostname) {
                        (Some(id), Some(hostname)) => {
                            println!(
                                "{}\t{}\t{}\t{}",
                                entry.branch,
                                entry.path.display(),
                                id,
                                hostname
                            )
                        }
                        _ => println!("{}\t{}", entry.branch, entry.path.display()),
                    }
                }
                Ok(())
            }
            WorkspaceCommand::Remove { branch } => workspace::remove(&project, &branch).await,
            WorkspaceCommand::Dev {
                branch,
                rebuild,
                no_open,
            } => {
                let target = workspace::resolve(&project, branch.as_deref()).await?;
                workspace_dev::run(&target, rebuild, !no_open).await
            }
            WorkspaceCommand::Shell { branch } => {
                let target = workspace::resolve(&project, branch.as_deref()).await?;
                workspace_dev::shell(&target).await
            }
            WorkspaceCommand::Stop { branch, volumes } => {
                let target = workspace::resolve(&project, branch.as_deref()).await?;
                workspace_dev::stop(&target, volumes).await
            }
            WorkspaceCommand::Status { branch } => {
                let target = workspace::resolve(&project, branch.as_deref()).await?;
                workspace_dev::status(&target).await
            },
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
    fn parses_workspace_subcommands() {
        let dev = Cli::try_parse_from(["control", "workspace", "start", "--rebuild"]).unwrap();
        assert!(matches!(
            dev.command,
            Commands::Workspace {
                command: WorkspaceCommand::Dev {
                    branch: None,
                    rebuild: true,
                    no_open: false,
                },
            }
        ));

        let targeted = Cli::try_parse_from([
            "control",
            "workspace",
            "dev",
            "feature/cli",
            "--no-open",
        ])
        .unwrap();
        assert!(matches!(
            targeted.command,
            Commands::Workspace {
                command: WorkspaceCommand::Dev {
                    branch: Some(branch),
                    rebuild: false,
                    no_open: true,
                },
            } if branch == "feature/cli"
        ));

        assert!(
            Cli::try_parse_from(["control", "workspace", "feature/control", "--no-open"]).is_err()
        );

        let create =
            Cli::try_parse_from(["control", "workspace", "create", "feature/cli"]).unwrap();
        assert!(matches!(
            create.command,
            Commands::Workspace {
                command: WorkspaceCommand::Create { branch, no_open: false },
            } if branch == "feature/cli"
        ));

        let shell = Cli::try_parse_from(["control", "workspace", "shell"]).unwrap();
        assert!(matches!(
            shell.command,
            Commands::Workspace {
                command: WorkspaceCommand::Shell { branch: None },
            }
        ));

        let shell_branch =
            Cli::try_parse_from(["control", "workspace", "shell", "feature/cli"]).unwrap();
        assert!(matches!(
            shell_branch.command,
            Commands::Workspace {
                command: WorkspaceCommand::Shell { branch: Some(branch) },
            } if branch == "feature/cli"
        ));

        let list = Cli::try_parse_from(["control", "workspace", "list"]).unwrap();
        assert!(matches!(
            list.command,
            Commands::Workspace {
                command: WorkspaceCommand::List,
            }
        ));

        let remove =
            Cli::try_parse_from(["control", "workspace", "remove", "feature/cli"]).unwrap();
        assert!(matches!(
            remove.command,
            Commands::Workspace {
                command: WorkspaceCommand::Remove { branch },
            } if branch == "feature/cli"
        ));

        let stop =
            Cli::try_parse_from(["control", "workspace", "stop", "feature/cli", "--volumes"])
                .unwrap();
        assert!(matches!(
            stop.command,
            Commands::Workspace {
                command: WorkspaceCommand::Stop {
                    branch: Some(branch),
                    volumes: true,
                },
            } if branch == "feature/cli"
        ));

        let status = Cli::try_parse_from(["control", "workspace", "status", "feature/cli"]).unwrap();
        assert!(matches!(
            status.command,
            Commands::Workspace {
                command: WorkspaceCommand::Status { branch: Some(branch) },
            } if branch == "feature/cli"
        ));
    }

    #[test]
    fn start_is_an_alias_for_dev() {
        let start = Cli::try_parse_from(["control", "start", "--no-docker", "backend"]).unwrap();
        assert!(matches!(
            start.command,
            Commands::Dev {
                no_docker: true,
                selectors,
                ..
            } if selectors == ["backend"]
        ));
    }

    #[test]
    fn parses_prepare_without_docker() {
        let prepare =
            Cli::try_parse_from(["control", "prepare", "--no-docker", "backend"]).unwrap();
        assert!(matches!(
            prepare.command,
            Commands::Prepare {
                no_docker: true,
                selectors,
            } if selectors == ["backend"]
        ));
    }
}
