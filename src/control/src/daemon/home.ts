import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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
    daemonLog: join(root, 'daemon.log'),
    logs: join(root, 'logs')
  };
};

export let uiPort = () => Number(process.env.CONTROL_UI_PORT ?? 1000);

export let allowedHosts = (port: number) =>
  new Set([
    `localhost:${port}`,
    `127.0.0.1:${port}`,
    `control.localhost:${port}`,
    `[::1]:${port}`
  ]);
