use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
    time::Duration,
};

use miette::{Result, bail};
use tokio::time::sleep;

use crate::{
    environment::{mongo_url, postgres_url},
    manifest::LoadedManifest,
    process,
};

pub async fn start(
    root: &Path,
    manifests: &[&LoadedManifest],
    environment: &BTreeMap<String, String>,
) -> Result<Vec<(PathBuf, Vec<String>)>> {
    let projects = compose_projects(root, manifests);
    for (index, (compose, services)) in projects.iter().enumerate() {
        let mut args = compose_prefix(compose);
        args.extend([
            "up".into(),
            "--detach".into(),
            "--wait".into(),
            "--wait-timeout".into(),
            "60".into(),
        ]);
        args.extend(services.iter().cloned());
        if let Err(error) = process::run("docker", &args, root, environment).await {
            stop(root, &projects[..=index], environment).await;
            return Err(error);
        }
    }

    let provisioning = async {
        for loaded in manifests {
            let base = loaded.path.parent().unwrap_or(root);
            for db in loaded.manifest.postgres.values() {
                wait_postgres(root, base, db, environment).await?;
                create_postgres(root, base, db, environment).await?;
            }
            for db in loaded.manifest.mongo.values() {
                wait_mongo(root, base, db, environment).await?;
                create_mongo(root, base, db, environment).await?;
            }
        }
        Ok(())
    }
    .await;
    if let Err(error) = provisioning {
        stop(root, &projects, environment).await;
        return Err(error);
    }
    Ok(projects)
}

pub async fn stop(
    root: &Path,
    projects: &[(PathBuf, Vec<String>)],
    environment: &BTreeMap<String, String>,
) {
    for (compose, services) in projects.iter().rev() {
        let mut args = compose_prefix(compose);
        if services.is_empty() {
            args.push("down".into());
        } else {
            args.push("stop".into());
            args.extend(services.iter().cloned());
        }
        if let Err(error) = process::run("docker", &args, root, environment).await {
            eprintln!("warning: could not stop Docker services: {error:?}");
        }
    }
}

pub fn compose_projects(root: &Path, manifests: &[&LoadedManifest]) -> Vec<(PathBuf, Vec<String>)> {
    let mut projects = BTreeMap::<PathBuf, BTreeSet<String>>::new();
    for loaded in manifests {
        let base = loaded.path.parent().unwrap_or(root);
        for compose in &loaded.manifest.docker.compose {
            projects
                .entry(base.join(compose))
                .or_default()
                .extend(loaded.manifest.docker.services.iter().cloned());
        }
        for db in loaded.manifest.postgres.values() {
            add_db_project(
                &mut projects,
                base,
                db.compose.as_ref(),
                db.service.as_ref(),
            );
        }
        for db in loaded.manifest.mongo.values() {
            add_db_project(
                &mut projects,
                base,
                db.compose.as_ref(),
                db.service.as_ref(),
            );
        }
    }
    projects
        .into_iter()
        .map(|(path, services)| (path, services.into_iter().collect()))
        .collect()
}

fn add_db_project(
    projects: &mut BTreeMap<PathBuf, BTreeSet<String>>,
    base: &Path,
    compose: Option<&PathBuf>,
    service: Option<&String>,
) {
    if let Some(compose) = compose {
        let services = projects.entry(base.join(compose)).or_default();
        if let Some(service) = service {
            services.insert(service.clone());
        }
    }
}

fn compose_prefix(compose: &Path) -> Vec<String> {
    let mut args = vec!["compose".into()];
    if compose.file_name().and_then(|name| name.to_str()) == Some("services.docker-compose.yml") {
        args.extend(["--project-name".into(), "dev_services".into()]);
    }
    args.extend(["--file".into(), compose.to_string_lossy().into()]);
    args
}

