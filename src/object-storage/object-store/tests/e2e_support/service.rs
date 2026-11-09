use std::collections::BTreeMap;
use std::fs::File;
use std::path::PathBuf;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use tempfile::TempDir;

use super::api::Api;
use super::backend::Storage;

/// The service binary under test: the one cargo built for this test profile, unless
/// `OBJECT_STORE_E2E_BINARY` points elsewhere (e.g. a release build for a debug test run).
pub fn binary() -> PathBuf {
    match std::env::var("OBJECT_STORE_E2E_BINARY") {
        Ok(path) if !path.is_empty() => PathBuf::from(path),
        _ => PathBuf::from(env!("CARGO_BIN_EXE_object-store-service")),
    }
}

fn free_port() -> u16 {
    std::net::TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

pub struct ServiceBuilder<'a> {
    storage: &'a Storage,
    name: String,
    settings: BTreeMap<String, BTreeMap<String, String>>,
}

impl<'a> ServiceBuilder<'a> {
    /// Default settings, except that progress reaches the job record every second
    /// (`heartbeat_seconds = 1`) so tests can see a job streaming.
    pub fn new(storage: &'a Storage, name: &str) -> Self {
        ServiceBuilder {
            storage,
            name: name.to_string(),
            settings: BTreeMap::new(),
        }
        .zip("heartbeat_seconds", 1)
    }

    /// Sets `section.key` to a TOML literal (`"2"`, `"\"text\""`).
    pub fn set(mut self, section: &str, key: &str, value: impl ToString) -> Self {
        self.settings
            .entry(section.to_string())
            .or_default()
            .insert(key.to_string(), value.to_string());
        self
    }

    pub fn zip(self, key: &str, value: impl ToString) -> Self {
        self.set("zip", key, value)
    }

    pub fn uploads(self, key: &str, value: impl ToString) -> Self {
        self.set("uploads", key, value)
    }

    pub fn server(self, key: &str, value: impl ToString) -> Self {
        self.set("server", key, value)
    }

    /// Lease settings short enough for takeover tests to finish in seconds.
    pub fn short_leases(self) -> Self {
        self.zip("heartbeat_seconds", 1)
            .zip("lease_seconds", 3)
            .zip("lease_skew_grace_seconds", 1)
    }

    pub async fn start(self) -> Service {
        let dir = tempfile::Builder::new()
            .prefix(&format!("e2e-zip-service-{}-", self.name))
            .tempdir()
            .unwrap();
        let port = free_port();

        let mut config = format!("[server]\nhost = \"127.0.0.1\"\nport = {port}\n");
        if let Some(server) = self.settings.get("server") {
            for (key, value) in server {
                config.push_str(&format!("{key} = {value}\n"));
            }
        }
        config.push_str("\n[backend]\n");
        config.push_str(&self.storage.kind.backend_toml(&self.storage.data_dir()));
        for (section, values) in &self.settings {
            if section == "server" {
                continue;
            }
            config.push_str(&format!("\n[{section}]\n"));
            for (key, value) in values {
                config.push_str(&format!("{key} = {value}\n"));
            }
        }

        let config_path = dir.path().join("config.toml");
        std::fs::write(&config_path, &config).unwrap();
        let log_path = dir.path().join("service.log");

        let mut service = Service {
            name: self.name,
            url: format!("http://127.0.0.1:{port}"),
            api: Api::new(&format!("http://127.0.0.1:{port}")),
            config_path,
            log_path,
            child: None,
            pid: 0,
            _dir: dir,
        };
        service.spawn();
        service.wait_healthy().await;
        service
    }
}

/// A running `object-store-service` process. Killed when dropped.
pub struct Service {
    pub name: String,
    pub url: String,
    pub api: Api,
    pub config_path: PathBuf,
    pub log_path: PathBuf,
    child: Option<Child>,
    pid: u32,
    _dir: TempDir,
}

impl Service {
    fn spawn(&mut self) {
        let log = File::options()
            .create(true)
            .append(true)
            .open(&self.log_path)
            .unwrap();
        let mut command = Command::new(binary());
        for (key, _) in std::env::vars() {
            if key.starts_with("OBJECT_STORE__") {
                command.env_remove(key);
            }
        }
        command
            .env("CONFIG_PATH", &self.config_path)
            .env(
                "RUST_LOG",
                std::env::var("OBJECT_STORE_E2E_LOG").unwrap_or_else(|_| {
                    "object_store=info,object_store_backends=warn,tower_http=warn".to_string()
                }),
            )
            .stdin(Stdio::null())
            .stdout(log.try_clone().unwrap())
            .stderr(log);
        let child = command
            .spawn()
            .unwrap_or_else(|error| panic!("failed to start {:?}: {error}", binary()));
        self.pid = child.id();
        self.child = Some(child);
    }

