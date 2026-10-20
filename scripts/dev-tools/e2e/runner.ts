import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';

export interface HealthUrl {
  url: string;
  status?: number;
}

export interface Service {
  name: string;
  directory: string;
  start: string[];
  image?: string;
  env: Record<string, string>;
  health: HealthUrl[];
}

export interface Step {
  label: string;
  cwd: string;
  command: string[];
  env: Record<string, string>;
}

export interface Stack {
  name: string;
  tests: string[];
  env: Record<string, string>;
}

export interface Plan {
  mode: 'local' | 'images';
  concurrency: number;
  healthTimeoutSeconds: number;
  files: { path: string; values: Record<string, string> }[];
  prepare: Step[];
  dependencies: Service[];
  suts: Service[];
  stacks: Stack[];
}

export interface RunningProcess {
  service: string;
  script: string;
  child: ChildProcess;
  logFile: string;
  exitCode: number | null | undefined;
}

let workspace = process.env.CONTROL_E2E_WORKSPACE ?? '/workspace';
let source = process.env.CONTROL_E2E_SOURCE ?? '/source';
let logs = process.env.CONTROL_E2E_LOGS ?? '/e2e/logs';
let stateDirectory = path.join(workspace, '.control/e2e-state');

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

export let rsyncArgs = (from: string, to: string) => [
  '--archive',
  '--delete',
  ...syncExcludes.map(pattern => `--exclude=${pattern}`),
  `${from.replace(/\/$/, '')}/`,
  `${to.replace(/\/$/, '')}/`
];

export let turboArgs = (stack: Stack, concurrency: number) => [
  'x',
  'turbo',
  'run',
  'test:e2e',
  '--ui=stream',
  '--continue',
  `--concurrency=${concurrency}`,
  ...stack.tests.flatMap(test => ['--filter', test])
];

