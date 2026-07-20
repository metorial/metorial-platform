use std::{collections::BTreeMap, fmt, path::Path, process::Stdio, time::Duration};

use miette::{IntoDiagnostic, Result, WrapErr, bail};
use tokio::io::AsyncWriteExt;
use tokio::process::{Child, Command};

const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug)]
struct Interrupted;

impl fmt::Display for Interrupted {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("interrupted")
    }
}

impl std::error::Error for Interrupted {}
impl miette::Diagnostic for Interrupted {}

pub fn is_interrupted(error: &miette::Report) -> bool {
    error.downcast_ref::<Interrupted>().is_some()
}

pub async fn run(
    program: &str,
    args: &[String],
    cwd: &Path,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    let mut child = command(program, args, cwd, env)
        .kill_on_drop(true)
        .spawn()
        .into_diagnostic()
        .wrap_err_with(|| format!("could not launch {program}"))?;
    let status = tokio::select! {
        biased;
        signal = tokio::signal::ctrl_c() => {
            signal.into_diagnostic()?;
            cancel_child_tree(&mut child).await;
            return Err(Interrupted.into());
        }
        status = child.wait() => status.into_diagnostic()?,
    };
    if !status.success() {
        bail!("{program} exited with {status}");
    }
    Ok(())
}

