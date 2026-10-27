import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { atomicWrite, readJson, writeJson } from '../src/files';
import { writeMetadata } from '../src/workspace';
import { executable, packageFixture, temporary, workspaceData } from './helpers';

let main = resolve(import.meta.dir, '../src/main.ts');

let fixture = async () => {
  let root = temporary();
  await Bun.$`git init -q ${root}`.quiet();
  packageFixture(root, '', '@metorial/oss', "mode='both'", { build: 'true' });
  packageFixture(
    root,
    'src/api',
    'api',
    "name='api'\n[dev]\nprepare=['bundle']\nrun=['dev:start']\ncleanup=['echo clean']\n[dev.env]\nVALUE='test $& value'",
    { 'dev:start': 'true', bundle: 'true', test: 'true' }
  );

  writeMetadata(
    root,
    workspaceData(root, { id: 'root', hostname: 'metorial-root.localhost' })
  );

  let bin = join(root, 'fake-bin');
  mkdirSync(bin);

  let log = join(root, 'commands.jsonl');
  let stub = `let fs=await import('node:fs');let args=process.argv.slice(2);fs.appendFileSync(process.env.CONTROL_TEST_LOG,JSON.stringify({program:process.argv[1].split('/').pop(),args,cwd:process.cwd(),value:process.env.VALUE})+'\\n');if(process.env.CONTROL_FAIL_TASK && args.includes(process.env.CONTROL_FAIL_TASK))process.exit(7);`;

  for (let name of ['bun', 'docker', 'code']) executable(bin, name, stub);
  mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
  executable(join(root, 'node_modules/.bin'), 'turbo', stub);

  let run = async (args: string[], cwd = root, env: Record<string, string> = {}) => {
    let child = Bun.spawn([process.execPath, main, ...args], {
      cwd,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        CONTROL_TEST_LOG: log,
        ...env
      },
      stdout: 'pipe',
      stderr: 'pipe'
    });
    let [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited
    ]);

    return { stdout, stderr, code };
  };
  let calls = (): { program: string; args: string[]; cwd: string; value?: string }[] =>
    existsSync(log)
      ? readFileSync(log, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line))
      : [];

  return { root, run, calls };
};

test('prepare writes environments then runs root build and package preparation with isolated values', async () => {
  let value = await fixture();
  let result = await value.run(['prepare', '--no-docker']);

  expect(result.code).toBe(0);

  let calls = value.calls();

  expect(calls.map(call => call.args.slice(0, 2))).toEqual([
    ['run', 'build'],
    ['run', 'bundle']
  ]);
  expect(calls[1]!.args).toEqual(['run', 'bundle', '--ui=stream', '--filter', 'api']);
  expect(calls[1]!.value).toBe('test $& value');
  expect(readFileSync(join(value.root, 'src/api/.env'), 'utf8')).toContain(
    "VALUE='test $& value'"
  );
});

test('unit filters pass unchanged with no setup commands', async () => {
  let value = await fixture();
  let result = await value.run(['test:unit', '@x/hash', '!@x/redis', '@x/api...', '[HEAD^]']);

  expect(result.code).toBe(0);
  expect(value.calls()).toHaveLength(1);
  expect(value.calls()[0]!.args).toEqual([
    'run',
    'test',
    '--ui=stream',
    '--concurrency=1',
    '--filter',
    '@x/hash',
    '--filter',
    '!@x/redis',
    '--filter',
    '@x/api...',
    '--filter',
    '[HEAD^]'
  ]);
  expect(existsSync(join(value.root, 'src/api/.env'))).toBe(false);
});

