import { rustHash, rustBytes, rustString, shortHash } from './hash';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWrite, sortedEntries, writeJson } from './files';
import { discover } from './manifest';
import { acquireLock } from './lock';
import * as docker from './docker';
import * as commands from './process';
import {
  attachCacheKeys,
  buildPlan,
  ciRuntime,
  serializedPlan,
  serviceFingerprints,
  type Options,
  type Plan,
  type Service
} from './e2e-plan';
import type { ProjectRoot } from './types';

export let infrastructureImages = [
  'postgres:17',
  'mongo:7',
  'redis:7.4-alpine',
  'nats:2.11-alpine',
  'ghcr.io/metorial/object-storage:latest'
];

export let containerUrl = (url: string) =>
  url.replace(
    /^(.*?:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(?=[:/]|$)/,
    '$1host.docker.internal'
  );

export let escapeCompose = (value: string) => value.replaceAll('$', () => '$$');

export let remoteCacheEnvironment = (api?: string) =>
  api
    ? [
        `TURBO_API=${escapeCompose(containerUrl(api))}`,
        'TURBO_TEAM',
        'TURBO_TOKEN',
        'TURBO_REMOTE_CACHE_SIGNATURE_KEY'
      ]
    : [];

export let appServiceName = (name: string) =>
  'app-' +
  name
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');

export type Mounts = { source: string; volume: string } | { workspace: string };

export let renderCompose = (
  plan: Plan,
  projectName: string,
  runnerImage: string,
  mounts: Mounts,
  runDir: string
) => {
  let check = (test: string[], timeout = '5s') => ({
    test,
    interval: '1s',
    timeout,
    retries: 120
  });
  let services: Record<string, Record<string, unknown>> = {
    'postgres-db2': {
      image: 'postgres:17',
      command: [
        'postgres',
        '-c',
        'max_connections=1000',
        '-c',
        'fsync=off',
        '-c',
        'synchronous_commit=off',
        '-c',
        'full_page_writes=off'
      ],
      environment: { POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'postgres' },
      tmpfs: ['/var/lib/postgresql/data'],
      healthcheck: check(['CMD-SHELL', 'pg_isready -U postgres -d postgres'])
    },
    mongodb: {
      image: 'mongo:7',
      environment: {
        MONGO_INITDB_ROOT_USERNAME: 'mongo',
        MONGO_INITDB_ROOT_PASSWORD: 'mongo'
      },
      tmpfs: ['/data/db', '/data/configdb'],
      healthcheck: check([
        'CMD-SHELL',
        "mongosh --quiet --username mongo --password mongo --authenticationDatabase admin --eval 'quit(db.runCommand({ ping: 1 }).ok ? 0 : 2)'"
      ])
    },
    'redis-db': {
      image: 'redis:7.4-alpine',
      command: ['redis-server', '--save', '', '--appendonly', 'no'],
      healthcheck: check(['CMD', 'redis-cli', 'ping'], '3s')
    },
    'nats-1': {
      image: 'nats:2.11-alpine',
      command: ['--jetstream', '--store_dir=/tmp/nats', '--http_port=8222'],
      healthcheck: check(
        ['CMD-SHELL', 'wget -q -O - http://127.0.0.1:8222/healthz >/dev/null'],
        '3s'
      )
    }
  };
  if (plan.objectStorage)
    services['object-storage'] = {
      image: infrastructureImages[4],
      platform: 'linux/amd64',
      environment: {
        RUST_LOG: 'info',
        AWS_ACCESS_KEY_ID: 'e2e',
        AWS_SECRET_ACCESS_KEY: 'e2e',
        AWS_REGION: 'us-east-1',
        OBJECT_STORE__SERVER__HOST: '0.0.0.0',
        OBJECT_STORE__SERVER__PORT: '52010',
        OBJECT_STORE__BACKEND__TYPE: 'local',
        OBJECT_STORE__BACKEND__ROOT_PATH: '/app/data',
        OBJECT_STORE__BACKEND__REGION: 'us-east-1',
        OBJECT_STORE__BACKEND__PHYSICAL_BUCKET: 'e2e'
      },
      tmpfs: ['/app/data:mode=1777'],
      networks: { default: { aliases: ['services'] } },
      healthcheck: check(['CMD-SHELL', 'curl -f http://localhost:52010/health || exit 1'])
    };
  services.gateway = {
    image: runnerImage,
    command: ['gateway'],
    extra_hosts: ['host.docker.internal:host-gateway'],
    sysctls: { 'net.ipv4.ip_local_port_range': '61000 65535' },
    healthcheck: {
      test: ['CMD-SHELL', 'test -f /tmp/control-e2e-gateway-ready'],
      interval: '1s',
      timeout: '3s',
      retries: 60
    }
  };

  let volumes: Record<string, unknown>[] = [
    { type: 'bind', source: escapeCompose(runDir), target: '/e2e' }
  ];
  if ('volume' in mounts)
    volumes.push(
      {
        type: 'bind',
        source: escapeCompose(mounts.source),
        target: '/source',
        read_only: true
      },
      { type: 'volume', source: mounts.volume, target: '/workspace' }
    );
  else
    volumes.push({
      type: 'bind',
      source: escapeCompose(mounts.workspace),
      target: '/workspace'
    });
  services.runner = {
    image: runnerImage,
    command: ['run', '/e2e/plan.json'],
    network_mode: 'service:gateway',
    profiles: ['runner'],
    init: true,
    working_dir: '/workspace',
    volumes,
    environment: remoteCacheEnvironment(process.env.TURBO_API)
  };

  for (let service of [...plan.dependencies, ...plan.suts])
    if (service.image)
      services[appServiceName(service.name)] = {
        image: service.image,
        network_mode: 'service:gateway',
        profiles: ['apps'],
        init: true,
        environment: Object.fromEntries(
          sortedEntries(service.env).map(([key, value]) => [key, escapeCompose(value)])
        )
      };

  return {
    name: projectName,
    services,
    ...('volume' in mounts ? { volumes: { [mounts.volume]: { external: true } } } : {})
  };
};

export let ensureRunnerImage = async (root: string, assets: string) => {
  let recipe = readFileSync(join(assets, 'Dockerfile'), 'utf8');

  for (let [reference, pinned] of sortedEntries(ciRuntime()?.images ?? {}))
    recipe = recipe.replaceAll(`FROM ${reference}`, `FROM ${pinned}`);

  let path = join(root, '.control/e2e/runner/Dockerfile');
  atomicWrite(path, recipe);

  let hash = rustHash(
    rustString(recipe),
    rustBytes(readFileSync(join(assets, 'entrypoint.sh')))
  );
  let image = `metorial-control-e2e:${hash}`;
  if (
    await commands.runQuiet('docker', ['image', 'inspect', image], root).then(
      () => true,
      () => false
    )
  )
    return image;
  console.log(`Building e2e runner image ${image}`);

  await commands.run(
    'docker',
    ['build', '--progress', 'plain', '--tag', image, '--file', path, assets],
    root
  );

  return image;
};

export class Compose {
  constructor(
    public root: string,
    public file: string
  ) {}

  args(args: string[]) {
    return ['compose', '--file', this.file, ...args];
  }

  async run(args: string[]) {
    await commands.run('docker', this.args(args), this.root);
  }

  async quiet(args: string[]) {
    await commands.runQuiet('docker', this.args(args), this.root);
  }

  async output(args: string[]) {
    return commands.output('docker', this.args(args), this.root);
  }
}

export let waitForHealth = async (
  compose: Compose,
  services: Service[],
  timeoutSeconds: number
) => {
  let deadline = Date.now() + timeoutSeconds * 1000;
  let pending = services.flatMap(service => service.health.map(check => ({ service, check })));

  while (pending.length) {
    let remaining: typeof pending = [];

    for (let item of pending) {
      let code = Number(
        await compose
          .output([
            'exec',
            '-T',
            'gateway',
            'curl',
            '--silent',
            '--output',
            '/dev/null',
            '--max-time',
            '3',
            '--write-out',
            '%{http_code}',
            item.check.url
          ])
          .catch(() => '0')
      );
      if (
        item.check.status !== undefined
          ? code !== item.check.status
          : code < 200 || code >= 300
      )
        remaining.push(item);
    }

    if (!remaining.length) return;

    let exited = (
      await compose
        .output(['ps', '--all', '--status', 'exited', '--format', '{{.Service}}'])
        .catch(() => '')
    )
      .split('\n')
      .map(line => line.trim());

    for (let { service } of remaining) {
      let name = appServiceName(service.name);
      if (exited.includes(name))
        throw new Error(
          `e2e service ${service.name} exited before becoming healthy:\n${await compose.output(['logs', '--no-color', '--tail', '80', name]).catch(() => '')}`
        );
    }

    if (Date.now() >= deadline)
      throw new Error(
        `e2e services did not become healthy within ${timeoutSeconds}s: ${remaining.map(item => `${item.service.name} (${item.check.url})`).join(', ')}`
      );
    pending = remaining;

    await commands.delay(1000);
  }
};

export let execute = async (compose: Compose, plan: Plan) => {
  let infrastructure = [
    'postgres-db2',
    'mongodb',
    'redis-db',
    'nats-1',
    ...(plan.objectStorage ? ['object-storage'] : []),
    'gateway'
  ];
  console.log(`Starting e2e infrastructure: ${infrastructure.join(', ')}`);

  await compose.run(['up', '--detach', '--wait', '--wait-timeout', '180', ...infrastructure]);

  for (let db of plan.postgres) {
    let configured = { ...db, compose: compose.file, service: 'postgres-db2' };
    await docker.waitPostgres(compose.root, compose.root, configured, {});

    await docker.createPostgres(compose.root, compose.root, configured, {});
  }

  for (let db of plan.mongo) {
    let configured = { ...db, compose: compose.file, service: 'mongodb' };
    await docker.retry('MongoDB', () =>
      docker.mongoExec(
        compose.root,
        compose.root,
        configured,
        'db.runCommand({ ping: 1 })',
        {}
      )
    );

    await docker.mongoExec(
      compose.root,
      compose.root,
      configured,
      "if (db.getCollectionNames().length === 0) db.createCollection('__control')",
      {}
    );
  }

  if (plan.mode === 'images') {
    for (let [label, services] of [
      ['dependencies', plan.dependencies],
      ['suts', plan.suts]
    ] as const) {
      if (!services.length) continue;

      let names = services.map(service => appServiceName(service.name));
      console.log(`Starting e2e ${label}: ${names.join(', ')}`);

      await compose.run(['up', '--detach', '--no-deps', ...names]);

      await waitForHealth(compose, services, plan.healthTimeoutSeconds);
    }
  }

  await compose.run(['run', '--rm', '--no-deps', '-T', 'runner']);
};

export let run = async (project: ProjectRoot, options: Options) => {
  let plan = buildPlan(project, discover(project.root), options);

  try {
    attachCacheKeys(plan, await serviceFingerprints(project, plan));
  } catch (error) {
    console.error(
      `Could not fingerprint the e2e services, so e2e results will not be cached: ${error}`
    );
  }

  if (options.planOnly) {
    console.log(JSON.stringify(serializedPlan(plan), null, 2));

    return;
  }
  console.log(
    `E2E plan (${plan.mode === 'local' ? 'Local' : 'Images'} mode): ${plan.stacks.reduce((sum, stack) => sum + stack.tests.length, 0)} test package(s) across ${plan.stacks.length} stack(s)`
  );

  for (let [label, services] of [
    ['dependencies', plan.dependencies],
    ['suts', plan.suts]
  ] as const)
    console.log(`  ${label}: ${services.map(service => service.name).join(', ') || '(none)'}`);

  let lockPath = join(tmpdir(), 'metorial-control-e2e.lock');
  let release = await acquireLock(lockPath, () =>
    console.log(
      `Waiting for another e2e run (pid ${readFileSync(lockPath, 'utf8').trim() || 'unknown'})...`
    )
  );
  writeFileSync(lockPath, String(process.pid));

  try {
    let assets = join(project.oss, 'scripts/dev-tools/e2e');
    let directory = join(
      project.root,
      '.control/e2e',
      `${Math.floor(Date.now() / 1000)}-${process.pid}`
    );
    mkdirSync(join(directory, 'logs'), { recursive: true });
    copyFileSync(join(assets, 'runner.ts'), join(directory, 'runner.ts'));

    writeJson(join(directory, 'plan.json'), serializedPlan(plan));

    let image = await ensureRunnerImage(project.root, assets);
    let hash = shortHash(project.root);
    let mounts: Mounts = { workspace: options.workspace ?? project.root };
    if (plan.mode === 'local') {
      let volume = `control-e2e-${hash}`;
      await commands.runQuiet('docker', ['volume', 'create', volume], project.root);
      mounts = { source: project.root, volume };
    }

    let rendered = renderCompose(
      plan,
      `control-e2e-${hash}-${process.pid}`,
      image,
      mounts,
      directory
    );
    let runtime = ciRuntime();

    for (let service of Object.values(rendered.services))
      if (typeof service.image === 'string' && runtime?.images?.[service.image])
        service.image = runtime.images[service.image];

    let compose = new Compose(project.root, join(directory, 'compose.yml'));
    writeJson(compose.file, rendered);

    try {
      await execute(compose, plan);
    } finally {
      let logs = await compose
        .output(['logs', '--no-color', '--timestamps'])
        .catch(() => undefined);
      if (logs !== undefined) atomicWrite(join(directory, 'logs/compose.log'), logs);

      if (options.keep)
        console.log(
          `Kept e2e containers; stop them with: docker compose --file ${compose.file} down -v`
        );
      else
        await compose
          .quiet(['down', '--volumes', '--remove-orphans', '--timeout', '5'])
          .catch(() => {});
      console.log(`E2E logs: ${join(directory, 'logs')}`);
    }
  } finally {
    release();
  }
};
