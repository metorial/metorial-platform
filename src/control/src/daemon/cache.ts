import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Environment } from '../types';
import { paths } from './home';

let team = 'metorial';
let entry = resolve(import.meta.dir, '../../../tooling/warp-cache/src/index.ts');
let readyTimeout = 10_000;

export let cacheEnabled = () =>
  !['0', 'false', 'off'].includes((process.env.CONTROL_CACHE ?? '').toLowerCase());

export let cachePort = () => Number(process.env.CONTROL_CACHE_PORT ?? 8787);

let child: ChildProcess | undefined;
let token: string | undefined;

let answers = async (port: number, bearer?: string) => {
  try {
    let url = new URL(`http://127.0.0.1:${port}/v8/artifacts/status`);
    url.searchParams.set('teamId', team);
    let response = await fetch(url, {
      headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
      signal: AbortSignal.timeout(1000)
    });

    return response.status;
  } catch {
    return undefined;
  }
};

let alive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

let reapStale = async () => {
  let file = paths().cachePid;
  if (!existsSync(file)) return;

  let pid = Number(readFileSync(file, 'utf8'));
  rmSync(file, { force: true });
  if (!pid || !alive(pid)) return;

  try {
    process.kill(pid, 'SIGTERM');
  } catch {}
  for (let attempt = 0; attempt < 25 && alive(pid); attempt++)
    await new Promise(done => setTimeout(done, 200));
};

export let startCache = async (): Promise<string | undefined> => {
  if (!cacheEnabled()) return undefined;
  if (!existsSync(entry)) return 'warp cache sources are not part of this checkout';

  await reapStale();

  let port = cachePort();
  if ((await answers(port)) !== undefined) return `port ${port} is already in use`;

  let location = paths();
  mkdirSync(location.cache, { recursive: true });
  token = randomBytes(32).toString('hex');

  let log = openSync(location.cacheLog, 'a');
  child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      WARP_CACHE_TOKEN: token,
      WARP_CACHE_TEAM: team,
      WARP_CACHE_PORT: String(port),
      WARP_CACHE_DIRECTORY: location.cache
    },
    stdio: ['ignore', log, log]
  });
  let started = child;
  started.once('exit', () => {
    if (child === started) child = undefined;
  });
  if (started.pid) writeFileSync(location.cachePid, String(started.pid));

  let deadline = Date.now() + readyTimeout;
  while (Date.now() < deadline) {
    if (started.exitCode !== null) break;
    if ((await answers(port, token)) === 200) return undefined;
    await new Promise(done => setTimeout(done, 200));
  }

  stopCache();

  return `did not become ready; see ${location.cacheLog}`;
};

export let stopCache = () => {
  let running = child;
  child = undefined;
  token = undefined;
  running?.kill('SIGTERM');
  rmSync(paths().cachePid, { force: true });
};

export let cacheEnvironment = (host = '127.0.0.1'): Environment =>
  token
    ? {
        TURBO_API: `http://${host}:${cachePort()}`,
        TURBO_TEAM: team,
        TURBO_TOKEN: token
      }
    : {};

export let applyCacheEnvironment = () => {
  for (let [key, value] of Object.entries(cacheEnvironment())) process.env[key] = value;
};

export let containerCacheEnvironment = () => cacheEnvironment('host.docker.internal');
