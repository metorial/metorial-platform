use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{self, File, OpenOptions},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use fs2::FileExt;
use miette::{IntoDiagnostic, Result, WrapErr, bail};
use serde::{Deserialize, Serialize};

use crate::{
    manifest::LoadedManifest,
    process,
    root::ProjectRoot,
    workspace::{WorkspaceMetadata, WorkspaceRuntime},
    workspace_dev,
};

const PROJECT: &str = "control_proxy";
const NETWORK: &str = "control_proxy";
const STATE_VERSION: u32 = 2;

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
struct ProxyState {
    #[serde(default)]
    version: u32,
    #[serde(default)]
    ports: BTreeSet<u16>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct Route {
    pub port: u16,
    pub target: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
struct WorkspaceRegistrations {
    hostname: String,
    #[serde(default)]
    sessions: BTreeMap<String, Session>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct Session {
    pid: u32,
    routes: Vec<Route>,
}

pub struct Registration {
    root: PathBuf,
    workspace_id: String,
    token: String,
    active: bool,
}

impl Registration {
    pub fn unregister(mut self) -> Result<()> {
        self.remove()?;
        self.active = false;
        Ok(())
    }

    fn remove(&self) -> Result<()> {
        with_lock(&self.root, || {
            let path = registration_path(&self.root, &self.workspace_id);
            let Some(mut registrations) = read_json::<WorkspaceRegistrations>(&path)? else {
                return Ok(());
            };
            registrations.sessions.remove(&self.token);
            write_registration(&self.root, &self.workspace_id, &registrations)
        })
    }
}

impl Drop for Registration {
    fn drop(&mut self) {
        if self.active
            && let Err(error) = self.remove()
        {
            eprintln!("warning: could not unregister development proxy routes: {error:?}");
        }
    }
}

pub fn public_ports(manifests: &[LoadedManifest], project: &ProjectRoot) -> BTreeSet<u16> {
    manifests
        .iter()
        .filter(|loaded| loaded.manifest.mode.applies_to(&project.kind))
        .flat_map(|loaded| loaded.manifest.endpoints.values())
        .map(|endpoint| endpoint.port)
        .collect()
}

pub async fn ensure(
    project: &ProjectRoot,
    metadata: &WorkspaceMetadata,
    ports: &BTreeSet<u16>,
) -> Result<()> {
    let root = proxy_root(project, metadata);
    fs::create_dir_all(root.join("dynamic")).into_diagnostic()?;
    fs::create_dir_all(root.join("registrations")).into_diagnostic()?;
    let changed = with_lock(&root, || {
        let state_path = root.join("state.json");
        let mut state = read_json::<ProxyState>(&state_path)?.unwrap_or_default();
        let previous = state.ports.clone();
        state.ports.extend(ports);
        if state.ports != previous
            || state.version != STATE_VERSION
            || !root.join("compose.yml").is_file()
            || !root.join("traefik.yml").is_file()
        {
            state.version = STATE_VERSION;
            atomic_write(&state_path, &json(&state)?)?;
            atomic_write(&root.join("traefik.yml"), &render_static(&state.ports))?;
            atomic_write(
                &root.join("compose.yml"),
                &render_compose(&root, &state.ports),
            )?;
            Ok(true)
        } else {
            Ok(false)
        }
    })?;

    let _ = process::run_quiet(
        "docker",
        &["network".into(), "create".into(), NETWORK.into()],
        &project.root,
        &Default::default(),
    )
    .await;
    let mut args = compose_args(&root);
    args.extend(["up".into(), "--detach".into(), "--wait".into()]);
    if changed {
        println!("Updating shared development proxy");
    } else {
        println!("Ensuring shared development proxy is running");
    }
    process::run("docker", &args, &project.root, &Default::default())
        .await
        .wrap_err("could not start the shared development proxy")
}

pub fn register(
    project: &ProjectRoot,
    metadata: &WorkspaceMetadata,
    selected: &[&LoadedManifest],
) -> Result<Registration> {
    let root = proxy_root(project, metadata);
    let target_host = match metadata.runtime {
        WorkspaceRuntime::Host => "host.docker.internal".to_string(),
        WorkspaceRuntime::Docker => workspace_dev::container_name(metadata),
    };
    let mut by_port = BTreeMap::<u16, Route>::new();
    for loaded in selected {
        for endpoint in loaded.manifest.endpoints.values() {
            let target_port = match metadata.runtime {
                WorkspaceRuntime::Host => endpoint.bind_port.unwrap_or(endpoint.port),
                WorkspaceRuntime::Docker => endpoint.port,
            };
            let route = Route {
                port: endpoint.port,
                target: format!("http://{target_host}:{target_port}"),
            };
            if by_port.insert(endpoint.port, route).is_some() {
                bail!(
                    "workspace {:?} has multiple active endpoints on public port {}",
                    metadata.id,
                    endpoint.port
                );
            }
        }
    }
    let token = format!(
        "{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    with_lock(&root, || {
        let path = registration_path(&root, &metadata.id);
        let mut registrations = read_json::<WorkspaceRegistrations>(&path)?.unwrap_or_default();
        registrations
            .sessions
            .retain(|_, session| process_is_alive(session.pid));
        if !registrations.hostname.is_empty() && registrations.hostname != metadata.hostname {
            registrations.sessions.clear();
        }
        registrations.hostname = metadata.hostname.clone();
        for route in by_port.values() {
            for existing in registrations
                .sessions
                .values()
                .flat_map(|session| &session.routes)
            {
                if existing.port == route.port {
                    if existing.target != route.target {
                        bail!(
                            "workspace {:?} already has a different route on public port {}",
                            metadata.id,
                            route.port
                        );
                    }
                    bail!(
                        "workspace {:?} already has an active development service on public port {}",
                        metadata.id,
                        route.port
                    );
                }
            }
        }
        registrations.sessions.insert(
            token.clone(),
            Session {
                pid: std::process::id(),
                routes: by_port.into_values().collect(),
            },
        );
        write_registration(&root, &metadata.id, &registrations)
    })?;
    Ok(Registration {
        root,
        workspace_id: metadata.id.clone(),
        token,
        active: true,
    })
}

pub fn unregister_workspace(project: &ProjectRoot, metadata: &WorkspaceMetadata) -> Result<()> {
    let root = proxy_root(project, metadata);
    with_lock(&root, || {
        remove_if_exists(&registration_path(&root, &metadata.id))?;
        remove_if_exists(&dynamic_path(&root, &metadata.id))
    })
}

pub fn proxy_root(_project: &ProjectRoot, metadata: &WorkspaceMetadata) -> PathBuf {
    if let Some(root) = std::env::var_os("CONTROL_PROXY_ROOT") {
        return PathBuf::from(root);
    }
    let mut source = metadata.source_root.as_path();
    if source.file_name().and_then(|name| name.to_str()) == Some("oss")
        && source.parent().is_some_and(|parent| {
            fs::read_to_string(parent.join("package.json"))
                .ok()
                .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
                .and_then(|value| value.get("name")?.as_str().map(String::from))
                .as_deref()
                == Some("@metorial/enterprise")
        })
    {
        source = source.parent().unwrap();
    }
    source.join(".control/proxy")
}

fn write_registration(
    root: &Path,
    workspace_id: &str,
    registrations: &WorkspaceRegistrations,
) -> Result<()> {
    if registrations.sessions.is_empty() {
        remove_if_exists(&registration_path(root, workspace_id))?;
        return remove_if_exists(&dynamic_path(root, workspace_id));
    }
    let mut routes = BTreeMap::new();
    for route in registrations
        .sessions
        .values()
        .flat_map(|session| &session.routes)
    {
        routes.entry(route.port).or_insert_with(|| route.clone());
    }
    atomic_write(
        &registration_path(root, workspace_id),
        &json(registrations)?,
    )?;
    atomic_write(
        &dynamic_path(root, workspace_id),
        &render_dynamic(workspace_id, &registrations.hostname, routes.values()),
    )
}

fn render_static(ports: &BTreeSet<u16>) -> String {
    let mut entrypoints = String::from(
        "  health:\n    address: ':8082'\n  port-80:\n    address: ':80'\n    http:\n      redirections:\n        entryPoint:\n          to: port-4300\n          scheme: http\n          permanent: false\n",
    );
    for port in ports {
        entrypoints.push_str(&format!("  port-{port}:\n    address: ':{port}'\n"));
    }
    format!(
        "global:\n  checkNewVersion: false\n  sendAnonymousUsage: false\nlog:\n  level: INFO\napi:\n  dashboard: false\nping:\n  entryPoint: health\nproviders:\n  file:\n    directory: /etc/traefik/dynamic\n    watch: true\nentryPoints:\n{entrypoints}"
    )
}

fn render_compose(root: &Path, ports: &BTreeSet<u16>) -> String {
    let mut public_ports = ports.clone();
    public_ports.insert(80);
    let mut published = String::new();
    for port in public_ports {
        // The .localhost namespace resolves to both loopback families on macOS and
        // many Linux hosts. Publishing only on IPv4 lets an IPv6 connection bypass
        // Traefik (or fail outright), so the proxy must own both addresses.
        published.push_str(&format!("      - '127.0.0.1:{port}:{port}'\n"));
        published.push_str(&format!("      - '[::1]:{port}:{port}'\n"));
    }
    format!(
        "name: control-proxy\nservices:\n  traefik:\n    image: traefik:v3.7.8\n    restart: unless-stopped\n    command: [--configFile=/etc/traefik/traefik.yml]\n    ports:\n{published}    volumes:\n      - '{}:/etc/traefik/traefik.yml:ro'\n      - '{}:/etc/traefik/dynamic:ro'\n    extra_hosts:\n      - 'host.docker.internal:host-gateway'\n    networks: [control-proxy]\n    healthcheck: {{ test: [CMD, traefik, healthcheck, --ping], interval: 5s, timeout: 3s, retries: 12 }}\nnetworks:\n  control-proxy: {{ name: control_proxy, external: true }}\n",
        root.join("traefik.yml").display(),
        root.join("dynamic").display()
    )
}

fn render_dynamic<'a>(
    workspace_id: &str,
    hostname: &str,
    routes: impl Iterator<Item = &'a Route>,
) -> String {
    let routes = routes.collect::<Vec<_>>();
    let mut output = String::from("http:\n  routers:\n");
    for route in &routes {
        let name = format!("{}-{}", workspace_id, route.port);
        output.push_str(&format!(
            "    {name}:\n      rule: \"Host(`{hostname}`)\"\n      entryPoints: [port-{}]\n      service: {name}\n",
            route.port
        ));
    }
    output.push_str("  services:\n");
    for route in routes {
        let name = format!("{}-{}", workspace_id, route.port);
        output.push_str(&format!(
            "    {name}:\n      loadBalancer:\n        servers:\n          - url: '{}'\n",
            route.target
        ));
    }
    output
}

fn compose_args(root: &Path) -> Vec<String> {
    vec![
        "compose".into(),
        "--project-name".into(),
        PROJECT.into(),
        "--file".into(),
        root.join("compose.yml").to_string_lossy().into_owned(),
    ]
}

fn registration_path(root: &Path, workspace_id: &str) -> PathBuf {
    root.join("registrations")
        .join(format!("{workspace_id}.json"))
}

fn dynamic_path(root: &Path, workspace_id: &str) -> PathBuf {
    root.join("dynamic").join(format!("{workspace_id}.yml"))
}

fn with_lock<T>(root: &Path, action: impl FnOnce() -> Result<T>) -> Result<T> {
    fs::create_dir_all(root).into_diagnostic()?;
    let lock = OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .truncate(false)
        .open(root.join("lock"))
        .into_diagnostic()?;
    lock.lock_exclusive().into_diagnostic()?;
    let result = action();
    File::unlock(&lock).into_diagnostic()?;
    result
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<Option<T>> {
    if !path.is_file() {
        return Ok(None);
    }
    serde_json::from_str(&fs::read_to_string(path).into_diagnostic()?)
        .into_diagnostic()
        .map(Some)
}

fn json(value: &impl Serialize) -> Result<String> {
    let mut output = serde_json::to_string_pretty(value).into_diagnostic()?;
    output.push('\n');
    Ok(output)
}

fn atomic_write(path: &Path, contents: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).into_diagnostic()?;
    }
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, contents).into_diagnostic()?;
    fs::rename(&temporary, path).into_diagnostic()
}

