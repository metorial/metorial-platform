mod cleanup;
mod dev;
mod docker;
mod e2e;
mod environment;
mod infrastructure;
mod manifest;
mod process;
mod root;
mod turbo;
mod unit;
mod workspace;
mod workspace_dev;
mod workspace_host;

use std::{env, path::PathBuf};

use clap::{Parser, Subcommand};
use miette::{IntoDiagnostic, Result};
use workspace::WorkspaceRuntime;

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
    /// Operate on the OSS source tree in an enterprise checkout.
    #[arg(long, global = true)]
    oss: bool,
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
    /// Generate clients or push schemas for selected development databases.
    Db {
        #[command(subcommand)]
        command: DbCommand,
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
    /// Run tests in isolated environments.
    Test {
        #[command(subcommand)]
        command: TestCommand,
    },
}

#[derive(Debug, Subcommand)]
enum DockerCommand {
    /// Stop declared Compose services without removing volumes.
    Stop { selectors: Vec<String> },
}

#[derive(Debug, Subcommand)]
enum DbCommand {
    /// Run control:db:generate for selected database-owner packages.
    Generate {
        /// Package names or group names. All packages are selected when omitted.
        selectors: Vec<String>,
    },
    /// Start required databases and run control:db:push for their owner packages.
    Push {
        /// Package names or group names. All packages are selected when omitted.
        selectors: Vec<String>,
    },
}

#[derive(Debug, Subcommand)]
enum TestCommand {
    /// Run package unit tests and npm workspace dependencies in Docker.
    Unit {
        /// Package selectors, each resolving to exactly one Control package.
        selectors: Vec<String>,
        /// Run every Control package in one deduplicated Turbo graph.
        #[arg(long)]
        all: bool,
    },
    /// Run package E2E suites sequentially in fresh Docker environments.
    E2e {
        /// Package selectors, each resolving to exactly one Control package.
        selectors: Vec<String>,
        /// Run every package that declares an E2E suite.
        #[arg(long)]
        all: bool,
    },
}

