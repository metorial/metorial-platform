import { rustPathHash } from './hash';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { basename, dirname, join, resolve } from 'node:path';
import { canonical } from './files';
import { defaultPorts, mongoUrl, portKey } from './environment';
import * as infrastructure from './infrastructure';
import * as commands from './process';
import type { Database, Environment, LoadedManifest, ServicePorts } from './types';

export type ComposeProject = [string, string[]];

export let composePrefix = (compose: string) => [
  'compose',
  ...(basename(compose) === 'services.docker-compose.yml' &&
  !compose.split('/').includes('.control')
    ? ['--project-name', 'dev_services']
    : []),
  '--file',
  compose
];

export let servicePorts = (env: Environment): ServicePorts =>
  Object.fromEntries(
    Object.keys(defaultPorts).map(name => {
      let value = env[portKey(name)];
      if (value === undefined || !/^\d+$/.test(value) || Number(value) > 65535)
        throw new Error(`invalid or missing ${portKey(name)}`);

      return [name, Number(value)];
    })
  ) as unknown as ServicePorts;

export let declaredComposeProjects = (
  root: string,
  manifests: LoadedManifest[]
): ComposeProject[] => {
  let projects = new Map<string, Set<string>>();
  let add = (path: string, services: string[]) =>
    projects.set(path, new Set([...(projects.get(path) ?? []), ...services]));

  for (let loaded of manifests) {
    let base = dirname(loaded.path) || root;

    for (let path of loaded.manifest.docker.compose)
      add(resolve(base, path), loaded.manifest.docker.services);

    for (let db of [
      ...Object.values(loaded.manifest.postgres),
      ...Object.values(loaded.manifest.mongo)
    ])
      if (db.compose) add(resolve(base, db.compose), db.service ? [db.service] : []);
  }

  return [...projects]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, services]) => [path, [...services].sort()]);
};

export let composeProjects = (root: string, manifests: LoadedManifest[]) => {
  let projects = declaredComposeProjects(root, manifests);
  let names = infrastructure.serviceNames(infrastructure.requirementsFromManifests(manifests));
  let generated = join(root, '.control/dev/services.docker-compose.yml');
  if (names.length && existsSync(generated)) projects.push([generated, names]);

  return projects.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
};

export let stop = async (root: string, projects: ComposeProject[], env: Environment) => {
  for (let [compose, services] of [...projects].reverse()) {
    await commands
      .run(
        'docker',
        [...composePrefix(compose), ...(services.length ? ['stop', ...services] : ['down'])],
        root,
        env
      )
      .catch(error => console.error(`warning: could not stop Docker services: ${error}`));
  }
};

export let portReachable = (port: number, host = '127.0.0.1') =>
  new Promise<boolean>(resolve => {
    let socket = createConnection({ port, host });
    let finish = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(500, () => finish(false));
    socket.once('error', () => finish(false));

    socket.once('connect', () => finish(true));
  });

export let retry = async (name: string, operation: () => Promise<void>) => {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await operation();

      return;
    } catch (error) {
      if (error instanceof commands.Interrupted) throw error;
    }

    await commands.delay(1000);
  }
  throw new Error(`${name} did not become ready within 30 seconds`);
};

export let waitPostgres = async (root: string, base: string, db: Database, env: Environment) =>
  retry('Postgres', async () => {
    if (db.compose && db.service)
      await commands.runQuiet(
        'docker',
        [
          ...composePrefix(resolve(base, db.compose)),
          'exec',
          '-T',
          db.service,
          'pg_isready',
          '-U',
          db.user!
        ],
        root,
        env
      );
    else
      await commands.runQuiet(
        'pg_isready',
        ['-h', db.host, '-p', String(db.port), '-U', db.user!],
        root,
        env
      );
  });

