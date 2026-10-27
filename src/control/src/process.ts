import { spawn as nodeSpawn, spawnSync, type ChildProcess } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import type { Environment } from './types';

let shutdownTimeout = 15_000;

let processGroups = new WeakSet<ChildProcess>();

export class Interrupted extends Error {
  constructor() {
    super('interrupted');
  }
}

export class ProcessError extends Error {
  constructor(
    public program: string,
    public code: number | null,
    detail: string
  ) {
    super(`${program} failed: ${detail || `exit status ${code}`}`);
  }
}

export let delay = (milliseconds: number) =>
  new Promise<void>(resolve => setTimeout(resolve, milliseconds));

export let spawn = (
  program: string,
  args: string[],
  cwd: string,
  env: Environment = {},
  interactive = false,
  capture = false
) => {
  let isolated = process.platform !== 'win32' && !interactive;
  let child = nodeSpawn(program, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: isolated,
    stdio: capture ? ['pipe', 'pipe', 'pipe'] : 'inherit'
  });
  if (isolated) processGroups.add(child);
  return child;
};

let signalDescendants = (pid: number, signal: NodeJS.Signals) => {
  let pending = [pid];
  let descendants: number[] = [];
  while (pending.length) {
    let parent = pending.pop()!;
    let result = spawnSync('pgrep', ['-P', String(parent)], { encoding: 'utf8' });
    for (let line of (result.stdout ?? '').split('\n')) {
      if (!/^\d+$/.test(line)) continue;
      let child = Number(line);
      pending.push(child);
      descendants.push(child);
    }
  }

  for (let child of descendants.reverse()) {
    try {
      process.kill(child, signal);
    } catch {}
  }
};

export let signalTree = (child: ChildProcess, signal: NodeJS.Signals) => {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else if (processGroups.has(child)) {
      try {
        process.kill(-child.pid, signal);
      } catch {
        child.kill(signal);
      }
    } else {
      signalDescendants(child.pid, signal);
      child.kill(signal);
    }
  } catch {}
};

export let terminateTree = async (child: ChildProcess) => {
  signalTree(child, 'SIGINT');

  let deadline = Date.now() + shutdownTimeout;

  while (Date.now() < deadline) {
    let alive = false;
    if (child.pid) {
      try {
        process.kill(-child.pid, 0);
        alive = true;
      } catch {}
    }

    if (!alive && (child.exitCode !== null || child.signalCode !== null)) return;

    await delay(100);
  }
  console.error('development processes did not exit within 15 seconds; force killing');
  signalTree(child, 'SIGKILL');
};

export let wait = (
  child: ChildProcess,
  program: string,
  capture = false,
  graceful = false
): Promise<string> =>
  new Promise((resolve, reject) => {
    let stdout: Buffer[] = [];
    let stderr: Buffer[] = [];
    let interrupted = false;
    let stopping: Promise<void> | undefined;

    let onSignal = () => {
      interrupted = true;

      if (graceful) stopping ??= terminateTree(child);
      else signalTree(child, 'SIGKILL');
    };
    let cleanup = () => {
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    if (capture) {
      child.stdout?.on('data', chunk => stdout.push(Buffer.from(chunk)));
      child.stderr?.on('data', chunk => stderr.push(Buffer.from(chunk)));
    }

    child.once('error', error => {
      cleanup();
      reject(new Error(`could not launch ${program}`, { cause: error }));
    });
    child.once('close', async code => {
      await stopping;
      cleanup();

      if (interrupted) reject(new Interrupted());
      else if (code !== 0)
        reject(new ProcessError(program, code, Buffer.concat(stderr).toString().trim()));
      else resolve(Buffer.concat(stdout).toString());
    });
  });

export let run = async (
  program: string,
  args: string[],
  cwd: string,
  env: Environment = {}
) => {
  await wait(spawn(program, args, cwd, env, true), program);
};

export let output = async (
  program: string,
  args: string[],
  cwd: string,
  env: Environment = {}
) => {
  let child = spawn(program, args, cwd, env, false, true);
  let result = wait(child, program, true);
  child.stdin!.end();

  return (await result).trim();
};

export let runQuiet = async (
  program: string,
  args: string[],
  cwd: string,
  env: Environment = {}
) => {
  await output(program, args, cwd, env);
};

export let runWithInput = async (
  program: string,
  args: string[],
  input: string,
  cwd: string,
  env: Environment = {}
) => {
  let child = spawn(program, args, cwd, env, false, true);
  let result = wait(child, program, true);
  child.stdin!.on('error', () => {});
  child.stdin!.end(input);

  await result;
};

export let pipe = async (
  sourceProgram: string,
  sourceArgs: string[],
  targetProgram: string,
  targetArgs: string[],
  cwd: string,
  env: Environment = {}
) => {
  let source = spawn(sourceProgram, sourceArgs, cwd, env, false, true);
  let target = spawn(targetProgram, targetArgs, cwd, env, false, true);
  let sourceErrors: Buffer[] = [];
  let firstProcessFailure: unknown;
  source.stderr!.on('data', chunk => sourceErrors.push(Buffer.from(chunk)));
  source.stdin!.end();

  let sourceResult = wait(source, sourceProgram, false).catch(error => {
    let failure =
      error instanceof ProcessError
        ? new ProcessError(
            sourceProgram,
            error.code,
            Buffer.concat(sourceErrors).toString().trim()
          )
        : error;
    firstProcessFailure ??= failure;
    throw failure;
  });
  let targetResult = wait(target, targetProgram, true).catch(error => {
    firstProcessFailure ??= error;
    throw error;
  });

  try {
    await Promise.all([pipeline(source.stdout!, target.stdin!), sourceResult, targetResult]);
  } catch (error) {
    signalTree(source, 'SIGKILL');
    signalTree(target, 'SIGKILL');
    await Promise.allSettled([sourceResult, targetResult]);
    throw firstProcessFailure ?? error;
  }
};

export let shellInvocation = (script: string): [string, string[]] =>
  process.platform === 'win32'
    ? ['cmd.exe', ['/D', '/S', '/C', script]]
    : ['/bin/sh', ['-eu', '-c', script]];

export let shell = async (script: string, cwd: string, env: Environment = {}) => {
  let [program, args] = shellInvocation(script);
  await run(program, args, cwd, env);
};
