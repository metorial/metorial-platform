import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

let ignoredPathParts = new Set([
  '.git',
  '.turbo',
  '.next',
  '.output',
  'coverage',
  'dist',
  'node_modules'
]);

let formatCommand = (args: string[]) => ['bun', '--watch', ...args].join(' ');

let formatExit = (code: number | null, signal: NodeJS.Signals | null) => {
  if (signal) return `signal ${signal}`;
  return `code ${code ?? 'unknown'}`;
};

let containsIgnoredPathPart = (path: string) =>
  path
    .split(/[\\/]/)
    .filter(Boolean)
    .some(part => ignoredPathParts.has(part));

let findWatchRoot = () => {
  let dir = resolve(process.cwd());

  while (true) {
    if (existsSync(join(dir, 'turbo.json'))) return dir;

    let parent = dirname(dir);
    if (parent == dir) return resolve(process.cwd());

    dir = parent;
  }
};

let waitForChange = async (root: string) =>
  new Promise<string | null>(resolveChange => {
    let done = false;
    let closeWatcher = () => {};

    let finish = (filename: string | null) => {
      if (done) return;
      done = true;
      closeWatcher();
      resolveChange(filename);
    };

    let watcher = watch(root, { recursive: true }, (_eventType, filename) => {
      if (filename && containsIgnoredPathPart(filename.toString())) return;

      // Coalesce the editor's write/rename burst into a single restart.
      setTimeout(() => finish(filename?.toString() ?? null), 150);
    });

    closeWatcher = () => watcher.close();

    watcher.on('error', error => {
      console.error(`[dev-watch] File watcher failed: ${error.message}`);
      finish(null);
    });
  });

export let watchBun = async (args: string[]) => {
  if (args.length == 0) {
    console.error('Usage: metorial-dev-tools watch-bun <entrypoint> [args...]');
    process.exit(1);
  }

  let watchRoot = findWatchRoot();
  let child: ChildProcess | null = null;
  let shuttingDown = false;

  let stop = (signal: NodeJS.Signals) => {
    shuttingDown = true;

    if (child) {
      child.kill(signal);
      setTimeout(() => process.exit(0), 500).unref();
    } else {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));

  let start = () => {
    console.error(`[dev-watch] Starting ${formatCommand(args)}`);

    child = spawn('bun', ['--watch', ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit'
    });

    child.on('error', async error => {
      child = null;
      if (shuttingDown) return;

      console.error(`[dev-watch] Failed to start Bun watcher: ${error.message}`);
      console.error(`[dev-watch] Watching ${relative(process.cwd(), watchRoot) || '.'}${sep} for changes before retrying...`);

      await waitForChange(watchRoot);
      if (!shuttingDown) start();
    });

    child.on('exit', async (code, signal) => {
      child = null;
      if (shuttingDown) process.exit(code ?? 0);

      console.error(`[dev-watch] Bun watcher exited with ${formatExit(code, signal)}.`);
      console.error(`[dev-watch] Watching ${relative(process.cwd(), watchRoot) || '.'}${sep} for changes before restarting...`);

      let filename = await waitForChange(watchRoot);
      if (shuttingDown) return;

      if (filename) console.error(`[dev-watch] Change detected in ${filename}. Restarting...`);
      else console.error('[dev-watch] Change detected. Restarting...');

      start();
    });
  };

  start();
};
