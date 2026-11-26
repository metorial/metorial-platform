import { describe, expect, spyOn, test } from 'bun:test';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  truncateSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import * as docker from '../src/docker';
import * as dev from '../src/dev';
import { discover } from '../src/manifest';
import * as commands from '../src/process';
import * as ports from '../src/ports';
import { logMaxBytes } from '../src/daemon/home';
import { LogStore, replayLines } from '../src/daemon/logs';
import { linksFor, WorkspaceRuntime } from '../src/daemon/runtime';
import { delay } from '../src/process';
import { writeMetadata } from '../src/workspace';
import {
  checkout,
  listenerFixture,
  packageFixture,
  temporary,
  workspaceData,
  writeManifest
} from './helpers';

let until = async (check: () => boolean, label: string, timeout = 8000) => {
  let deadline = Date.now() + timeout;

  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await delay(50);
  }
};

test('DB Explorer links follow the workspace hostname and require Postgres', () => {
  let project = checkout('oss');
  let data = workspaceData(project.root);
  packageFixture(project.root, 'api', 'api', "name='api'\n[[resources]]\ntype='postgres'");
  let selected = discover(project.root);

  expect(linksFor(data, selected)).toContainEqual({
    label: 'DB Explorer',
    group: 'tool',
    url: `http://${data.hostname}:4983`
  });
  expect(linksFor(data, [])).toEqual([]);
});

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