fn remove_if_exists(path: &Path) -> Result<()> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error).into_diagnostic(),
    }
}

fn process_is_alive(pid: u32) -> bool {
    std::process::Command::new("kill")
        .args(["-0", &pid.to_string()])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_host_routed_dynamic_configuration() {
        let text = render_dynamic(
            "feature-auth",
            "metorial-feature-auth.localhost",
            [Route {
                port: 4310,
                target: "http://host.docker.internal:30001".into(),
            }]
            .iter(),
        );
        assert!(text.contains("Host(`metorial-feature-auth.localhost`)"));
        assert!(text.contains("entryPoints: [port-4310]"));
        assert!(text.contains("http://host.docker.internal:30001"));
    }

    #[test]
    fn renders_dual_stack_loopback_only_public_ports() {
        let root = Path::new("/code/.control/proxy");
        let text = render_compose(root, &BTreeSet::from([4300, 4310]));
        assert!(text.contains("127.0.0.1:80:80"));
        assert!(text.contains("[::1]:80:80"));
        assert!(text.contains("127.0.0.1:4300:4300"));
        assert!(text.contains("[::1]:4300:4300"));
        assert!(text.contains("host.docker.internal:host-gateway"));
        assert!(render_static(&BTreeSet::from([4300])).contains("to: port-4300"));
    }

    #[test]
    fn merges_disjoint_sessions_and_removes_empty_configuration() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir_all(temp.path().join("registrations")).unwrap();
        fs::create_dir_all(temp.path().join("dynamic")).unwrap();
        let mut registrations = WorkspaceRegistrations {
            hostname: "metorial-feature.localhost".into(),
            sessions: BTreeMap::new(),
        };
        registrations.sessions.insert(
            "one".into(),
            Session {
                pid: std::process::id(),
                routes: vec![Route {
                    port: 4300,
                    target: "http://host.docker.internal:30001".into(),
                }],
            },
        );
        registrations.sessions.insert(
            "two".into(),
            Session {
                pid: std::process::id(),
                routes: vec![Route {
                    port: 4310,
                    target: "http://host.docker.internal:30002".into(),
                }],
            },
        );
        write_registration(temp.path(), "feature", &registrations).unwrap();
        let dynamic = fs::read_to_string(dynamic_path(temp.path(), "feature")).unwrap();
        assert!(dynamic.contains("port-4300"));
        assert!(dynamic.contains("port-4310"));

        registrations.sessions.clear();
        write_registration(temp.path(), "feature", &registrations).unwrap();
        assert!(!dynamic_path(temp.path(), "feature").exists());
        assert!(!registration_path(temp.path(), "feature").exists());
    }

    #[test]
    fn docker_compose_accepts_shared_proxy_schema_when_available() {
        if !std::process::Command::new("docker")
            .args(["compose", "version"])
            .output()
            .is_ok_and(|output| output.status.success())
        {
            return;
        }
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir(temp.path().join("dynamic")).unwrap();
        fs::write(
            temp.path().join("traefik.yml"),
            render_static(&BTreeSet::from([4300, 4310])),
        )
        .unwrap();
        fs::write(
            temp.path().join("compose.yml"),
            render_compose(temp.path(), &BTreeSet::from([4300, 4310])),
        )
        .unwrap();
        let output = std::process::Command::new("docker")
            .current_dir(temp.path())
            .args(["compose", "--file", "compose.yml", "config"])
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
}