test('run lists scripts without Bun and forwards arguments from invoking subdirectory after env refresh', async () => {
  let value = await fixture();
  let directory = join(value.root, 'src/api/nested');
  mkdirSync(directory);

  let listed = await value.run(['run'], directory);

  expect(listed.code).toBe(0);
  expect(listed.stdout).toBe('control run bundle\ncontrol run dev:start\ncontrol run test\n');
  expect(value.calls()).toEqual([]);

  let executed = await value.run(['run', 'test', '--', '--flag', '$literal'], directory);

  expect(executed.code).toBe(0);
  expect(value.calls()[0]).toMatchObject({
    program: 'bun',
    args: ['run', 'test', '--', '--flag', '$literal'],
    cwd: directory
  });
  expect(existsSync(join(value.root, 'src/api/.env'))).toBe(true);
});

test('development generates Turbo workspace, unregisters proxy and executes cleanup', async () => {
  let value = await fixture();
  let result = await value.run(['dev', '--no-docker', '--no-prepare']);

  expect(result.code).toBe(0);

  let turbo = value.calls().find(call => call.program === 'turbo')!;

  expect(turbo.args).toEqual([
    'run',
    'dev',
    '--ui=stream',
    '--continue=always',
    '--concurrency=2',
    '--filter',
    'api'
  ]);
  expect(existsSync(join(value.root, '.control/dev/turbo/packages/api/run.mjs'))).toBe(true);
  expect(existsSync(join(value.root, '.control/proxy/dynamic/root.yml'))).toBe(false);
  expect(result.stdout).toContain('clean');
});

test('failed preparation does not start application processes', async () => {
  let value = await fixture();
  let result = await value.run(['dev', '--no-docker'], value.root, {
    CONTROL_FAIL_TASK: 'bundle'
  });

  expect(result.code).toBe(1);
  expect(value.calls().some(call => call.args[1] === 'dev')).toBe(false);
  expect(existsSync(join(value.root, '.control/dev/turbo'))).toBe(false);
});

test('database generation targets selected owners without starting Docker', async () => {
  let value = await fixture();
  packageFixture(value.root, 'src/db', 'db', undefined, {
    'control:db:generate': 'true',
    'control:db:push': 'true'
  });
  atomicWrite(
    join(value.root, 'src/api/control.toml'),
    "name='api'\n[dev.db.main]\nname='app'\nengine='postgres'\nenv='DATABASE_URL'\npackage='db'"
  );

  let result = await value.run(['db', 'generate', 'api']);

  expect(result.code).toBe(0);
  expect(value.calls()).toHaveLength(1);
  expect(value.calls()[0]!.args).toEqual([
    'run',
    'control:db:generate',
    '--ui=stream',
    '--concurrency=3',
    '--filter',
    'db'
  ]);
  expect(readFileSync(join(value.root, 'src/db/.env'), 'utf8')).toContain('/app');
});

test('workspace lifecycle forwards host stop and rejects Docker-only rebuild', async () => {
  let value = await fixture();
  let stopped = await value.run(['workspace', 'stop', '--volumes']);

  expect(stopped.code).toBe(0);
  expect(value.calls().at(-1)!.args).toEqual([
    'compose',
    '--file',
    join(value.root, '.control/dev/services.docker-compose.yml'),
    'down',
    '--volumes'
  ]);

  let rebuild = await value.run(['workspace', 'start', '--rebuild', '--no-open']);

  expect(rebuild.code).toBe(1);
  expect(rebuild.stderr).toContain('only supported by Docker workspaces');
});