describe('LogStore files', () => {
  let size = (file: string) => (existsSync(file) ? statSync(file).size : 0);
  let texts = (file: string) =>
    readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .map(line => line.split(' ').slice(2).join(' '));

  test('rotates at the cap while writing and keeps one older generation', () => {
    let directory = temporary();
    let file = join(directory, 'api.log');
    let store = new LogStore(directory, 1000);
    let largest = 0;

    for (let index = 0; index < 200; index++) {
      store.append(
        'api',
        `line ${String(index).padStart(3, '0')}\n`,
        index % 2 ? 'err' : 'out'
      );
      largest = Math.max(largest, size(file) + size(`${file}.1`));
      expect(size(file)).toBeLessThanOrEqual(1000);
      expect(size(`${file}.1`)).toBeLessThanOrEqual(1000);
    }

    let older = texts(`${file}.1`);
    let newer = texts(file);
    let kept = [...older, ...newer];

    expect(largest).toBeLessThanOrEqual(2000);
    expect(older.length).toBeGreaterThan(0);
    expect(older.includes('line 000')).toBe(false);
    expect(newer.at(-1)).toBe('line 199');
    expect(kept).toEqual(
      kept.map((_, index) => `line ${String(200 - kept.length + index).padStart(3, '0')}`)
    );
    expect(store.query({ units: ['api'] })).toHaveLength(200);
  });

  test('moves an oversized file left from an earlier run aside on the first write', () => {
    let directory = temporary();
    let file = join(directory, 'api.log');
    writeFileSync(file, 'x'.repeat(5000));
    let store = new LogStore(directory, 1000);

    store.append('api', 'fresh\n');

    expect(size(`${file}.1`)).toBe(5000);
    expect(texts(file)).toEqual(['fresh']);
  });

  test('never writes through or truncates a symlinked log file', () => {
    let directory = temporary();
    let outside = temporary();
    let target = join(outside, 'target');
    let older = join(outside, 'older');
    writeFileSync(target, 't'.repeat(5000));
    writeFileSync(older, 'o'.repeat(5000));
    symlinkSync(target, join(directory, 'api.log'));
    writeFileSync(join(directory, 'web.log'), 'w'.repeat(5000));
    symlinkSync(older, join(directory, 'web.log.1'));
    let store = new LogStore(directory, 1000);

    for (let index = 0; index < 5; index++) {
      store.append('api', 'line\n');
      store.append('web', 'line\n');
    }

    expect(readFileSync(target, 'utf8')).toBe('t'.repeat(5000));
    expect(readFileSync(older, 'utf8')).toBe('o'.repeat(5000));
    expect(lstatSync(join(directory, 'web.log.1')).isSymbolicLink()).toBe(false);
    expect(texts(join(directory, 'web.log'))).toHaveLength(5);
    expect(store.query({ units: ['api'] })).toHaveLength(5);
  });

  test('does not rotate early after the file was truncated outside the daemon', () => {
    let directory = temporary();
    let file = join(directory, 'api.log');
    let store = new LogStore(directory, 1000);

    for (let index = 0; index < 12; index++) store.append('api', `${'a'.repeat(30)}\n`);
    truncateSync(file);
    for (let index = 0; index < 10; index++) store.append('api', `${'b'.repeat(30)}\n`);

    expect(existsSync(`${file}.1`)).toBe(false);
    expect(texts(file)).toHaveLength(10);
  });

  test('never throws and still bounds the file when rotation fails', () => {
    let directory = temporary();
    let file = join(directory, 'api.log');
    mkdirSync(join(`${file}.1`, 'blocked'), { recursive: true });
    let store = new LogStore(directory, 1000);

    for (let index = 0; index < 100; index++) {
      store.append('api', `${'c'.repeat(30)}\n`);
      expect(size(file)).toBeLessThanOrEqual(1000);
    }

    rmSync(directory, { recursive: true, force: true });
    expect(() => store.append('api', 'gone\n')).not.toThrow();
    expect(store.query({ units: ['api'] }).at(-1)!.text).toBe('gone');
  });

  test('reads the cap from CONTROL_LOG_MAX_BYTES with a default and a minimum', () => {
    let previous = process.env.CONTROL_LOG_MAX_BYTES;
    let read = (value?: string) => {
      if (value === undefined) delete process.env.CONTROL_LOG_MAX_BYTES;
      else process.env.CONTROL_LOG_MAX_BYTES = value;

      return logMaxBytes();
    };

    try {
      expect(read()).toBe(50 * 1024 * 1024);
      expect(read('0')).toBe(50 * 1024 * 1024);
      expect(read('-5')).toBe(50 * 1024 * 1024);
      expect(read('lots')).toBe(50 * 1024 * 1024);
      expect(read('100')).toBe(1024 * 1024);
      expect(read(' 104857600 ')).toBe(104857600);
    } finally {
      if (previous === undefined) delete process.env.CONTROL_LOG_MAX_BYTES;
      else process.env.CONTROL_LOG_MAX_BYTES = previous;
    }
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

  test('clears the allocated bind port before starts and restarts without killing sibling services', async () => {
    let project = checkout();
    await commands.output('git', ['init'], project.root);
    let orphan = await listenerFixture(project.root);

    let publicServer = createServer();
    await new Promise<void>(resolve => publicServer.listen(0, '127.0.0.1', resolve));
    let publicPort = (publicServer.address() as { port: number }).port;

    let source = `require('node:net').createServer().listen(Number(process.env.PORT), '127.0.0.1', () => console.log('listening'))`;
    let command = `${process.execPath} -e ${JSON.stringify(source)}`;
    packageFixture(
      project.root,
      'api',
      'api',
      [
        "name='api'",
        '[endpoints.http]',
        `port=${publicPort}`,
        "env=[{key='PORT',value='{{BIND_PORT}}'}]",
        '[run.dev]',
        `command=${JSON.stringify(command)}`,
        '[run.worker]',
        "command='echo worker-up; exec sleep 300'",
        "depends_on=['dev']"
      ].join('\n')
    );

    let data = workspaceData(project.root, {
      source_root: join(project.root, 'elsewhere'),
      endpoint_ports: { api: { http: orphan.port } }
    });
    writeMetadata(project.root, data);

    let logs = new LogStore();
    let runtime = new WorkspaceRuntime(project, data, logs, () => {});
    let unit = (name: string) => runtime.info().units.find(item => item.name === name)!;

    try {
      await runtime.start({ noDocker: true, noPrepare: true, noProxy: true });
      if (runtime.phase !== 'running') throw new Error(runtime.error);
      await until(
        () => logs.query({ units: ['api'] }).some(line => line.text === 'listening'),
        'api listener'
      );

      expect(runtime.phase).toBe('running');
      expect(unit('api').ports).toEqual([orphan.port]);
      expect(
        logs
          .query({ units: ['api'] })
          .some(
            line =>
              line.text.includes(`pid ${orphan.child.pid}`) && line.text.includes('SIGTERM')
          )
      ).toBe(true);
      expect(publicServer.listening).toBe(true);

      let pid = unit('api').pid;
      await runtime.restartUnit('api-worker');

      expect(unit('api').pid).toBe(pid);
      expect(await ports.listeningProcesses([orphan.port], project.root)).toHaveLength(1);

      await runtime.stopServiceUnit('api');
      let replacement = await listenerFixture(project.root);
      data.endpoint_ports.api!.http = replacement.port;
      writeMetadata(project.root, data);
      await runtime.reloadDefinitions();

      try {
        await runtime.startServiceUnit('api');
        await until(
          () =>
            logs.query({ units: ['api'] }).filter(line => line.text === 'listening').length >=
            2,
          'restarted listener'
        );

        expect(
          logs
            .query()
            .some(
              line =>
                line.text.includes(`pid ${replacement.child.pid}`) &&
                line.text.includes('SIGTERM')
            )
        ).toBe(true);
        expect(publicServer.listening).toBe(true);
      } finally {
        commands.signalTree(replacement.child, 'SIGKILL');
      }
    } finally {
      await runtime.stop();
      commands.signalTree(orphan.child, 'SIGKILL');
      await new Promise<void>(resolve => publicServer.close(() => resolve()));
    }
  }, 20_000);

  test('stopping during the port check prevents a delayed service launch', async () => {
    let { runtime } = await build();
    await runtime.start({ noDocker: true, noPrepare: true, noProxy: true });
    await runtime.stopServiceUnit('api');

    let checking = false;
    let release!: () => void;
    let check = spyOn(ports, 'clearServicePorts').mockImplementation(async () => {
      checking = true;
      await new Promise<void>(resolve => (release = resolve));
    });

    try {
      let starting = runtime.startServiceUnit('api');
      await until(() => checking, 'port check');
      let stopping = runtime.stopServiceUnit('api');
      release();
      await Promise.all([starting, stopping]);

      expect(runtime.info().units.find(unit => unit.name === 'api')).toMatchObject({
        state: 'stopped',
        pid: undefined
      });
    } finally {
      check.mockRestore();
      await runtime.stop();
    }
  });

  test('retries a failed port check during a definition reload', async () => {
    let { runtime, project, logs } = await build();
    await runtime.start({ noDocker: true, noPrepare: true, noProxy: true });
    let check = spyOn(ports, 'clearServicePorts').mockRejectedValueOnce(
      new Error('could not inspect service port')
    );

    try {
      writeManifest(
        join(project.root, 'api'),
        "name='api'\n[run.dev]\ncommand='echo reloaded; exec sleep 300'"
      );
      await runtime.reloadDefinitions();

      expect(runtime.phase).toBe('running');
      expect(runtime.info().units.find(unit => unit.name === 'api')!.state).toBe('crashed');
      expect(
        logs
          .query({ units: ['api'] })
          .some(line => line.text.includes('could not inspect service port'))
      ).toBe(true);

      check.mockRestore();
      await until(
        () => logs.query({ units: ['api'] }).some(line => line.text === 'reloaded'),
        'retry after port check failure'
      );
      expect(runtime.info().units.find(unit => unit.name === 'api')!.state).toBe('running');
    } finally {
      check.mockRestore();
      await runtime.stop();
    }
  });
});
