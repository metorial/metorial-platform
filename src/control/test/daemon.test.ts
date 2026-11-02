import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { LogStore, replayLines } from '../src/daemon/logs';
import { WorkspaceRuntime } from '../src/daemon/runtime';
import { delay } from '../src/process';
import { writeMetadata } from '../src/workspace';
import { checkout, packageFixture, workspaceData } from './helpers';

let until = async (check: () => boolean, label: string, timeout = 8000) => {
  let deadline = Date.now() + timeout;

  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await delay(50);
  }
};

describe('LogStore', () => {
  test('splits lines, keeps partial lines and filters by unit', () => {
    let store = new LogStore();
    store.append('api', 'one\ntw');
    store.append('api', 'o\nthree\n');
    store.append('web', 'hello\n');

    expect(store.query({ units: ['api'] }).map(line => line.text)).toEqual([
      'one',
      'two',
      'three'
    ]);
    expect(store.query({ tail: 1 }).map(line => line.text)).toEqual(['three', 'hello']);
    expect(store.query({ since: 3 })).toHaveLength(1);
  });
});

describe('LogStore replay', () => {
  test('keeps the last lines of every service independently', () => {
    let store = new LogStore();
    store.append('quiet', 'first\n');
    for (let index = 0; index < replayLines * 3; index++)
      store.append('chatty', `line ${index}\n`);

    let replay = store.query({ tail: replayLines });
    let chatty = replay.filter(line => line.unit === 'chatty');

    expect(replay.some(line => line.unit === 'quiet')).toBe(true);
    expect(chatty).toHaveLength(replayLines);
    expect(chatty.at(-1)!.text).toBe(`line ${replayLines * 3 - 1}`);
    expect(replay.map(line => line.seq)).toEqual(
      [...replay.map(line => line.seq)].sort((a, b) => a - b)
    );
  });
});

describe('WorkspaceRuntime', () => {
  let build = async () => {
    let project = checkout();
    packageFixture(
      project.root,
      'api',
      'api',
      [
        "name='api'",
        '[run.dev]',
        "command='echo api-up; exec sleep 300'",
        '[run.worker]',
        "command='echo worker-up; exec sleep 300'",
        "depends_on=['dev']",
        '[run.flaky]',
        "command='echo boom; exit 3'"
      ].join('\n')
    );
    let data = workspaceData(project.root, {
      source_root: join(project.root, 'elsewhere'),
      runtime: 'docker'
    });
    writeMetadata(project.root, data);
    let logs = new LogStore(join(project.root, '.logs'));
    let changes = 0;
    let runtime = new WorkspaceRuntime(project, data, logs, () => changes++);

    return { runtime, logs, project };
  };

  test('starts services in order, captures logs, restarts one unit and stops', async () => {
    let { runtime, logs } = await build();
    await runtime.start({ noDocker: true, noPrepare: true, noProxy: true });

    expect(runtime.phase).toBe('running');
    let info = runtime.info();
    expect(info.units.map(unit => unit.name).sort()).toEqual([
      'api',
      'api-flaky',
      'api-worker'
    ]);

    await until(
      () => logs.query({ units: ['api'] }).some(line => line.text === 'api-up'),
      'api log'
    );
    await until(
      () => logs.query({ units: ['api-worker'] }).some(line => line.text === 'worker-up'),
      'worker log'
    );

    let before = runtime.info().units.find(unit => unit.name === 'api')!.pid;
    await runtime.restartUnit('api');
    await until(
      () => !!runtime.info().units.find(unit => unit.name === 'api')!.pid,
      'restart'
    );
    let after = runtime.info().units.find(unit => unit.name === 'api')!;
    expect(after.pid).not.toBe(before);
    expect(after.state).toBe('running');

    await until(
      () => runtime.info().units.find(unit => unit.name === 'api-flaky')!.restarts >= 1,
      'crash restart'
    );
    expect(
      logs.query({ units: ['api-flaky'] }).some(line => line.text.includes('restarting in'))
    ).toBe(true);

    await runtime.stop();
    expect(runtime.phase).toBe('stopped');
    expect(runtime.info().units.every(unit => unit.state === 'stopped')).toBe(true);
  }, 30_000);

  test('reports a failed start without leaving processes behind', async () => {
    let project = checkout();
    let data = workspaceData(project.root, {
      source_root: join(project.root, 'elsewhere'),
      runtime: 'docker'
    });
    writeMetadata(project.root, data);
    let runtime = new WorkspaceRuntime(project, data, new LogStore(), () => {});
    await runtime.start({ noDocker: true, noPrepare: true, noProxy: true });

    expect(runtime.phase).toBe('failed');
    expect(runtime.error).toContain('no control.toml');
    expect(runtime.startable).toBe(true);
  });
});
