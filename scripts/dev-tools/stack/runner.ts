import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface PlanUnit {
  name: string;
  cwd: string;
  command: string;
  dependsOn: string[];
  env: Record<string, string>;
  health: { port: number; path: string; status?: number }[];
}

export interface PlanStep {
  label: string;
  cwd: string;
  command: string[];
  env: Record<string, string>;
}

export interface RunnerPlan {
  units: PlanUnit[];
  files: { path: string; values: Record<string, string> }[];
  prepare: PlanStep[];
  healthTimeoutSeconds: number;
}

type UnitStatus = 'pending' | 'starting' | 'running' | 'stopped' | 'crashed';

interface UnitState {
  unit: PlanUnit;
  status: UnitStatus;
  child?: ChildProcess;
  pid?: number;
  restarts: number;
  exitCode?: number | null;
  startedAt?: number;
  stopping: boolean;
}

let workspace = process.env.CONTROL_STACK_WORKSPACE ?? '/workspace';
let source = process.env.CONTROL_STACK_SOURCE ?? '/source';
let port = Number(process.env.CONTROL_STACK_PORT ?? 47474);
let syncSeconds = Number(process.env.CONTROL_STACK_SYNC_SECONDS ?? 3);
let stateDirectory = path.join(workspace, '.control/stack-state');

let syncExcludes = [
  'node_modules',
  '.git',
  '.turbo',
  '.control',
  'target',
  'dist',
  '.env',
  '.DS_Store',
  '/out'
];

let log = (message: string) => console.log(`[stack] ${message}`);

let rsyncArgs = () => [
  '--archive',
  '--delete',
  ...syncExcludes.map(pattern => `--exclude=${pattern}`),
  '--filter=:- .gitignore',
  `${source.replace(/\/$/, '')}/`,
  `${workspace.replace(/\/$/, '')}/`
];

let slowSyncMs = 5000;
let syncing = false;