test('host worktree creation clones databases once, then removes paired state safely', async () => {
  let value = await fixture();
  atomicWrite(
    join(value.root, '.gitignore'),
    '.control/\nenv.json\nnode_modules/\nfake-bin/\ncommands.jsonl\n'
  );
  atomicWrite(join(value.root, '.control/dev/services.docker-compose.yml'), '{}');
  await Bun.$`git -C ${value.root} add .`.quiet();
  await Bun.$`git -C ${value.root} -c user.name=Control -c user.email=control@example.com commit -qm fixture`.quiet();
  executable(
    join(value.root, 'fake-bin'),
    'docker',
    `
    import {appendFileSync} from 'node:fs';
    let args=process.argv.slice(2);
    appendFileSync(process.env.CONTROL_TEST_LOG,JSON.stringify({program:'docker',args,cwd:process.cwd()})+'\\n');
    if(args.includes('-At')) console.log('alpha\\nzeta');
    if(args.includes('pg_dump')) process.stdout.write(Buffer.alloc(100000,42));
    if(args.includes('pg_restore')) { let size=0;for await(let chunk of process.stdin) size+=chunk.length;if(size!==100000)process.exit(5); }
  `
  );
  let branch = 'feature/host';
  let target = value.root + '-feature-host';
  try {
    let created = await value.run(['workspace', 'create', branch, '--no-open']);
    expect(created.code).toBe(0);
    expect(existsSync(target)).toBe(true);
    expect(readJson(join(target, '.control/workspace.json'))).toMatchObject({
      runtime: 'host',
      branch,
      id: 'feature-host'
    });
    expect(value.calls().filter(call => call.args.includes('pg_dump'))).toHaveLength(2);
    expect(value.calls().filter(call => call.args.includes('pg_restore'))).toHaveLength(2);
    expect(existsSync(join(target, '.control/host-bootstrap-v1'))).toBe(true);
    expect(existsSync(join(target, '.control/root-postgres-cloned-v1'))).toBe(true);

    let listed = await value.run(['workspace', 'list']);
    expect(listed.stdout).toContain(branch);
    expect(listed.stdout).toContain(target);
    let started = await value.run(['workspace', 'start', branch, '--no-open']);
    expect(started.code, started.stderr).toBe(0);
    expect(value.calls().filter(call => call.args.includes('pg_dump'))).toHaveLength(2);

    let removed = await value.run(['workspace', 'remove', branch]);
    expect(removed.code).toBe(0);
    expect(existsSync(target)).toBe(false);
  } finally {
    await Bun.$`git -C ${value.root} worktree remove --force ${target}`.quiet().nothrow();
  }
}, 15000);

test('failed host initialization rolls back the worktree and newly created branch', async () => {
  let value = await fixture();
  atomicWrite(
    join(value.root, '.gitignore'),
    '.control/\nenv.json\nnode_modules/\nfake-bin/\ncommands.jsonl\n'
  );
  atomicWrite(join(value.root, '.control/dev/services.docker-compose.yml'), '{}');
  await Bun.$`git -C ${value.root} add .`.quiet();
  await Bun.$`git -C ${value.root} -c user.name=Control -c user.email=control@example.com commit -qm fixture`.quiet();
  let target = value.root + '-feature-rollback';
  let result = await value.run(
    ['workspace', 'create', 'feature/rollback', '--no-open'],
    value.root,
    { CONTROL_FAIL_TASK: 'install' }
  );
  expect(result.code).toBe(1);
  expect(result.stderr).toContain('rolled back');
  expect(existsSync(target)).toBe(false);
  let branch =
    await Bun.$`git -C ${value.root} show-ref --verify --quiet refs/heads/feature/rollback`
      .quiet()
      .nothrow();
  expect(branch.exitCode).not.toBe(0);
});