#[derive(Debug, Subcommand)]
enum WorkspaceCommand {
    /// Create a branch worktree (paired enterprise and OSS worktrees when applicable).
    Create {
        branch: String,
        /// Execution runtime for this workspace.
        #[arg(long, value_enum)]
        runtime: WorkspaceRuntime,
        /// Do not open the resulting workspace with VS Code.
        #[arg(long)]
        no_open: bool,
    },
    /// List branch workspaces for this repository.
    List,
    /// Remove a branch workspace worktree.
    Remove { branch: String },
    /// Start this workspace runtime and open it in VS Code.
    #[command(visible_aliases = ["connect"])]
    Start {
        /// Branch workspace to target. Defaults to the current checkout.
        branch: Option<String>,
        /// Rebuild the development image even when its content tag already exists.
        #[arg(long)]
        rebuild: bool,
        /// Do not open VS Code after starting the workspace.
        #[arg(long)]
        no_open: bool,
    },
    /// Run development services in this workspace runtime.
    Dev {
        /// Branch workspace to target. Defaults to the current checkout.
        branch: Option<String>,
    },
    /// Open an interactive zsh shell in this workspace.
    Shell {
        /// Branch workspace to target. Defaults to the current checkout.
        branch: Option<String>,
    },
    /// Stop this workspace runtime and dependency services.
    Stop {
        /// Branch workspace to target. Defaults to the current checkout.
        branch: Option<String>,
        /// Remove all persistent workspace and dependency volumes.
        #[arg(long)]
        volumes: bool,
    },
    /// Print this workspace's identity and runtime state.
    Status {
        /// Branch workspace to target. Defaults to the current checkout.
        branch: Option<String>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let start = match &cli.root {
        Some(root) => root.clone(),
        None => env::current_dir().into_diagnostic()?,
    };
    let mut project = root::detect(&start)?;
    if cli.oss {
        project.kind = root::RootKind::Standalone;
        project.root = project.oss.clone();
    }

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
        Commands::Db { command } => match command {
            DbCommand::Generate { selectors } => {
                dev::run_database_task(&project, &selectors, dev::DatabaseTask::Generate).await
            }
            DbCommand::Push { selectors } => {
                dev::run_database_task(&project, &selectors, dev::DatabaseTask::Push).await
            }
        },
        Commands::Env { selectors, json } => {
            let mut manifests = manifest::discover(&project.root)?;
            workspace::configure_manifests(&project, &mut manifests).await?;
            let externals = manifest::load_externals(&project.root, &mut manifests)?;
            let mut selected = manifest::select_with_dependencies_excluding(
                &manifests,
                &selectors,
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
            let mut manifests = manifest::discover(&project.root)?;
            workspace::configure_manifests(&project, &mut manifests).await?;
            let externals = manifest::load_externals(&project.root, &mut manifests)?;
            let mut selected = manifest::select_with_dependencies_excluding(
                &manifests,
                &selectors,
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
            WorkspaceCommand::Create {
                branch,
                runtime,
                no_open,
            } => {
                workspace::create(&project, &branch, runtime, !no_open).await?;
                Ok(())
            }
            WorkspaceCommand::List => {
                let workspaces = workspace::list(&project).await?;
                if workspaces.is_empty() {
                    println!("no workspaces");
                    return Ok(());
                }
                for entry in workspaces {
                    match (&entry.id, &entry.hostname, entry.runtime) {
                        (Some(id), Some(hostname), Some(runtime)) => {
                            println!(
                                "{}\t{}\t{}\t{}\t{}",
                                entry.branch,
                                entry.path.display(),
                                id,
                                hostname,
                                match runtime {
                                    WorkspaceRuntime::Host => "host",
                                    WorkspaceRuntime::Docker => "docker",
                                }
                            )
                        }
                        _ => println!("{}\t{}", entry.branch, entry.path.display()),
                    }
                }
                Ok(())
            }
            WorkspaceCommand::Remove { branch } => workspace::remove(&project, &branch).await,
            WorkspaceCommand::Start {
                branch,
                rebuild,
                no_open,
            } => {
                let target = workspace::resolve(&project, branch.as_deref()).await?;
                match workspace::metadata(&target).await?.runtime {
                    WorkspaceRuntime::Host => workspace_host::run(&target, rebuild, !no_open).await,
                    WorkspaceRuntime::Docker => {
                        workspace_dev::run(&target, rebuild, !no_open).await
                    }
                }
            }
            WorkspaceCommand::Dev { branch } => {
                let target = workspace::resolve(&project, branch.as_deref()).await?;
                match workspace::metadata(&target).await?.runtime {
                    WorkspaceRuntime::Host => workspace_host::control(&target).await,
                    WorkspaceRuntime::Docker => workspace_dev::control(&target).await,
                }
            }
            WorkspaceCommand::Shell { branch } => {
                let target = workspace::resolve(&project, branch.as_deref()).await?;
                match workspace::metadata(&target).await?.runtime {
                    WorkspaceRuntime::Host => workspace_host::shell(&target).await,
                    WorkspaceRuntime::Docker => workspace_dev::shell(&target).await,
                }
            }
            WorkspaceCommand::Stop { branch, volumes } => {
                let target = workspace::resolve(&project, branch.as_deref()).await?;
                match workspace::metadata(&target).await?.runtime {
                    WorkspaceRuntime::Host => workspace_host::stop(&target, volumes).await,
                    WorkspaceRuntime::Docker => workspace_dev::stop(&target, volumes).await,
                }
            }
            WorkspaceCommand::Status { branch } => {
                let target = workspace::resolve(&project, branch.as_deref()).await?;
                match workspace::metadata(&target).await?.runtime {
                    WorkspaceRuntime::Host => workspace_host::status(&target).await,
                    WorkspaceRuntime::Docker => workspace_dev::status(&target).await,
                }
            }
        },
        Commands::Docker {
            command: DockerCommand::Stop { selectors },
        } => {
            let mut manifests = manifest::discover(&project.root)?;
            workspace::configure_manifests(&project, &mut manifests).await?;
            let externals = manifest::load_externals(&project.root, &mut manifests)?;
            let mut selected = manifest::select_with_dependencies_excluding(
                &manifests,
                &selectors,
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
            let env = environment::root_environment(&project)?;
            let projects = docker::compose_projects(&project.root, &selected);
            docker::stop(&project.root, &projects, &env).await;
            Ok(())
        }
        Commands::Test { command } => match command {
            TestCommand::Unit { selectors, all } => unit::run(&project, &selectors, all).await,
            TestCommand::E2e { selectors, all } => e2e::run(&project, &selectors, all).await,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_workspace_subcommands() {
        let start = Cli::try_parse_from(["control", "workspace", "start", "--rebuild"]).unwrap();
        assert!(matches!(
            start.command,
            Commands::Workspace {
                command: WorkspaceCommand::Start {
                    branch: None,
                    rebuild: true,
                    no_open: false,
                },
            }
        ));

        let connect = Cli::try_parse_from([
            "control",
            "workspace",
            "connect",
            "feature/cli",
            "--no-open",
        ])
        .unwrap();
        assert!(matches!(
            connect.command,
            Commands::Workspace {
                command: WorkspaceCommand::Start {
                    branch: Some(branch),
                    rebuild: false,
                    no_open: true,
                },
            } if branch == "feature/cli"
        ));

        let dev = Cli::try_parse_from(["control", "workspace", "dev", "feature/cli"]).unwrap();
        assert!(matches!(
            dev.command,
            Commands::Workspace {
                command: WorkspaceCommand::Dev { branch: Some(branch) },
            } if branch == "feature/cli"
        ));

        let dev_current = Cli::try_parse_from(["control", "workspace", "dev"]).unwrap();
        assert!(matches!(
            dev_current.command,
            Commands::Workspace {
                command: WorkspaceCommand::Dev { branch: None },
            }
        ));

        assert!(
            Cli::try_parse_from(["control", "workspace", "feature/control", "--no-open"]).is_err()
        );

        let create = Cli::try_parse_from([
            "control",
            "workspace",
            "create",
            "feature/cli",
            "--runtime=host",
        ])
        .unwrap();
        assert!(matches!(
            create.command,
            Commands::Workspace {
                command: WorkspaceCommand::Create {
                    branch,
                    runtime: WorkspaceRuntime::Host,
                    no_open: false,
                },
            } if branch == "feature/cli"
        ));
        assert!(Cli::try_parse_from(["control", "workspace", "create", "feature/cli"]).is_err());

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

        let status =
            Cli::try_parse_from(["control", "workspace", "status", "feature/cli"]).unwrap();
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

    #[test]
    fn parses_database_commands() {
        let generate = Cli::try_parse_from(["control", "db", "generate", "@metorial/db"]).unwrap();
        assert!(matches!(
            generate.command,
            Commands::Db {
                command: DbCommand::Generate { selectors },
            } if selectors == ["@metorial/db"]
        ));

        let push = Cli::try_parse_from(["control", "db", "push", "backend"]).unwrap();
        assert!(matches!(
            push.command,
            Commands::Db {
                command: DbCommand::Push { selectors },
            } if selectors == ["backend"]
        ));
    }

    #[test]
    fn parses_e2e_test_selector() {
        let test = Cli::try_parse_from([
            "control",
            "test",
            "e2e",
            "@metorial/shuttle",
            "@metorial/forge",
        ])
        .unwrap();
        assert!(matches!(
            test.command,
            Commands::Test {
                command: TestCommand::E2e { selectors, all: false },
            } if selectors == ["@metorial/shuttle", "@metorial/forge"]
        ));

        let all = Cli::try_parse_from(["control", "test", "e2e", "--all"]).unwrap();
        assert!(matches!(
            all.command,
            Commands::Test {
                command: TestCommand::E2e { selectors, all: true },
            } if selectors.is_empty()
        ));
    }

    #[test]
    fn parses_unit_test_selectors() {
        let test = Cli::try_parse_from([
            "control",
            "test",
            "unit",
            "@metorial/shuttle",
            "@metorial/forge",
        ])
        .unwrap();
        assert!(matches!(
            test.command,
            Commands::Test {
                command: TestCommand::Unit {
                    selectors,
                    all: false,
                },
            } if selectors == ["@metorial/shuttle", "@metorial/forge"]
        ));

        let all = Cli::try_parse_from(["control", "test", "unit", "--all"]).unwrap();
        assert!(matches!(
            all.command,
            Commands::Test {
                command: TestCommand::Unit {
                    selectors,
                    all: true,
                },
            } if selectors.is_empty()
        ));
    }
}
