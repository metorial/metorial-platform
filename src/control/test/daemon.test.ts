import { describe, expect, spyOn, test } from 'bun:test';
import { join } from 'node:path';
import * as docker from '../src/docker';
import * as dev from '../src/dev';
import * as commands from '../src/process';
import { LogStore, replayLines } from '../src/daemon/logs';
import { WorkspaceRuntime } from '../src/daemon/runtime';
import { delay } from '../src/process';
import { writeMetadata } from '../src/workspace';
import { checkout, packageFixture, workspaceData, writeManifest } from './helpers';

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

  test('resets declared volumes even before the workspace has started', async () => {
    let { runtime, project } = await build();
    writeManifest(project.root, '[docker]\ncompose=["services.docker-compose.yml"]');
    let reset = spyOn(docker, 'reset').mockResolvedValue(undefined);

    try {
      await runtime.clean();

      expect(reset).toHaveBeenCalledTimes(1);
      expect(reset.mock.calls[0]![0]).toBe(project.root);
      expect(reset.mock.calls[0]![1]).toContainEqual([
        join(project.root, 'services.docker-compose.yml'),
        []
      ]);
      expect(reset.mock.calls[0]![3]).toBe(false);
      expect(runtime.phase).toBe('stopped');
    } finally {
      reset.mockRestore();
    }
  });

  test('interrupts a blocked preparation and can restart immediately', async () => {
    let { runtime } = await build();
    let preparing = false;
    let prepare = spyOn(dev, 'prepareSelected').mockImplementation(async () => {
      preparing = true;
      await commands.delay(60_000);
    });
    let start = runtime.start({ noDocker: true, noPrepare: true, noProxy: true });

    try {
      await until(() => preparing, 'preparation');
      prepare.mockRestore();
      await runtime.restartWorkspace();
      await start;

      expect(runtime.phase).toBe('running');
      expect(runtime.error).toBeUndefined();
    } finally {
      prepare.mockRestore();
      await runtime.stop();
    }
  });

  test('stops and restarts individual services while dependencies are starting', async () => {
    let { runtime } = await build();
    let start = runtime.start({ noDocker: true, noPrepare: true, noProxy: true });

    try {
      await until(
        () =>
          runtime.phase === 'starting' &&
          !!runtime.info().units.find(u => u.name === 'api')?.pid,
        'first service'
      );
      await runtime.stopServiceUnit('api-worker');
      await runtime.restartUnit('api');
      await start;

      expect(runtime.phase).toBe('running');
      expect(runtime.info().units.find(u => u.name === 'api-worker')!.state).toBe('stopped');
      expect(runtime.info().units.find(u => u.name === 'api')!.pid).toBeDefined();
    } finally {
      await runtime.stop();
    }
  });

  test('cancels a start before the first asynchronous step finishes', async () => {
    let { runtime } = await build();
    let start = runtime.start({ noDocker: true, noPrepare: true, noProxy: true });
    await runtime.stop();
    await start;

    expect(runtime.phase).toBe('stopped');
    expect(runtime.info().units.every(unit => !unit.pid)).toBe(true);
  });

  test('stops services before resetting and reports reset failures', async () => {
    let { runtime } = await build();
    await runtime.start({ noDocker: true, noPrepare: true, noProxy: true });
    let reset = spyOn(docker, 'reset').mockImplementation(async () => {
      expect(runtime.info().units.every(unit => unit.state === 'stopped')).toBe(true);

      throw new Error('volume is in use');
    });

    try {
      await expect(runtime.clean()).rejects.toThrow('volume is in use');
      expect(runtime.phase).toBe('failed');
      expect(runtime.info().error).toBe('volume is in use');
    } finally {
      reset.mockRestore();
      await runtime.stop();
    }
  });

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

  test('reloads changed definitions and restarts only the units that differ', async () => {
    let { runtime, logs, project } = await build();
    await runtime.start({ noDocker: true, noPrepare: true, noProxy: true });

    let unit = (name: string) => runtime.info().units.find(item => item.name === name)!;
    let system = () => logs.query({ units: ['control'] }).map(line => line.text);
    await until(() => !!unit('api').pid && !!unit('api-worker').pid, 'services up');

    let apiPid = unit('api').pid;
    let workerPid = unit('api-worker').pid;

    await runtime.reloadDefinitions();
    expect(unit('api').pid).toBe(apiPid);
    expect(system().some(line => line.includes('no material changes'))).toBe(true);

    let manifest = (worker: string) =>
      [
        "name='api'",
        '[run.dev]',
        "command='echo api-up; exec sleep 300'",
        '[run.worker]',
        `command='${worker}'`,
        "depends_on=['dev']",
        '[run.flaky]',
        "command='echo boom; exit 3'"
      ].join('\n');

    writeManifest(join(project.root, 'api'), manifest('echo worker-v2; exec sleep 300'));
    await runtime.reloadDefinitions();

    await until(
      () => !!unit('api-worker').pid && unit('api-worker').pid !== workerPid,
      'worker restarted'
    );
    expect(unit('api').pid).toBe(apiPid);
    await until(
      () => logs.query({ units: ['api-worker'] }).some(line => line.text === 'worker-v2'),
      'new worker output'
    );
    expect(system().some(line => line.includes('restarted api-worker'))).toBe(true);

    writeManifest(join(project.root, 'api'), manifest('echo worker-v3; exec sleep 300'));
    await until(
      () => logs.query({ units: ['api-worker'] }).some(line => line.text === 'worker-v3'),
      'file watcher reload',
      10_000
    );

    writeManifest(join(project.root, 'api'), "name='api'\nbogus=true");
    await runtime.reloadDefinitions();
    expect(system().some(line => line.includes('definition reload failed'))).toBe(true);
    expect(unit('api').pid).toBe(apiPid);

    await runtime.stop();
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
    expect(runtime.error).toContain('no control manifests');
    expect(runtime.startable).toBe(true);
  });
});