    async fn wait_healthy(&mut self) {
        let started = Instant::now();
        loop {
            if self.api.health().await {
                return;
            }
            if let Some(status) = self.child.as_mut().unwrap().try_wait().unwrap() {
                panic!(
                    "service {} exited with {status} during startup:\n{}",
                    self.name,
                    self.log_tail(60)
                );
            }
            assert!(
                started.elapsed() < Duration::from_secs(30),
                "service {} did not become healthy:\n{}",
                self.name,
                self.log_tail(60)
            );
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    }

    /// Starts the process again with the same config, port and storage.
    pub async fn restart(&mut self) {
        assert!(!self.is_running(), "{} is still running", self.name);
        self.spawn();
        self.wait_healthy().await;
    }

    pub fn pid(&self) -> u32 {
        self.pid
    }

    pub fn is_running(&mut self) -> bool {
        match self.child.as_mut() {
            Some(child) => child.try_wait().unwrap().is_none(),
            None => false,
        }
    }

    pub fn signal(&self, signal: &str) {
        let status = Command::new("kill")
            .args([&format!("-{signal}"), &self.pid.to_string()])
            .status()
            .unwrap();
        assert!(status.success(), "kill -{signal} {} failed", self.pid);
    }

    /// `kill -9`: no shutdown logic runs.
    pub fn kill(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    pub fn wait_exit(&mut self, limit: Duration) -> Option<ExitStatus> {
        let started = Instant::now();
        loop {
            let child = self.child.as_mut()?;
            if let Some(status) = child.try_wait().unwrap() {
                self.child = None;
                return Some(status);
            }
            if started.elapsed() > limit {
                return None;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    /// Resident set size in KiB, from `ps`.
    pub fn rss_kib(&self) -> Option<u64> {
        rss_kib(self.pid)
    }

    pub fn sample_rss(&self) -> RssSampler {
        RssSampler::start(self.pid)
    }

    pub fn log(&self) -> String {
        std::fs::read_to_string(&self.log_path).unwrap_or_default()
    }

    pub fn log_tail(&self, lines: usize) -> String {
        let log = self.log();
        let all: Vec<&str> = log.lines().collect();
        all[all.len().saturating_sub(lines)..].join("\n")
    }
}

impl Drop for Service {
    fn drop(&mut self) {
        if std::thread::panicking() {
            eprintln!(
                "--- last log lines of service {} ({}):\n{}",
                self.name,
                self.log_path.display(),
                self.log_tail(40)
            );
        }
        if self.child.is_some() {
            let _ = Command::new("kill")
                .args(["-CONT", &self.pid.to_string()])
                .status();
        }
        self.kill();
    }
}

pub fn rss_kib(pid: u32) -> Option<u64> {
    let output = Command::new("ps")
        .args(["-o", "rss=", "-p", &pid.to_string()])
        .output()
        .ok()?;
    String::from_utf8_lossy(&output.stdout).trim().parse().ok()
}

#[derive(Debug, Clone)]
pub struct RssStats {
    pub first_kib: u64,
    pub peak_kib: u64,
    pub last_kib: u64,
    pub samples: usize,
    /// Seconds since sampling started, and RSS in KiB.
    pub timeline: Vec<(f64, u64)>,
}

impl RssStats {
    /// The timeline in about `points` steps, each the highest sample in its step.
    pub fn summary(&self, points: usize) -> String {
        let step = self.timeline.len().div_ceil(points.max(1)).max(1);
        self.timeline
            .chunks(step)
            .map(|chunk| {
                let (at, kib) = chunk.iter().max_by_key(|(_, kib)| *kib).unwrap();
                format!("{at:.1}s:{}M", kib / 1024)
            })
            .collect::<Vec<_>>()
            .join(" ")
    }

    pub fn peak_mib(&self) -> f64 {
        self.peak_kib as f64 / 1024.0
    }

    pub fn first_mib(&self) -> f64 {
        self.first_kib as f64 / 1024.0
    }

    pub fn last_mib(&self) -> f64 {
        self.last_kib as f64 / 1024.0
    }
}

/// Samples a process's RSS every 200 ms on a thread of its own.
pub struct RssSampler {
    stop: Arc<AtomicBool>,
    thread: Option<std::thread::JoinHandle<RssStats>>,
}

impl RssSampler {
    pub fn start(pid: u32) -> RssSampler {
        let stop = Arc::new(AtomicBool::new(false));
        let thread = std::thread::spawn({
            let stop = stop.clone();
            move || {
                let mut stats = RssStats {
                    first_kib: 0,
                    peak_kib: 0,
                    last_kib: 0,
                    samples: 0,
                    timeline: Vec::new(),
                };
                let started = std::time::Instant::now();
                loop {
                    if let Some(rss) = rss_kib(pid) {
                        if stats.samples == 0 {
                            stats.first_kib = rss;
                        }
                        stats.samples += 1;
                        stats.timeline.push((started.elapsed().as_secs_f64(), rss));
                        stats.last_kib = rss;
                        stats.peak_kib = stats.peak_kib.max(rss);
                    }
                    if stop.load(Ordering::Relaxed) {
                        return stats;
                    }
                    std::thread::sleep(Duration::from_millis(200));
                }
            }
        });
        RssSampler {
            stop,
            thread: Some(thread),
        }
    }

    pub fn stop(mut self) -> RssStats {
        self.stop.store(true, Ordering::Relaxed);
        self.thread.take().unwrap().join().unwrap()
    }
}

impl Drop for RssSampler {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}
