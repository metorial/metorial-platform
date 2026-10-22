import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  formatDotenv,
  isHealthyStatus,
  rsyncArgs,
  stackCacheKey,
  startService,
  stopProcesses,
  tail,
  turboArgs,
  waitHealthy,
  type RunningProcess,
  type Service
} from './runner';

let servers: ReturnType<typeof Bun.serve>[] = [];
let processes: RunningProcess[] = [];

afterEach(async () => {
  for (let server of servers) server.stop(true);
  servers = [];
  await stopProcesses(processes, 1000);
  processes = [];
});

let service = (overrides: Partial<Service>): Service => ({
  name: '@x/api',
  directory: '.',
  start: [],
  env: {},
  health: [],
  ...overrides
});

describe('formatDotenv', () => {
  test('quotes values the same way Control does', () => {
    expect(
      formatDotenv({
        PLAIN: 'value',
        EMPTY: '',
        JSON: '{"a":1}',
        DOLLAR: 'a$b',
        QUOTE: "it's",
        MULTILINE: 'a\nb'
      })
    ).toBe(
      [
        `DOLLAR='a$b'`,
        `EMPTY=''`,
        `JSON='{"a":1}'`,
        `MULTILINE="a\\nb"`,
        `PLAIN=value`,
        `QUOTE="it's"`
      ].join('\n') + '\n'
    );
  });
});

describe('command arguments', () => {
  test('rsync protects generated directories and trailing slashes', () => {
    let args = rsyncArgs('/source/', '/workspace');
    expect(args).toContain('--delete');
    expect(args).toContain('--exclude=node_modules');
    expect(args).toContain('--exclude=.env');
    expect(args.slice(-2)).toEqual(['/source/', '/workspace/']);
  });

  test('turbo runs every test package of a stack', () => {
    expect(
      turboArgs({ name: 'api', tests: ['@x/a', '@x/b'], services: [], env: {} }, 2)
    ).toEqual([
      'x',
      'turbo',
      'run',
      'test:e2e',
      '--ui=stream',
      '--continue',
      '--concurrency=2',
      '--filter',
      '@x/a',
      '--filter',
      '@x/b'
    ]);
  });
});

describe('stack cache key', () => {
  let stack = (cacheKeyInputs?: unknown) => ({
    name: 'api',
    tests: [],
    services: ['@x/api'],
    env: {},
    cacheKeyInputs
  });

  test('is stable for identical service fingerprints', () => {
    let inputs = { version: 1, services: { '@x/api': { fingerprint: 'a1' } } };
    expect(stackCacheKey(stack(inputs))).toBe(stackCacheKey(stack(structuredClone(inputs))));
    expect(stackCacheKey(stack(inputs))).toMatch(/^[0-9a-f]{64}$/);
    expect(stackCacheKey(stack(inputs))).not.toBe(
      stackCacheKey(stack({ version: 1, services: { '@x/api': { fingerprint: 'a2' } } }))
    );
  });

  test('never matches a previous run when services could not be fingerprinted', () => {
    expect(stackCacheKey(stack())).not.toBe(stackCacheKey(stack()));
  });
});

describe('health', () => {
  test('defaults to 2xx and honours explicit statuses', () => {
    expect(isHealthyStatus(204)).toBe(true);
    expect(isHealthyStatus(404)).toBe(false);
    expect(isHealthyStatus(404, 404)).toBe(true);
    expect(isHealthyStatus(200, 204)).toBe(false);
  });

  test('tail keeps the last lines', () => {
    expect(tail('a\nb\nc', 2)).toBe('b\nc');
  });

  test('waits until every check passes', async () => {
    let ready = false;
    let server = Bun.serve({
      port: 0,
      fetch: () => new Response('ok', { status: ready ? 200 : 503 })
    });
    servers.push(server);
    setTimeout(() => (ready = true), 150);
    await waitHealthy(
      [service({ health: [{ url: `http://localhost:${server.port}/ping` }] })],
      [],
      5000,
      50
    );
  });

  test('fails fast with the log tail when a started process exits', async () => {
    let logs = mkdtempSync(path.join(tmpdir(), 'control-e2e-'));
    let cwd = mkdtempSync(path.join(tmpdir(), 'control-e2e-pkg-'));
    await Bun.write(
      path.join(cwd, 'package.json'),
      JSON.stringify({ name: 'crash', scripts: { boot: 'echo booting-crash && exit 3' } })
    );
    let crashing = service({
      name: '@x/crash',
      start: ['boot'],
      health: [{ url: 'http://localhost:1/ping' }]
    });
    processes = startService(crashing, cwd, logs);
    let error = await waitHealthy([crashing], processes, 10_000, 50).catch(error => error);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('exited with code 3');
    expect(error.message).toContain('booting-crash');
  });

  test('times out listing pending checks', async () => {
    let error = await waitHealthy(
      [service({ health: [{ url: 'http://localhost:1/ping' }] })],
      [],
      200,
      50
    ).catch(error => error);
    expect(error.message).toContain('did not become healthy');
    expect(error.message).toContain('http://localhost:1/ping');
  });
});
