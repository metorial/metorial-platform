import { existsSync } from 'fs';

type ActiveProcess = {
  pid: number;
  command: string;
  kill: (signal?: NodeJS.Signals) => void;
};

type ComposeStack = {
  projectName: string;
  composeFile: string;
  cwd?: string;
};

let activeProcesses = new Set<ActiveProcess>();
let composeStacks = new Map<string, ComposeStack>();
let handlersInstalled = false;
let shuttingDown = false;

let stackKey = (stack: ComposeStack) => `${stack.projectName}\0${stack.composeFile}`;

let runQuiet = async (cmd: string[], opts?: { cwd?: string }) => {
  let proc = Bun.spawn(cmd, {
    cwd: opts?.cwd,
    stdout: 'ignore',
    stderr: 'ignore'
  });
  await proc.exited.catch(() => {});
};

let runQuietSync = (cmd: string[], opts?: { cwd?: string }) => {
  Bun.spawnSync(cmd, {
    cwd: opts?.cwd,
    stdout: 'ignore',
    stderr: 'ignore'
  });
};

let killProcessGroup = (proc: ActiveProcess, signal: NodeJS.Signals) => {
  try {
    process.kill(-proc.pid, signal);
    return;
  } catch {}

  try {
    proc.kill(signal);
  } catch {}
};

export let registerProcess = (proc: ActiveProcess) => {
  activeProcesses.add(proc);
  return () => activeProcesses.delete(proc);
};

export let registerComposeStack = (stack: ComposeStack) => {
  composeStacks.set(stackKey(stack), stack);
  return () => composeStacks.delete(stackKey(stack));
};

export let cleanupComposeStack = async (stack: ComposeStack) => {
  if (!existsSync(stack.composeFile)) return;
  await runQuiet(
    [
      'docker',
      'compose',
      '-p',
      stack.projectName,
      '-f',
      stack.composeFile,
      'down',
      '-v',
      '--remove-orphans'
    ],
    { cwd: stack.cwd }
  );
};

let cleanupComposeStackSync = (stack: ComposeStack) => {
  if (!existsSync(stack.composeFile)) return;
  runQuietSync(
    [
      'docker',
      'compose',
      '-p',
      stack.projectName,
      '-f',
      stack.composeFile,
      'down',
      '-v',
      '--remove-orphans'
    ],
    { cwd: stack.cwd }
  );
};

export let unregisterComposeStack = (stack: ComposeStack) => {
  composeStacks.delete(stackKey(stack));
};

let cleanupOnExitSync = () => {
  if (process.env.CONTROL_SKIP_EXIT_CLEANUP === '1') return;

  for (let proc of [...activeProcesses]) {
    killProcessGroup(proc, 'SIGTERM');
  }

  for (let stack of [...composeStacks.values()]) {
    cleanupComposeStackSync(stack);
  }

  for (let proc of [...activeProcesses]) {
    killProcessGroup(proc, 'SIGKILL');
  }
};

export let shutdownControl = async (signal: NodeJS.Signals | 'error', exitCode: number) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (let proc of [...activeProcesses]) {
    killProcessGroup(proc, signal === 'error' ? 'SIGTERM' : signal);
  }

  await Promise.race([
    Promise.all([...composeStacks.values()].map(stack => cleanupComposeStack(stack))),
    Bun.sleep(10_000)
  ]).catch(() => {});

  await Bun.sleep(2_000);

  for (let proc of [...activeProcesses]) {
    killProcessGroup(proc, 'SIGKILL');
  }

  process.exit(exitCode);
};

export let installShutdownHandlers = () => {
  if (handlersInstalled) return;
  handlersInstalled = true;

  process.on('SIGINT', () => {
    void shutdownControl('SIGINT', 130);
  });
  process.on('SIGTERM', () => {
    void shutdownControl('SIGTERM', 143);
  });
  process.on('SIGHUP', () => {
    void shutdownControl('SIGHUP', 129);
  });
  process.on('uncaughtException', err => {
    console.error(err);
    void shutdownControl('error', 1);
  });
  process.on('unhandledRejection', err => {
    console.error(err);
    void shutdownControl('error', 1);
  });
  process.on('exit', cleanupOnExitSync);
};