async fn wait_postgres(
    root: &Path,
    base: &Path,
    db: &crate::manifest::Postgres,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    retry("Postgres", || async {
        if let (Some(compose), Some(service)) = (&db.compose, &db.service) {
            let mut args = compose_prefix(&base.join(compose));
            args.extend([
                "exec".into(),
                "-T".into(),
                service.clone(),
                "pg_isready".into(),
                "-U".into(),
                db.user.clone(),
            ]);
            process::run_quiet("docker", &args, root, env).await
        } else {
            process::run_quiet(
                "pg_isready",
                &[
                    "-h".into(),
                    db.host.clone(),
                    "-p".into(),
                    db.port.to_string(),
                    "-U".into(),
                    db.user.clone(),
                ],
                root,
                env,
            )
            .await
        }
    })
    .await
}

async fn create_postgres(
    root: &Path,
    base: &Path,
    db: &crate::manifest::Postgres,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    let sql = "SELECT format('CREATE DATABASE %I', :'database') \
               WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'database')\n\
               \\gexec\n";
    if let (Some(compose), Some(service)) = (&db.compose, &db.service) {
        let mut args = compose_prefix(&base.join(compose));
        args.extend([
            "exec".into(),
            "-T".into(),
            service.clone(),
            "psql".into(),
            "-v".into(),
            "ON_ERROR_STOP=1".into(),
            "-v".into(),
            format!("database={}", db.database),
            "-U".into(),
            db.user.clone(),
            "-d".into(),
            "postgres".into(),
        ]);
        process::run_with_input("docker", &args, sql, root, env).await
    } else {
        let admin = format!(
            "postgresql://{}:{}@{}:{}/postgres",
            db.user, db.password, db.host, db.port
        );
        process::run_with_input(
            "psql",
            &[
                admin,
                "-v".into(),
                "ON_ERROR_STOP=1".into(),
                "-v".into(),
                format!("database={}", db.database),
            ],
            sql,
            root,
            env,
        )
        .await
    }
}

async fn wait_mongo(
    root: &Path,
    base: &Path,
    db: &crate::manifest::Mongo,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    retry("MongoDB", || async {
        mongo_exec(root, base, db, "db.runCommand({ ping: 1 })", env).await
    })
    .await
}

async fn create_mongo(
    root: &Path,
    base: &Path,
    db: &crate::manifest::Mongo,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    mongo_exec(
        root,
        base,
        db,
        "if (db.getCollectionNames().length === 0) db.createCollection('__control')",
        env,
    )
    .await
}

async fn mongo_exec(
    root: &Path,
    base: &Path,
    db: &crate::manifest::Mongo,
    eval: &str,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    if let (Some(compose), Some(service)) = (&db.compose, &db.service) {
        let mut container_db = db.clone();
        container_db.host = "127.0.0.1".into();
        container_db.port = 27017;
        let mut args = compose_prefix(&base.join(compose));
        args.extend([
            "exec".into(),
            "-T".into(),
            service.clone(),
            "mongosh".into(),
            mongo_url(&container_db),
            "--quiet".into(),
            "--eval".into(),
            eval.into(),
        ]);
        process::run_quiet("docker", &args, root, env).await
    } else {
        process::run_quiet(
            "mongosh",
            &[
                mongo_url(db),
                "--quiet".into(),
                "--eval".into(),
                eval.into(),
            ],
            root,
            env,
        )
        .await
    }
}

async fn retry<F, Fut>(name: &str, mut operation: F) -> Result<()>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<()>>,
{
    for _ in 0..30 {
        match operation().await {
            Ok(()) => return Ok(()),
            Err(error) if process::is_interrupted(&error) => return Err(error),
            Err(_) => {}
        }
        sleep(Duration::from_secs(1)).await;
    }
    bail!("{name} did not become ready within 30 seconds")
}

#[allow(dead_code)]
fn _urls_compile_check(
    postgres: &crate::manifest::Postgres,
    mongo: &crate::manifest::Mongo,
) -> (String, String) {
    (postgres_url(postgres), mongo_url(mongo))
}