export let createPostgres = async (
  root: string,
  base: string,
  db: Database,
  env: Environment
) => {
  let sql =
    "SELECT format('CREATE DATABASE %I', :'database') WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'database')\n\\gexec\n";
  let args = ['-v', 'ON_ERROR_STOP=1', '-v', `database=${db.database}`];
  if (db.compose && db.service)
    await commands.runWithInput(
      'docker',
      [
        ...composePrefix(resolve(base, db.compose)),
        'exec',
        '-T',
        db.service,
        'psql',
        ...args,
        '-U',
        db.user!,
        '-d',
        'postgres'
      ],
      sql,
      root,
      env
    );
  else
    await commands.runWithInput(
      'psql',
      [`postgresql://${db.user}:${db.password}@${db.host}:${db.port}/postgres`, ...args],
      sql,
      root,
      env
    );
};

export let mongoExec = async (
  root: string,
  base: string,
  db: Database,
  script: string,
  env: Environment
) => {
  if (db.compose && db.service)
    await commands.runQuiet(
      'docker',
      [
        ...composePrefix(resolve(base, db.compose)),
        'exec',
        '-T',
        db.service,
        'mongosh',
        mongoUrl({ ...db, host: '127.0.0.1', port: 27017 }),
        '--quiet',
        '--eval',
        script
      ],
      root,
      env
    );
  else
    await commands.runQuiet('mongosh', [mongoUrl(db), '--quiet', '--eval', script], root, env);
};

export let start = async (
  root: string,
  manifests: LoadedManifest[],
  env: Environment,
  databasesOnly = false
): Promise<ComposeProject[]> => {
  let requirements = infrastructure.requirementsFromManifests(manifests);
  if (databasesOnly) requirements.redis = requirements.nats = requirements.etcd = false;

  let names = infrastructure.serviceNames(requirements);
  let generated = join(root, '.control/dev/services.docker-compose.yml');
  let ports = servicePorts(env);
  let projects = databasesOnly ? [] : declaredComposeProjects(root, manifests);
  if (names.length) {
    let hash = rustPathHash(canonical(root)).slice(-8);
    infrastructure.writeCompose(generated, requirements, {
      project_name: `control_dev_${hash}`,
      network: 'control-services',
      ports,
      restart: true
    });
    projects.push([generated, names]);
    projects.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }

  let started: ComposeProject[] = [];

  try {
    for (let project of projects) {
      let [compose, services] = project;
      started.push(project);

      let args = [
        ...composePrefix(compose),
        'up',
        '--detach',
        '--wait',
        '--wait-timeout',
        '60'
      ];
      await commands.run('docker', [...args, ...services], root, env);

      if (compose === generated) {
        let reachable = async () =>
          (
            await Promise.all(
              Object.entries(requirements)
                .filter(([, required]) => required)
                .map(([name]) =>
                  portReachable(
                    ports[name === 'etcd' ? 'etcd_client' : (name as keyof ServicePorts)]
                  )
                )
            )
          ).every(Boolean);
        if (!(await reachable())) {
          console.error(
            'generated Docker services have stale host port bindings; recreating containers'
          );

          await commands.run('docker', [...args, '--force-recreate', ...services], root, env);

          if (!(await reachable()))
            throw new Error(
              'generated Docker services are not reachable on their configured host ports'
            );
        }
      }
    }

    for (let loaded of manifests) {
      let base = dirname(loaded.path);

      for (let db of Object.values(loaded.manifest.postgres)) {
        let configured = { ...db, compose: generated, service: 'postgres-db2' };
        await waitPostgres(root, base, configured, env);

        await createPostgres(root, base, configured, env);
      }

      for (let db of Object.values(loaded.manifest.mongo)) {
        let configured = { ...db, compose: generated, service: 'mongodb' };
        await retry('MongoDB', () =>
          mongoExec(root, base, configured, 'db.runCommand({ ping: 1 })', env)
        );

        await mongoExec(
          root,
          base,
          configured,
          "if (db.getCollectionNames().length === 0) db.createCollection('__control')",
          env
        );
      }
    }

    return projects;
  } catch (error) {
    await stop(root, started, env);
    throw error;
  }
};
