use std::{
    collections::{BTreeSet, hash_map::DefaultHasher},
    hash::{Hash, Hasher},
    path::Path,
};

use miette::{Result, WrapErr, bail};

use crate::{
    manifest::{self, LoadedManifest},
    process,
    root::ProjectRoot,
    workspace_dev,
};

pub async fn run(project: &ProjectRoot, selectors: &[String], all: bool) -> Result<()> {
    if std::env::var("CONTROL_WORKSPACE_ID").is_ok() {
        bail!(
            "`control test unit` manages Docker itself; run it on the Docker host, not inside a workspace container"
        );
    }
    if all && !selectors.is_empty() {
        bail!("`control test unit --all` cannot be combined with package selectors");
    }
    if !all && selectors.is_empty() {
        bail!("`control test unit` requires at least one package selector or `--all`");
    }
    process::run_quiet(
        "docker",
        &["version".into()],
        &project.root,
        &Default::default(),
    )
    .await
    .wrap_err("Docker is required for `control test unit`")?;

    let manifests = manifest::discover(&project.root)?;
    let packages = if all {
        Vec::new()
    } else {
        selectors
            .iter()
            .map(|selector| package_for_selector(&manifests, selector))
            .collect::<Result<BTreeSet<_>>>()?
            .into_iter()
            .collect()
    };
    if !all && packages.is_empty() {
        bail!("no Control packages were selected for unit tests");
    }

    if all {
        println!("Running one unit graph for every testable workspace package");
    } else {
        println!(
            "Running one unit graph for {} package{}",
            packages.len(),
            if packages.len() == 1 { "" } else { "s" }
        );
    }
    run_packages(project, &packages).await
}

fn package_for_selector(manifests: &[LoadedManifest], selector: &str) -> Result<String> {
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
            "unit selector {selector:?} must resolve to exactly one package (resolved to {})",
            matches.len()
        );
    }
    Ok(selector.to_string())
}

async fn run_packages(project: &ProjectRoot, packages: &[String]) -> Result<()> {
    let assets = workspace_dev::test_assets(project);
    let image = workspace_dev::ensure_image(&project.root, &assets, false).await?;
    let caches = cache_volume_names(&checkout_id(&project.root));
    for volume in &caches {
        process::run_quiet(
            "docker",
            &["volume".into(), "create".into(), volume.clone()],
            &project.root,
            &Default::default(),
        )
        .await
        .wrap_err_with(|| format!("could not create unit test cache volume {volume}"))?;
    }

    let args = docker_args(&project.root, &image, packages, &caches);
    process::run("docker", &args, &project.root, &Default::default())
        .await
        .wrap_err_with(|| {
            if packages.is_empty() {
                "unit tests failed for the workspace".into()
            } else {
                format!("unit tests failed for {}", packages.join(", "))
            }
        })
}

fn runner_script(packages: &[String]) -> String {
    let (filter_setup, filters) = if packages.is_empty() {
        (
            "echo 'Discovering workspace packages with unit tests'\n\
             mapfile -t unit_packages < <(bun x turbo ls --output=json 2>/dev/null | bun -e \"let data = JSON.parse(await Bun.stdin.text()); for (let item of data.packages.items) { let value = await Bun.file(item.path + '/package.json').json(); if (!value.workspaces && typeof value.scripts?.test === 'string') console.log(item.name); }\")\n\
             if [ ${#unit_packages[@]} -eq 0 ]; then echo 'No workspace unit tests found' >&2; exit 1; fi\n\
             unit_filters=()\n\
             for package in \"${unit_packages[@]}\"; do unit_filters+=(\"--filter=${package}...\"); done\n",
            " \"${unit_filters[@]}\"".to_string(),
        )
    } else {
        (
            "",
            packages
                .iter()
                .map(|package| format!(" --filter={}", shell_quote(&format!("{package}..."))))
                .collect::<String>(),
        )
    };
    format!(
        "set -euo pipefail\n\
         echo 'Installing workspace dependencies'\n\
         bun install\n\
         {filter_setup}\
         echo 'Generating database clients for the package dependency graph'\n\
         bun x turbo run prisma:generate --ui=stream --env-mode=loose --concurrency=3{filters}\n\
         echo 'Building the package dependency graph'\n\
         bun x turbo run build --ui=stream --env-mode=loose{filters}\n\
         echo 'Running unit tests for the package dependency graph'\n\
         bun x turbo run test --ui=stream --env-mode=loose --concurrency=1{filters}\n"
    )
}