// Mirrors Control's dotenv writer: Bun does not unescape `\"` inside double quotes, so values
// containing quotes or `$` use single quotes whenever possible.
export let formatDotenvValue = (value: string) => {
  let needsQuotes = value === '' || /[ \t\n\r#="'`$]/.test(value);
  if (!needsQuotes) return value;
  if (!value.includes("'") && !/[\r\n]/.test(value)) return `'${value}'`;
  let escaped = value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n');
  return `"${escaped}"`;
};

export let formatDotenv = (values: Record<string, string>) =>
  Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${formatDotenvValue(value)}`)
    .join('\n') + '\n';

export let isHealthyStatus = (status: number, expected?: number) =>
  expected === undefined ? status >= 200 && status < 300 : status === expected;

export let tail = (text: string, lines = 80) => text.split('\n').slice(-lines).join('\n');

let slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

let log = (message: string) => console.log(`[e2e] ${message}`);

let run = (command: string[], options: { cwd: string; env: Record<string, string> }) =>
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
  options: { cwd: string; env: Record<string, string> }
) => {
  log(label);
  let code = await run(command, options);
  if (code !== 0) throw new Error(`${label} failed with exit code ${code}`);
};

let fileHash = (files: string[]) => {
  let hash = createHash('sha256');
  for (let file of files) {
    if (existsSync(file)) hash.update(readFileSync(file));
  }
  return hash.digest('hex');
};

let syncWorkspace = async () => {
  await runOrThrow(
    `Syncing ${source} into ${workspace}`,
    ['rsync', ...rsyncArgs(source, workspace)],
    {
      cwd: workspace,
      env: {}
    }
  );
};

let installDependencies = async () => {
  mkdirSync(stateDirectory, { recursive: true });
  let marker = path.join(stateDirectory, 'install');
  let lockfiles = ['bun.lock', 'package.json', 'oss/bun.lock', 'oss/package.json'].map(file =>
    path.join(workspace, file)
  );
  let hash = fileHash(lockfiles);
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

let writeFiles = (plan: Plan) => {
  for (let file of plan.files) {
    let target = path.join(workspace, file.path);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, formatDotenv(file.values));
  }
};

export let startService = (service: Service, cwd: string, logDirectory: string) =>
  service.start.map(script => {
    let logFile = path.join(logDirectory, `${slug(service.name)}--${slug(script)}.log`);
    let output = createWriteStream(logFile, { flags: 'a' });
    let child = spawn('bun', ['run', script], {
      cwd,
      env: { ...process.env, ...service.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    });
    child.stdout?.pipe(output);
    child.stderr?.pipe(output);
    let running: RunningProcess = {
      service: service.name,
      script,
      child,
      logFile,
      exitCode: undefined
    };
    child.on('exit', code => {
      running.exitCode = code;
    });
    child.on('error', () => {
      running.exitCode = running.exitCode ?? 1;
    });
    return running;
  });

let readTail = (file: string) => {
  try {
    return tail(readFileSync(file, 'utf8'));
  } catch {
    return '(no output)';
  }
};

let probe = async (check: HealthUrl) => {
  try {
    let response = await fetch(check.url, { signal: AbortSignal.timeout(3000) });
    await response.body?.cancel();
    return isHealthyStatus(response.status, check.status);
  } catch {
    return false;
  }
};

export let waitHealthy = async (
  services: Service[],
  processes: RunningProcess[],
  timeoutMs: number,
  intervalMs = 1000
) => {
  let deadline = Date.now() + timeoutMs;
  let pending = services.flatMap(service => service.health.map(check => ({ service, check })));
  while (pending.length > 0) {
    let results = await Promise.all(pending.map(entry => probe(entry.check)));
    pending = pending.filter((_, index) => !results[index]);
    if (pending.length === 0) break;

    let exited = processes.find(
      running =>
        running.exitCode !== undefined &&
        pending.some(entry => entry.service.name === running.service)
    );
    if (exited) {
      throw new Error(
        `${exited.service} (${exited.script}) exited with code ${exited.exitCode} before becoming healthy:\n${readTail(exited.logFile)}`
      );
    }
    if (Date.now() >= deadline) {
      let details = pending
        .map(({ service, check }) => {
          let output = processes
            .filter(running => running.service === service.name)
            .map(running => `--- ${running.logFile}\n${readTail(running.logFile)}`)
            .join('\n');
          return `${service.name} (${check.url})${output ? `\n${output}` : ''}`;
        })
        .join('\n');
      throw new Error(
        `services did not become healthy within ${timeoutMs / 1000}s:\n${details}`
      );
    }
    await Bun.sleep(intervalMs);
  }
};

let signalGroup = (running: RunningProcess, signal: NodeJS.Signals) => {
  if (running.exitCode !== undefined || running.child.pid === undefined) return;
  try {
    process.kill(-running.child.pid, signal);
  } catch {}
};

export let stopProcesses = async (processes: RunningProcess[], graceMs = 10_000) => {
  for (let running of processes) signalGroup(running, 'SIGTERM');
  let deadline = Date.now() + graceMs;
  while (Date.now() < deadline && processes.some(running => running.exitCode === undefined)) {
    await Bun.sleep(100);
  }
  for (let running of processes) signalGroup(running, 'SIGKILL');
};

let main = async (planPath: string) => {
  let plan = JSON.parse(readFileSync(planPath, 'utf8')) as Plan;
  mkdirSync(logs, { recursive: true });
  let timeoutMs = plan.healthTimeoutSeconds * 1000;
  let dependencyProcesses: RunningProcess[] = [];
  let sutProcesses: RunningProcess[] = [];

  let shutdown = async () => {
    await stopProcesses(sutProcesses);
    await stopProcesses(dependencyProcesses);
  };
  for (let signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      log(`Received ${signal}, stopping services`);
      await shutdown();
      process.exit(130);
    });
  }

  try {
    if (plan.mode === 'local') {
      await syncWorkspace();
      await installDependencies();
      writeFiles(plan);
      for (let step of plan.prepare) {
        await runOrThrow(step.label, step.command, {
          cwd: path.join(workspace, step.cwd),
          env: step.env
        });
      }

      if (plan.dependencies.length > 0) {
        log(
          `Starting dependencies: ${plan.dependencies.map(service => service.name).join(', ')}`
        );
        dependencyProcesses = plan.dependencies.flatMap(service =>
          startService(service, path.join(workspace, service.directory), logs)
        );
        await waitHealthy(plan.dependencies, dependencyProcesses, timeoutMs);
      }
      log(`Starting systems under test: ${plan.suts.map(service => service.name).join(', ')}`);
      sutProcesses = plan.suts.flatMap(service =>
        startService(service, path.join(workspace, service.directory), logs)
      );
      await waitHealthy(plan.suts, [...dependencyProcesses, ...sutProcesses], timeoutMs);
    } else {
      await waitHealthy([...plan.dependencies, ...plan.suts], [], timeoutMs);
    }
    log('All services are healthy');

    let results: { stack: string; code: number }[] = [];
    for (let stack of plan.stacks) {
      log(`Running ${stack.tests.length} e2e suite(s) against ${stack.name}`);
      let code = await run(['bun', ...turboArgs(stack, plan.concurrency)], {
        cwd: workspace,
        env: { ...stack.env, CONTROL_E2E: '1', TURBO_GLOBAL_WARNING_DISABLED: '1' }
      });
      results.push({ stack: stack.name, code });
    }

    console.log('\n[e2e] Summary');
    for (let result of results) {
      console.log(`  ${result.code === 0 ? 'PASS' : 'FAIL'}  ${result.stack}`);
    }
    return results.every(result => result.code === 0) ? 0 : 1;
  } catch (error) {
    console.error(`[e2e] ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await shutdown();
  }
};

if (import.meta.main) {
  let planPath = process.argv[2] ?? process.env.CONTROL_E2E_PLAN ?? '/e2e/plan.json';
  process.exit(await main(planPath));
}
