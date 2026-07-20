use std::{collections::BTreeMap, fmt, path::Path, process::Stdio, time::Duration};

use miette::{IntoDiagnostic, Result, WrapErr, bail};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
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

pub async fn pipe(
    source_program: &str,
    source_args: &[String],
    target_program: &str,
    target_args: &[String],
    cwd: &Path,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    let mut source_command = command(source_program, source_args, cwd, env);
    isolate(&mut source_command);
    let mut source = source_command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .into_diagnostic()
        .wrap_err_with(|| format!("could not launch {source_program}"))?;
    let source_pid = source.id();

    let mut target_command = command(target_program, target_args, cwd, env);
    isolate(&mut target_command);
    let mut target = match target_command
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
    {
        Ok(target) => target,
        Err(error) => {
            cancel_child_tree(&mut source).await;
            return Err(error)
                .into_diagnostic()
                .wrap_err_with(|| format!("could not launch {target_program}"));
        }
    };
    let target_pid = target.id();

    let mut source_stdout = source
        .stdout
        .take()
        .expect("source stdout was configured as piped");
    let mut source_stderr = source
        .stderr
        .take()
        .expect("source stderr was configured as piped");
    let mut target_stdin = target
        .stdin
        .take()
        .expect("target stdin was configured as piped");
    let mut target_stderr = target
        .stderr
        .take()
        .expect("target stderr was configured as piped");

    let transfer = async move {
        let copy = async move {
            tokio::io::copy(&mut source_stdout, &mut target_stdin)
                .await
                .into_diagnostic()
                .wrap_err("could not stream piped process output")?;
            target_stdin
                .shutdown()
                .await
                .into_diagnostic()
                .wrap_err("could not close piped process input")?;
            drop(target_stdin);
            Ok::<_, miette::Report>(())
        };
        let source_errors = async {
            let mut output = Vec::new();
            source_stderr
                .read_to_end(&mut output)
                .await
                .into_diagnostic()?;
            Ok::<_, miette::Report>(output)
        };
        let target_errors = async {
            let mut output = Vec::new();
            target_stderr
                .read_to_end(&mut output)
                .await
                .into_diagnostic()?;
            Ok::<_, miette::Report>(output)
        };
        let (copy, source_errors, target_errors) = tokio::join!(copy, source_errors, target_errors);
        let source_status = source.wait().await.into_diagnostic()?;
        let target_status = target.wait().await.into_diagnostic()?;
        copy?;
        let source_errors = source_errors?;
        let target_errors = target_errors?;
        if !source_status.success() {
            bail!(
                "{source_program} failed: {}",
                String::from_utf8_lossy(&source_errors).trim()
            );
        }
        if !target_status.success() {
            bail!(
                "{target_program} failed: {}",
                String::from_utf8_lossy(&target_errors).trim()
            );
        }
        Ok(())
    };
    tokio::pin!(transfer);
    tokio::select! {
        biased;
        signal = tokio::signal::ctrl_c() => {
            signal.into_diagnostic()?;
            if let Some(pid) = source_pid {
                force_kill_process_group(pid).await;
            }
            if let Some(pid) = target_pid {
                force_kill_process_group(pid).await;
            }
            let _ = transfer.await;
            Err(Interrupted.into())
        }
        result = &mut transfer => result,
    }
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

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn pipes_binary_output_between_processes() {
        let temp = tempdir().unwrap();
        pipe(
            "/bin/sh",
            &["-c".into(), "printf '\\001\\002\\003data'".into()],
            "/bin/sh",
            &["-c".into(), "cat > output.bin".into()],
            temp.path(),
            &Default::default(),
        )
        .await
        .unwrap();
        assert_eq!(
            std::fs::read(temp.path().join("output.bin")).unwrap(),
            b"\x01\x02\x03data"
        );
    }

    #[tokio::test]
    async fn reports_a_failing_pipe_target() {
        let temp = tempdir().unwrap();
        let error = pipe(
            "/bin/sh",
            &["-c".into(), "printf data".into()],
            "/bin/sh",
            &[
                "-c".into(),
                "cat >/dev/null; echo restore-failed >&2; exit 7".into(),
            ],
            temp.path(),
            &Default::default(),
        )
        .await
        .unwrap_err();
        assert!(format!("{error:?}").contains("restore-failed"));
    }

    #[tokio::test]
    async fn reports_a_failing_pipe_source() {
        let temp = tempdir().unwrap();
        let error = pipe(
            "/bin/sh",
            &["-c".into(), "echo dump-failed >&2; exit 9".into()],
            "/bin/sh",
            &["-c".into(), "cat >/dev/null".into()],
            temp.path(),
            &Default::default(),
        )
        .await
        .unwrap_err();
        assert!(format!("{error:?}").contains("dump-failed"));
    }
}