fn docker_args(root: &Path, image: &str, packages: &[String], caches: &[String]) -> Vec<String> {
    assert_eq!(
        caches.len(),
        6,
        "all persistent unit test caches are required"
    );
    let mut args = vec![
        "run".into(),
        "--rm".into(),
        "--init".into(),
        "--workdir".into(),
        "/workspace".into(),
        "--env".into(),
        "CONTROL_WORKSPACE_ID=unit".into(),
        "--env".into(),
        "NODE_ENV=test".into(),
        "--env".into(),
        "TURBO_TELEMETRY_DISABLED=1".into(),
        "--env".into(),
        "CARGO_TARGET_DIR=/control-cache/cargo-target".into(),
        "--mount".into(),
        format!(
            "type=bind,source={},target=/workspace",
            root.to_string_lossy()
        ),
    ];
    for (volume, target) in caches.iter().zip([
        "/workspace/node_modules",
        "/root/.bun/install/cache",
        "/control-cache/cargo-target",
        "/opt/cargo/registry",
        "/root/.cache/go-build",
        "/opt/go/pkg/mod",
    ]) {
        args.extend([
            "--mount".into(),
            format!("type=volume,source={volume},target={target}"),
        ]);
    }
    args.extend([
        image.into(),
        "/bin/bash".into(),
        "-lc".into(),
        runner_script(packages),
    ]);
    args
}

fn checkout_id(root: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    root.canonicalize()
        .unwrap_or_else(|_| root.to_path_buf())
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

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::{Manifest, Package};

    #[test]
    fn runner_uses_only_package_graph_tasks() {
        let script = runner_script(&["@metorial/api".into(), "@metorial/worker".into()]);
        assert!(script.contains("--filter='@metorial/api...'"));
        assert!(script.contains("--filter='@metorial/worker...'"));
        assert!(script.contains("run prisma:generate"));
        assert!(script.contains("run build"));
        assert!(script.contains("run test"));
        assert!(!script.contains("prisma:push"));
        assert!(!script.contains("control:db:push"));
        assert!(!script.contains("test:e2e"));
        assert!(!script.contains("docker compose"));
    }

    #[test]
    fn all_discovers_testable_turbo_workspace_packages() {
        let script = runner_script(&[]);
        assert!(script.contains("turbo ls --output=json"));
        assert!(script.contains("typeof value.scripts?.test === 'string'"));
        assert!(script.contains("!value.workspaces"));
        assert!(script.contains("\"${unit_filters[@]}\""));
    }

    #[test]
    fn docker_run_has_no_dependency_services() {
        let caches = cache_volume_names("checkout");
        let args = docker_args(
            Path::new("/code/metorial"),
            "metorial-control-dev:test",
            &["@metorial/api".into()],
            &caches,
        );
        assert_eq!(args[0], "run");
        assert!(args.contains(&"--rm".into()));
        assert!(args.contains(&"NODE_ENV=test".into()));
        assert!(args.iter().any(|arg| arg.contains("target=/workspace")));
        assert!(!args.contains(&"compose".into()));
        assert!(!args.iter().any(|arg| arg.contains("DATABASE_URL")));
    }

    #[test]
    fn selectors_resolve_to_package_names() {
        let manifests = vec![LoadedManifest {
            path: "service/control.toml".into(),
            manifest: Manifest {
                package: Some(Package {
                    name: "@metorial/api".into(),
                    groups: vec![],
                }),
                ..Default::default()
            },
        }];
        assert_eq!(
            package_for_selector(&manifests, "@metorial/api").unwrap(),
            "@metorial/api"
        );
    }

    #[test]
    fn selectors_must_resolve_to_exactly_one_control_package() {
        let error = package_for_selector(&[], "missing").unwrap_err();
        assert!(format!("{error:?}").contains("exactly one package"));
    }
}