test('image E2E execution starts services in order, probes health, captures logs and cleans up on failure', async () => {
  let value = await fixture();
  atomicWrite(
    join(value.root, 'src/api/control.toml'),
    "name='api'\n[endpoints.http]\nport=52001\nhealth='/ready'\n[e2e]\nimage='api'\ntests=['../tests']"
  );
  packageFixture(value.root, 'src/tests', 'api-tests', undefined, { 'test:e2e': 'true' });
  atomicWrite(join(value.root, 'scripts/dev-tools/e2e/runner.ts'), '');
  atomicWrite(join(value.root, 'scripts/dev-tools/e2e/Dockerfile'), 'FROM scratch\n');
  atomicWrite(join(value.root, 'scripts/dev-tools/e2e/entrypoint.sh'), '#!/bin/sh\n');
  let images = join(value.root, 'images');
  writeJson(join(images, 'api.json'), {
    name: 'api',
    image: 'ghcr.io/metorial/api@sha256:' + 'a'.repeat(64)
  });
  executable(
    join(value.root, 'fake-bin'),
    'docker',
    `
    import {appendFileSync} from 'node:fs';
    let args=process.argv.slice(2);
    appendFileSync(process.env.CONTROL_TEST_LOG,JSON.stringify({program:'docker',args,cwd:process.cwd()})+'\\n');
    if(args.includes('curl')) console.log('200');
    if(args.includes('logs')) console.log('captured service output');
    if(args.includes('runner')) process.exit(8);
  `
  );
  let result = await value.run(['test:e2e', '--images', images]);
  expect(result.code).toBe(1);
  let calls = value.calls().filter(call => call.program === 'docker');
  let up = calls.filter(call => call.args.includes('up'));
  expect(up[0]!.args).toContain('gateway');
  expect(up[1]!.args).toContain('app-api');
  expect(calls.some(call => call.args.includes('curl'))).toBe(true);
  expect(calls.at(-1)!.args.slice(-5)).toEqual([
    'down',
    '--volumes',
    '--remove-orphans',
    '--timeout',
    '5'
  ]);
  let logs = [
    ...new Bun.Glob('*/logs/compose.log').scanSync({
      cwd: join(value.root, '.control/e2e'),
      absolute: true
    })
  ];
  expect(logs).toHaveLength(1);
  expect(readFileSync(logs[0]!, 'utf8')).toContain('captured service output');
});

test('legacy Docker workspace start and stop preserve container and volume contracts', async () => {
  let value = await fixture();
  writeMetadata(
    value.root,
    workspaceData(join(value.root, 'source-checkout'), {
      runtime: 'docker',
      service_ports: undefined,
      endpoint_ports: {}
    })
  );
  atomicWrite(join(value.root, 'scripts/dev-tools/workspace/Dockerfile'), 'FROM scratch\n');
  atomicWrite(join(value.root, 'scripts/dev-tools/workspace/entrypoint.sh'), '#!/bin/sh\n');
  executable(
    join(value.root, 'fake-bin'),
    'docker',
    `
    import {appendFileSync} from 'node:fs';
    let args=process.argv.slice(2);
    appendFileSync(process.env.CONTROL_TEST_LOG,JSON.stringify({program:'docker',args,cwd:process.cwd()})+'\\n');
    if(args[0]==='inspect') {
      if(args.includes('{{.Id}}')) console.log('container-id');
      else if(args.includes('{{json .NetworkSettings.Networks}}')) console.log('{}');
      else process.exit(1);
    }
  `
  );
  let started = await value.run(['workspace', 'start', '--no-open']);
  expect(started.code, started.stderr).toBe(0);
  let calls = value.calls();
  let created = calls.find(call => call.args[0] === 'create')!;
  expect(created.args).toContain('metorial-ws-feature');
  expect(created.args).toContain('CONTROL_SERVICE_POSTGRES=postgres-db2:5432');
  expect(created.args).toContain('control-feature-vscode-server:/root/.vscode-server');
  expect(
    calls.some(
      call =>
        call.args.includes('workspace-entrypoint') ||
        call.args.includes('/usr/local/bin/workspace-entrypoint')
    )
  ).toBe(true);
  expect(
    calls.some(
      call =>
        call.args.includes('connect') &&
        call.args.includes('control_ws_feature_workspace-services')
    )
  ).toBe(true);

  let stopped = await value.run(['workspace', 'stop', '--volumes']);
  expect(stopped.code).toBe(0);
  expect(
    value.calls().filter(call => call.args[0] === 'volume' && call.args[1] === 'rm')
  ).toHaveLength(8);
});
