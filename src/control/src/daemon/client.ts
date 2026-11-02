import { closeSync, existsSync, openSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { delay } from '../process';
import { buildId } from './build';
import { paths, uiPort } from './home';
import type { WorkspaceInfo } from './types';
import type { LogLine } from './logs';

export class DaemonError extends Error {}

let call = (path: string, init: RequestInit = {}) =>
  fetch(`http://control${path}`, { ...init, unix: paths().socket } as RequestInit);

export let ping = async () => {
  try {
    return (await (await call('/api/ping')).json()) as {
      pid: number;
      build: string;
      port: number;
      startedAt: number;
    };
  } catch {
    return undefined;
  }
};

export let startDaemon = async () => {
  let location = paths();
  let log = openSync(location.daemonLog, 'a');
  let child = spawn('bun', [join(import.meta.dir, '../main.ts'), 'daemon', 'run'], {
    detached: true,
    stdio: ['ignore', log, log]
  });
  child.unref();
  closeSync(log);

  for (let attempt = 0; attempt < 100; attempt++) {
    if (await ping()) return;
    await delay(100);
  }
  throw new DaemonError(`daemon did not start; see ${location.daemonLog}`);
};

export let ensureDaemon = async () => {
  let info = await ping();
  if (!info) {
    await startDaemon();
    info = (await ping())!;
  }

  if (info.build !== buildId())
    console.error(
      'warning: the running control daemon uses older code; run `control daemon restart`'
    );

  return info;
};

export let api = async <T = unknown>(path: string, method = 'GET', body?: unknown) => {
  let response = await call(`/api${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new DaemonError(data.error ?? `daemon returned ${response.status}`);

  return data as T;
};

export let stream = async function* <T>(
  path: string,
  signal?: AbortSignal
): AsyncGenerator<T> {
  let response = await call(`/api${path}`, { signal });
  if (!response.ok || !response.body)
    throw new DaemonError(`daemon returned ${response.status}`);

  let reader = response.body.getReader();
  let decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    let { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (let event of events) {
      let data = event
        .split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => line.slice(6))
        .join('\n');
      if (data) yield JSON.parse(data) as T;
    }
  }
};

export let stopDaemon = async () => {
  if (!(await ping())) return false;
  await api('/shutdown', 'POST').catch(() => {});

  for (let attempt = 0; attempt < 300; attempt++) {
    if (!(await ping())) return true;
    await delay(100);
  }
  throw new DaemonError('daemon did not stop');
};

export let daemonLogPath = () => {
  let file = paths().daemonLog;

  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

export let registerWorkspace = (root: string) =>
  api<WorkspaceInfo>('/workspaces/register', 'POST', { root });

export let followLogs = (
  id: string,
  units: string[],
  tail: number,
  since?: number,
  signal?: AbortSignal
) =>
  stream<LogLine>(
    `/workspaces/${encodeURIComponent(id)}/logs?follow=1&tail=${tail}&units=${units.join(',')}${since === undefined ? '' : `&since=${since}`}`,
    signal
  );

export let uiUrl = () => `http://localhost:${uiPort()}`;