let syncSource = () =>
  new Promise<void>(resolve => {
    if (syncing) return resolve();
    syncing = true;

    let startedAt = Date.now();
    let errors = '';
    let finish = (failure?: string) => {
      syncing = false;
      let elapsed = Date.now() - startedAt;
      if (failure) log(`Source sync failed: ${failure}`);
      else if (elapsed > slowSyncMs) log(`Source sync took ${(elapsed / 1000).toFixed(1)}s`);
      resolve();
    };

    let child = spawn('rsync', rsyncArgs(), { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr?.on('data', chunk => (errors += chunk.toString()));
    child.on('error', error => finish(error.message));
    child.on('exit', code =>
      finish(code === 0 ? undefined : `exit code ${code}${errors ? `: ${errors.trim()}` : ''}`)
    );
  });

let run = (command: string[], options: { cwd: string; env?: Record<string, string> }) =>
  new Promise<number>((resolve, reject) => {
    let child = spawn(command[0]!, command.slice(1), {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
  });

let runOrThrow = async (
  label: string,
  command: string[],
  options: { cwd: string; env?: Record<string, string> }
) => {
  log(label);
  let code = await run(command, options);
  if (code !== 0) throw new Error(`${label} failed with exit code ${code}`);
};

let quote = (value: string) =>
  value === '' || /[ \t\n\r#="'`$]/.test(value)
    ? !value.includes("'") && !/[\r\n]/.test(value)
      ? `'${value}'`
      : `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`
    : value;

let writeFiles = (plan: RunnerPlan) => {
  for (let file of plan.files) {
    let target = path.join(workspace, file.path);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(
      target,
      Object.entries(file.values)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${quote(value)}`)
        .join('\n') + '\n'
    );
  }
};

let fileHash = (files: string[]) => {
  let hash = createHash('sha256');
  for (let file of files) if (existsSync(file)) hash.update(readFileSync(file));
  return hash.digest('hex');
};

let installDependencies = async () => {
  mkdirSync(stateDirectory, { recursive: true });
  let marker = path.join(stateDirectory, 'install');
  let hash = fileHash(
    ['bun.lock', 'package.json', 'oss/bun.lock', 'oss/package.json'].map(file =>
      path.join(workspace, file)
    )
  );
  if (
    existsSync(marker) &&
    readFileSync(marker, 'utf8') === hash &&
    existsSync(path.join(workspace, 'node_modules'))
  ) {
    log('Dependencies are up to date');
    return;
  }

  await runOrThrow('Installing dependencies', ['bun', 'install'], {
    cwd: workspace,
    env: { BUN_INSTALL_CACHE_DIR: path.join(workspace, '.control/bun-cache') }
  });
  writeFileSync(marker, hash);
};

let states = new Map<string, UnitState>();
let phase: 'preparing' | 'starting' | 'ready' | 'failed' = 'preparing';
let failure: string | undefined;

let prefixLines = (name: string, stream: NodeJS.ReadableStream, target: NodeJS.WriteStream) => {
  let pending = '';
  stream.on('data', chunk => {
    let lines = (pending + chunk.toString()).split('\n');
    pending = lines.pop() ?? '';
    for (let line of lines) target.write(`[${name}] ${line}\n`);
  });
  stream.on('end', () => {
    if (pending) target.write(`[${name}] ${pending}\n`);
  });
};

let probe = async (check: PlanUnit['health'][number]) => {
  try {
    let response = await fetch(`http://localhost:${check.port}${check.path}`, {
      signal: AbortSignal.timeout(3000)
    });
    await response.body?.cancel();
    return check.status === undefined
      ? response.status >= 200 && response.status < 300
      : response.status === check.status;
  } catch {
    return false;
  }
};

let healthy = async (state: UnitState) =>
  (await Promise.all(state.unit.health.map(probe))).every(Boolean);

let signalGroup = (state: UnitState, signal: NodeJS.Signals) => {
  if (!state.child?.pid) return;
  try {
    process.kill(-state.child.pid, signal);
  } catch {}
};

let stopUnit = async (state: UnitState) => {
  if (!state.child || state.status === 'stopped') return;
  state.stopping = true;
  signalGroup(state, 'SIGTERM');
  let deadline = Date.now() + 10_000;
  while (state.child && Date.now() < deadline) await Bun.sleep(100);
  if (state.child) signalGroup(state, 'SIGKILL');
  while (state.child) await Bun.sleep(50);
};

let launch = (state: UnitState) => {
  let unit = state.unit;
  state.stopping = false;
  state.status = 'starting';
  state.exitCode = undefined;
  state.startedAt = Date.now();

  let child = spawn('sh', ['-c', unit.command], {
    cwd: path.resolve(workspace, unit.cwd),
    env: { ...process.env, ...unit.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  });
  state.child = child;
  state.pid = child.pid;
  prefixLines(unit.name, child.stdout!, process.stdout);
  prefixLines(unit.name, child.stderr!, process.stderr);

  child.on('close', code => {
    state.child = undefined;
    state.pid = undefined;
    state.exitCode = code;
    state.status = state.stopping ? 'stopped' : 'crashed';
    if (!state.stopping) log(`${unit.name} exited with code ${code}`);
  });
  child.on('error', error => {
    log(`${unit.name} failed to start: ${error.message}`);
  });
};

let startUnit = async (state: UnitState, timeoutMs: number) => {
  launch(state);
  let deadline = Date.now() + timeoutMs;
  while (state.status === 'starting') {
    if (await healthy(state)) {
      state.status = 'running';
      return;
    }
    if (Date.now() >= deadline) throw new Error(`${state.unit.name} did not become healthy`);
    await Bun.sleep(1000);
  }
  if (state.status === 'crashed')
    throw new Error(`${state.unit.name} exited with code ${state.exitCode} before becoming healthy`);
};

let order = (units: PlanUnit[]) => {
  let result: PlanUnit[] = [];
  let seen = new Set<string>();
  let visit = (unit: PlanUnit) => {
    if (seen.has(unit.name)) return;
    seen.add(unit.name);
    for (let name of unit.dependsOn) {
      let dependency = units.find(candidate => candidate.name === name);
      if (dependency) visit(dependency);
    }
    result.push(unit);
  };
  for (let unit of units) visit(unit);
  return result;
};

let describe = () => ({
  phase,
  failure,
  units: [...states.values()].map(state => ({
    name: state.unit.name,
    status: state.status,
    pid: state.pid,
    restarts: state.restarts,
    exit_code: state.exitCode
  }))
});

let serve = (timeoutMs: number) =>
  Bun.serve({
    port,
    hostname: '0.0.0.0',
    fetch: async request => {
      let url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/state') return Response.json(describe());

      let match = url.pathname.match(/^\/units\/([^/]+)\/(start|stop|restart)$/);
      if (request.method === 'POST' && match) {
        let state = states.get(decodeURIComponent(match[1]!));
        if (!state) return Response.json({ error: 'unknown unit' }, { status: 404 });

        if (match[2] !== 'start') await stopUnit(state);
        if (match[2] !== 'stop') {
          state.restarts += 1;
          startUnit(state, timeoutMs).catch(error => log(String(error.message ?? error)));
        }
        return Response.json(describe());
      }

      return Response.json({ error: 'not found' }, { status: 404 });
    }
  });

let main = async (planPath: string) => {
  let plan = JSON.parse(readFileSync(planPath, 'utf8')) as RunnerPlan;
  let timeoutMs = plan.healthTimeoutSeconds * 1000;
  for (let unit of plan.units)
    states.set(unit.name, { unit, status: 'pending', restarts: 0, stopping: false });

  let server = serve(timeoutMs);
  let shutdown = async () => {
    await Promise.all([...states.values()].map(stopUnit));
    server.stop(true);
  };
  for (let signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      log(`Received ${signal}, stopping units`);
      await shutdown();
      process.exit(0);
    });
  }

  try {
    // rsync never deletes excluded files, and a stale .env would override the stack's environment.
    await runOrThrow(
      'Clearing stale environment files',
      ['find', '.', '-name', '.env', '-not', '-path', '*/node_modules/*', '-delete'],
      { cwd: workspace }
    );
    await runOrThrow('Syncing source', ['rsync', ...rsyncArgs()], { cwd: workspace });
    if (!existsSync(path.join(workspace, '.git')))
      await runOrThrow('Initializing the workspace index', ['git', 'init', '--quiet'], {
        cwd: workspace
      });
    await runOrThrow('Indexing the workspace', ['git', 'add', '--all'], { cwd: workspace });
    await installDependencies();
    writeFiles(plan);
    for (let step of plan.prepare)
      await runOrThrow(step.label, step.command, {
        cwd: path.resolve(workspace, step.cwd),
        env: step.env
      });

    phase = 'starting';
    for (let unit of order(plan.units)) {
      log(`Starting ${unit.name}`);
      await startUnit(states.get(unit.name)!, timeoutMs);
    }
    phase = 'ready';
    log('All units are healthy');
  } catch (error) {
    phase = 'failed';
    failure = error instanceof Error ? error.message : String(error);
    console.error(`[stack] ${failure}`);
  }

  while (true) {
    await Bun.sleep(syncSeconds * 1000);
    if (phase === 'ready' || phase === 'failed') await syncSource();
  }
};

if (import.meta.main) await main(process.argv[2] ?? '/stack/plan.json');