pub async fn run_quiet(
    program: &str,
    args: &[String],
    cwd: &Path,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    let mut command = command(program, args, cwd, env);
    isolate(&mut command);
    // Null stdin: isolate() creates a new process group, so an inherited TTY
    // causes SIGTTIN (docker compose exec stops and control hangs forever).
    let child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .into_diagnostic()
        .wrap_err_with(|| format!("could not launch {program}"))?;
    let output = captured_output(child).await?;
    if !output.status.success() {
        bail!(
            "{program} failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }
    Ok(())
}

pub async fn run_with_input(
    program: &str,
    args: &[String],
    input: &str,
    cwd: &Path,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    let mut command = command(program, args, cwd, env);
    isolate(&mut command);
    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .into_diagnostic()
        .wrap_err_with(|| format!("could not launch {program}"))?;
    child
        .stdin
        .take()
        .expect("stdin was configured as piped")
        .write_all(input.as_bytes())
        .await
        .into_diagnostic()
        .wrap_err_with(|| format!("could not write to {program} stdin"))?;
    let output = captured_output(child).await?;
    if !output.status.success() {
        bail!(
            "{program} failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }
    Ok(())
}

async fn captured_output(child: Child) -> Result<std::process::Output> {
    let pid = child.id();
    let mut output = Box::pin(child.wait_with_output());
    tokio::select! {
        biased;
        signal = tokio::signal::ctrl_c() => {
            signal.into_diagnostic()?;
            if let Some(pid) = pid {
                force_kill_process_group(pid).await;
            }
            let _ = output.await;
            Err(Interrupted.into())
        }
        result = &mut output => result.into_diagnostic(),
    }
}

pub async fn output(program: &str, args: &[&str], cwd: &Path) -> Result<String> {
    let output = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .output()
        .await
        .into_diagnostic()
        .wrap_err_with(|| format!("could not launch {program}"))?;
    if !output.status.success() {
        bail!(
            "{program} failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().into())
}

pub async fn shell(script: &str, cwd: &Path, env: &BTreeMap<String, String>) -> Result<()> {
    let (program, args) = shell_invocation(script);
    run(program, &args, cwd, env).await
}

pub fn spawn(
    program: &str,
    args: &[String],
    cwd: &Path,
    env: &BTreeMap<String, String>,
    interactive: bool,
) -> Result<Child> {
    let mut command = command(program, args, cwd, env);
    #[cfg(unix)]
    if !interactive {
        use std::os::unix::process::CommandExt;
        command.as_std_mut().process_group(0);
    }
    command
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .into_diagnostic()
        .wrap_err_with(|| format!("could not launch {program}"))
}

#[cfg(unix)]
pub async fn terminate_tree(child: &mut Child, has_process_group: bool) {
    let Some(pid) = child.id() else {
        return;
    };
    if has_process_group {
        let _ = Command::new("kill")
            .args(["-INT", "--", &format!("-{pid}")])
            .status()
            .await;
    }
    let graceful = async {
        if has_process_group {
            loop {
                let child_exited = child.try_wait().ok().flatten().is_some();
                if child_exited && !process_group_alive(pid).await {
                    return;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        } else {
            let _ = child.wait().await;
        }
    };
    if tokio::time::timeout(SHUTDOWN_TIMEOUT, graceful)
        .await
        .is_ok()
    {
        return;
    }

    eprintln!("development processes did not exit within 15 seconds; force killing");
    if has_process_group {
        let _ = Command::new("kill")
            .args(["-KILL", "--", &format!("-{pid}")])
            .status()
            .await;
    } else {
        force_kill_descendants(pid).await;
    }
    if child.try_wait().ok().flatten().is_none() {
        let _ = child.start_kill();
    }
    let _ = child.wait().await;
}

#[cfg(unix)]
async fn process_group_alive(pid: u32) -> bool {
    Command::new("kill")
        .args(["-0", "--", &format!("-{pid}")])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .is_ok_and(|status| status.success())
}

#[cfg(unix)]
async fn force_kill_descendants(pid: u32) {
    let mut pending = vec![pid];
    let mut descendants = Vec::new();
    while let Some(parent) = pending.pop() {
        let Ok(output) = Command::new("pgrep")
            .args(["-P", &parent.to_string()])
            .output()
            .await
        else {
            continue;
        };
        for child in String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| line.parse::<u32>().ok())
        {
            pending.push(child);
            descendants.push(child);
        }
    }
    for descendant in descendants.into_iter().rev() {
        let _ = Command::new("kill")
            .args(["-KILL", &descendant.to_string()])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await;
    }
}

#[cfg(windows)]
pub async fn terminate_tree(child: &mut Child, _has_process_group: bool) {
    let pid = child.id();
    if tokio::time::timeout(SHUTDOWN_TIMEOUT, child.wait())
        .await
        .is_ok()
    {
        return;
    }
    eprintln!("development processes did not exit within 15 seconds; force killing");
    if let Some(pid) = pid {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status()
            .await;
    }
    let _ = child.wait().await;
}

#[cfg(unix)]
fn isolate(command: &mut Command) {
    use std::os::unix::process::CommandExt;
    command.as_std_mut().process_group(0);
}

#[cfg(windows)]
fn isolate(_command: &mut Command) {}

#[cfg(unix)]
async fn cancel_child_tree(child: &mut Child) {
    if let Some(pid) = child.id() {
        force_kill_descendants(pid).await;
    }
    let _ = child.start_kill();
    let _ = child.wait().await;
}

#[cfg(windows)]
async fn cancel_child_tree(child: &mut Child) {
    if let Some(pid) = child.id() {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status()
            .await;
    }
    let _ = child.wait().await;
}

#[cfg(unix)]
async fn force_kill_process_group(pid: u32) {
    let _ = Command::new("kill")
        .args(["-KILL", "--", &format!("-{pid}")])
        .status()
        .await;
}

#[cfg(windows)]
async fn force_kill_process_group(pid: u32) {
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .status()
        .await;
}

fn command(program: &str, args: &[String], cwd: &Path, env: &BTreeMap<String, String>) -> Command {
    let mut command = Command::new(program);
    command.args(args).current_dir(cwd).envs(env);
    command
}

fn shell_invocation(script: &str) -> (&'static str, Vec<String>) {
    #[cfg(windows)]
    {
        (
            "cmd.exe",
            vec!["/D".into(), "/S".into(), "/C".into(), script.into()],
        )
    }
    #[cfg(not(windows))]
    {
        ("/bin/sh", vec!["-eu".into(), "-c".into(), script.into()])
    }
}
