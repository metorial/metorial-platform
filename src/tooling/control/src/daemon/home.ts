import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

let defaultLogMaxBytes = 50 * 1024 * 1024;
let minimumLogMaxBytes = 1024 * 1024;

export let home = () =>
  process.env.CONTROL_HOME?.trim() || join(homedir(), '.metorial-control-dev-service');

export let paths = () => {
  let root = home();
  mkdirSync(root, { recursive: true });

  return {
    root,
    socket: join(root, 'daemon.sock'),
    pid: join(root, 'daemon.pid'),
    registry: join(root, 'workspaces.json'),
    stacks: join(root, 'stacks.json'),
    daemonLog: join(root, 'daemon.log'),
    logs: join(root, 'logs'),
    cache: join(root, 'cache'),
    cachePid: join(root, 'cache.pid'),
    cacheLog: join(root, 'cache.log')
  };
};

export let uiPort = () => Number(process.env.CONTROL_UI_PORT ?? 1000);

export let logMaxBytes = () => {
  let value = Number(process.env.CONTROL_LOG_MAX_BYTES?.trim() || 0);
  if (!Number.isFinite(value) || value <= 0) return defaultLogMaxBytes;

  return Math.max(Math.floor(value), minimumLogMaxBytes);
};

export let allowedHosts = (port: number) =>
  new Set([
    `localhost:${port}`,
    `127.0.0.1:${port}`,
    `control.localhost:${port}`,
    `[::1]:${port}`
  ]);
