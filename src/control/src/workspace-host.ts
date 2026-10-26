import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from './files';
import * as dev from './dev';
import { composePrefix } from './docker';
import { rootEnvironment } from './environment';
import * as commands from './process';
import { unregisterWorkspace } from './proxy';
import { metadata } from './workspace';
import type { ProjectRoot, WorkspaceMetadata } from './types';

let sourceDatabaseQuery =
  "SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate AND datname <> 'postgres' ORDER BY datname";

export let composePath = (project: ProjectRoot) =>
  join(project.root, '.control/dev/services.docker-compose.yml');

export let parseDatabaseNames = (text: string) =>
  [
    ...new Set(
      text
        .split('\n')
        .map(name => name.trim())
        .filter(Boolean)
    )
  ].sort();

let hostMetadata = async (project: ProjectRoot) => {
  let data = await metadata(project);
  if (data.runtime !== 'host') throw new Error(`workspace ${data.id} is not a host workspace`);

  if (!data.service_ports) throw new Error('host workspace metadata is missing service_ports');

  return data;
};

export let clonePostgres = async (project: ProjectRoot, data: WorkspaceMetadata) => {
  let marker = join(project.root, '.control/root-postgres-cloned-v1');
  if (existsSync(marker)) {
    console.log('Root Postgres snapshot is already installed');

    return;
  }

  let source = join(data.source_root, '.control/dev/services.docker-compose.yml');
  if (!existsSync(source))
    throw new Error(
      `root workspace has no dependency services at ${source}; start the root workspace first`
    );
  console.log('Starting root Postgres for workspace snapshot');

  await commands.run(
    'docker',
    [
      ...composePrefix(source),
      'up',
      '--detach',
      '--wait',
      '--wait-timeout',
      '60',
      'postgres-db2'
    ],
    data.source_root
  );

  let databases = parseDatabaseNames(
    await commands.output(
      'docker',
      [
        ...composePrefix(source),
        'exec',
        '-T',
        'postgres-db2',
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-At',
        '-c',
        sourceDatabaseQuery
      ],
      data.source_root
    )
  );
  let target = composePath(project);

  for (let database of databases) {
    console.log(`Cloning root Postgres database ${database}`);

    await commands.run(
      'docker',
      [
        ...composePrefix(target),
        'exec',
        '-T',
        'postgres-db2',
        'dropdb',
        '-U',
        'postgres',
        '--if-exists',
        '--force',
        '--',
        database
      ],
      project.root
    );

    await commands.run(
      'docker',
      [
        ...composePrefix(target),
        'exec',
        '-T',
        'postgres-db2',
        'createdb',
        '-U',
        'postgres',
        '--encoding=UTF8',
        '--',
        database
      ],
      project.root
    );

    await commands.pipe(
      'docker',
      [
        ...composePrefix(source),
        'exec',
        '-T',
        'postgres-db2',
        'pg_dump',
        '-U',
        'postgres',
        '--format=custom',
        '--no-owner',
        '--no-acl',
        '--',
        database
      ],
      'docker',
      [
        ...composePrefix(target),
        'exec',
        '-T',
        'postgres-db2',
        'pg_restore',
        '-U',
        'postgres',
        '--exit-on-error',
        '--no-owner',
        '--no-acl',
        '--dbname',
        database
      ],
      project.root
    );
  }
  atomicWrite(marker, 'v1');
  console.log('Root Postgres snapshot installed');
};

export let initialize = async (project: ProjectRoot, cloneRootPostgres: boolean) => {
  let data = await hostMetadata(project);
  let { selected, env } = await dev.selection(project, []);
  await (await import('./docker')).start(project.root, selected, env);

  if (cloneRootPostgres) await clonePostgres(project, data);

  let marker = join(project.root, '.control/host-bootstrap-v1');
  if (existsSync(marker)) {
    console.log('Workspace setup is already current');

    return;
  }
  console.log('Installing host workspace dependencies');

  await commands.run('bun', ['install'], project.root, rootEnvironment(project));
  console.log('Running Control prepare');

  await dev.runPrepare(project, [], true);
  atomicWrite(marker, 'v1');
  console.log('Host workspace setup complete');
};

export let open = async (project: ProjectRoot) =>
  commands.run('code', ['--new-window', project.root], project.root);

export let run = async (project: ProjectRoot, rebuild: boolean, openCode: boolean) => {
  if (rebuild) throw new Error('--rebuild is only supported by Docker workspaces');

  await initialize(project, false);

  if (openCode) await open(project);
};

export let control = async (project: ProjectRoot) => {
  await initialize(project, false);

  await dev.run(project, [], false, false, false, false);
};

export let shell = async (project: ProjectRoot) => {
  await initialize(project, false);

  await commands.run(
    process.env.SHELL ?? '/bin/zsh',
    ['-l'],
    project.root,
    rootEnvironment(project)
  );
};

export let stop = async (project: ProjectRoot, volumes: boolean) => {
  let data = await hostMetadata(project);
  await unregisterWorkspace(project, data);

  await commands.run(
    'docker',
    [...composePrefix(composePath(project)), ...(volumes ? ['down', '--volumes'] : ['stop'])],
    project.root
  );
  console.log(
    volumes
      ? 'stopped host workspace and removed its dependency data'
      : 'stopped host workspace; dependency data was retained'
  );
};

export let status = async (project: ProjectRoot) => {
  let data = await hostMetadata(project);
  console.log(
    `workspace: ${data.id}\nbranch: ${data.branch}\nruntime: host\nhostname: ${data.hostname}`
  );

  for (let key of ['postgres', 'mongo', 'redis', 'nats', 'etcd'] as const)
    console.log(
      `${key}: localhost:${data.service_ports![key === 'etcd' ? 'etcd_client' : key]}`
    );

  let compose = composePath(project);
  if (!existsSync(compose)) {
    console.log('dependencies: not initialized');

    return;
  }

  let count = async (args: string[]) =>
    (
      await commands
        .output('docker', [...composePrefix(compose), ...args], project.root)
        .catch(() => '')
    )
      .split('\n')
      .filter(Boolean).length;
  console.log(
    `dependencies: ${await count(['ps', '--status', 'running', '--quiet'])}/${await count(['config', '--services'])} running`
  );
};
