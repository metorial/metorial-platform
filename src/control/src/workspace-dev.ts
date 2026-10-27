import { lookup } from 'node:dns/promises';
import { rustHash, rustBytes } from './hash';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { join, resolve } from 'node:path';
import { atomicWrite, canonical, sortedEntries } from './files';
import { rootEnvironment } from './environment';
import { discover, loadExternals, readExternals, selectWithDependencies } from './manifest';
import { requirementsFromManifests, writeCompose } from './infrastructure';
import { createPostgres, mongoExec } from './docker';
import * as commands from './process';
import * as proxy from './proxy';
import { metadata } from './workspace';
import type { Environment, LoadedManifest, ProjectRoot, WorkspaceMetadata } from './types';

export let containerName = (data: WorkspaceMetadata) => `metorial-ws-${data.id}`;

export let servicesProject = (data: WorkspaceMetadata) =>
  `control_ws_${data.id.replaceAll('-', '_')}`;

export let workspaceVolumes = (data: WorkspaceMetadata) =>
  [
    'node-modules',
    'bun-cache',
    'cargo-target',
    'cargo-registry',
    'go-build',
    'go-mod',
    'state',
    'vscode-server'
  ].map(suffix => `control-${data.id}-${suffix}`);

export let vscodeUri = (container: string, folder: string) =>
  `vscode-remote://attached-container+${Buffer.from(JSON.stringify({ containerName: container })).toString('hex')}${folder}`;

let composeArgs = (project: ProjectRoot, data: WorkspaceMetadata) => [
  'compose',
  '--project-name',
  servicesProject(data),
  '--file',
  join(project.root, '.control/workspace/services.docker-compose.yml')
];

let inspect = (project: ProjectRoot, name: string, format: string) =>
  commands
    .output('docker', ['inspect', '--format', format, name], project.root)
    .catch(() => undefined);

let workspaceEnvironment = (project: ProjectRoot, data: WorkspaceMetadata): Environment => ({
  ...rootEnvironment(project),
  METORIAL_HOSTNAME: data.hostname,
  CONTROL_WORKSPACE_ID: data.id
});

export let workspaceAssets = (project: ProjectRoot, data: WorkspaceMetadata) => {
  for (let root of [data.source_root, project.root, project.oss]) {
    for (let candidate of [
      join(root, 'oss/scripts/dev-tools/workspace'),
      join(root, 'scripts/dev-tools/workspace')
    ])
      if (existsSync(candidate)) return candidate;
  }

  return join(project.oss, 'scripts/dev-tools/workspace');
};

export let ensureImage = async (root: string, assets: string, rebuild: boolean) => {
  let hash = rustHash(
    rustBytes(readFileSync(join(assets, 'Dockerfile'))),
    rustBytes(readFileSync(join(assets, 'entrypoint.sh')))
  );
  let image = `metorial-control-dev:${hash}`;
  if (
    !rebuild &&
    (await commands.runQuiet('docker', ['image', 'inspect', image], root).then(
      () => true,
      () => false
    ))
  )
    return image;
  console.log(`Building development image ${image}`);

  await commands.run(
    'docker',
    [
      'build',
      '--progress',
      'plain',
      '--tag',
      image,
      '--file',
      join(assets, 'Dockerfile'),
      assets
    ],
    root
  );

  return image;
};

export let resolveExternalHosts = async (hostnames: string[]): Promise<[string, string][]> => {
  let result: [string, string][] = [];

  for (let hostname of [...new Set(hostnames)].sort()) {
    let target =
      hostname === 'services' && process.env.CONTROL_SERVICES_HOST?.trim()
        ? process.env.CONTROL_SERVICES_HOST
        : hostname;
    if (isIP(target)) {
      result.push([hostname, target]);
      continue;
    }

    let addresses = (await lookup(target, { all: true, family: 4 }))
      .map(item => item.address)
      .filter(address => !address.startsWith('127.'));
    let address =
      addresses.find(address => {
        let parts = address.split('.').map(Number);

        return parts[0] === 100 && parts[1]! >= 64 && parts[1]! < 128;
      }) ?? addresses[0];
    if (!address)
      throw new Error(
        `external hostname ${JSON.stringify(target)} has no non-loopback IPv4 address`
      );
    result.push([hostname, address]);
  }

  return result;
};

export let hostsMarkdown = (data: WorkspaceMetadata, manifests: LoadedManifest[]) => {
  let entries = manifests
    .flatMap(loaded =>
      sortedEntries(loaded.manifest.endpoints).map(([endpoint, definition]) => ({
        port: definition.port,
        name: loaded.manifest.package?.name ?? loaded.path,
        endpoint
      }))
    )
    .sort(
      (a, b) =>
        a.port - b.port ||
        (a.name < b.name
          ? -1
          : a.name > b.name
            ? 1
            : a.endpoint < b.endpoint
              ? -1
              : a.endpoint > b.endpoint
                ? 1
                : 0)
    );

  return [
    '# Workspace hosts',
    '',
    `Hostname: \`${data.hostname}\``,
    '',
    `Port 80 redirects to port 4300: http://${data.hostname}/`,
    '',
    '## Exposed HTTP endpoints',
    '',
    ...(entries.length
      ? entries.map(
          entry =>
            `- \`${entry.name}\` / \`${entry.endpoint}\` — http://${data.hostname}:${entry.port}`
        )
      : ['_No named endpoints declared._']),
    ''
  ].join('\n');
};

let ensureRunning = async (project: ProjectRoot, rebuild: boolean) => {
  let data = await metadata(project);
  let manifests = discover(project.root);
  let externals = loadExternals(project.root, manifests);
  let hosts = await resolveExternalHosts(
    readExternals(project.root).map(item => item.hostname)
  );

  let selected = selectWithDependencies(manifests, [], project.kind, externals);
  if (!selected.length) throw new Error('no control.toml manifests were selected');

  let assets = join(project.root, '.control/workspace');
  writeCompose(
    join(assets, 'services.docker-compose.yml'),
    requirementsFromManifests(selected),
    { project_name: servicesProject(data), network: 'workspace-services', restart: true }
  );

  if (
    !(await commands
      .runQuiet('docker', ['network', 'inspect', 'control_proxy'], project.root)
      .then(
        () => true,
        () => false
      ))
  )
    await commands.run('docker', ['network', 'create', 'control_proxy'], project.root);

  let env = workspaceEnvironment(project, data);
  await commands.run(
    'docker',
    [...composeArgs(project, data), 'up', '--detach', '--wait', '--wait-timeout', '60'],
    project.root,
    env
  );

  let compose = join(assets, 'services.docker-compose.yml');

  for (let loaded of selected) {
    for (let db of Object.values(loaded.manifest.postgres))
      await createPostgres(
        project.root,
        project.root,
        { ...db, user: 'postgres', compose, service: 'postgres-db2' },
        env
      );

    for (let db of Object.values(loaded.manifest.mongo))
      await mongoExec(
        project.root,
        project.root,
        {
          ...db,
          user: 'mongo',
          password: 'mongo',
          auth_source: 'admin',
          compose,
          service: 'mongodb'
        },
        "if (db.getCollectionNames().length === 0) db.createCollection('__control')",
        env
      );
  }

  let image = await ensureImage(project.root, workspaceAssets(project, data), rebuild);
  let name = containerName(data);
  let existing = await inspect(project, name, '{{.Config.Image}}');
  let hostsLabel = hosts.map(([hostname, address]) => `${hostname}=${address}`).join(',');

  let proxyRoot = proxy.proxyRoot(project, data);
  let oldHosts = await inspect(
    project,
    name,
    '{{index .Config.Labels "control.external-hosts"}}'
  );
  let oldProxy = await inspect(project, name, '{{index .Config.Labels "control.proxy-root"}}');
  let replace =
    existing !== undefined &&
    (existing !== image ||
      (oldHosts === '<no value>' ? '' : (oldHosts ?? '')) !== hostsLabel ||
      oldProxy !== proxyRoot);
  if (replace) await commands.run('docker', ['rm', '--force', name], project.root, env);

  if (existing !== image || replace) {
    mkdirSync(proxyRoot, { recursive: true });

    let volumes = workspaceVolumes(data);
    let destinations = [
      '/workspace/node_modules',
      '/root/.bun/install/cache',
      '/control-cache/cargo-target',
      '/opt/cargo/registry',
      '/root/.cache/go-build',
      '/opt/go/pkg/mod',
      '/control-state',
      '/root/.vscode-server'
    ];
    let gitDirectories = new Set<string>();

    for (let repo of [...new Set([project.root, project.oss])])
      gitDirectories.add(
        canonical(
          resolve(repo, await commands.output('git', ['rev-parse', '--git-common-dir'], repo))
        )
      );

    let envValues = {
      METORIAL_HOSTNAME: data.hostname,
      CONTROL_WORKSPACE_ID: data.id,
      CONTROL_PROXY_ROOT: proxyRoot,
      CONTROL_SERVICE_POSTGRES: 'postgres-db2:5432',
      CONTROL_SERVICE_MONGO: 'mongodb:27017',
      CONTROL_SERVICE_REDIS: 'redis-db:6379',
      CONTROL_SERVICE_NATS: 'nats-1:4222',
      CONTROL_SERVICE_ETCD: 'etcd:2379',
      CARGO_TARGET_DIR: '/control-cache/cargo-target',
      SHELL: '/bin/zsh'
    };
    let args = [
      'create',
      '--init',
      '--name',
      name,
      '--hostname',
      data.hostname,
      '--network',
      'control_proxy',
      '--workdir',
      '/workspace',
      '--add-host',
      `${data.hostname}:127.0.0.1`,
      ...Object.entries(envValues).flatMap(([key, value]) => ['--env', `${key}=${value}`]),
      '--volume',
      `${project.root}:/workspace`,
      ...volumes.flatMap((volume, index) => ['--volume', `${volume}:${destinations[index]}`]),
      '--volume',
      `${proxyRoot}:${proxyRoot}`,
      '--volume',
      '/var/run/docker.sock:/var/run/docker.sock',
      '--label',
      `control.workspace=${data.id}`,
      '--label',
      `control.proxy-root=${proxyRoot}`,
      ...[...gitDirectories].sort().flatMap(path => ['--volume', `${path}:${path}:rw`]),
      ...hosts.flatMap(([hostname, address]) => ['--add-host', `${hostname}:${address}`])
    ];
    if (
      !existsSync(join(project.root, 'env.json')) &&
      existsSync(join(data.source_root, 'env.json'))
    )
      args.push('--volume', `${join(data.source_root, 'env.json')}:/workspace/env.json:ro`);

    if (hostsLabel) args.push('--label', `control.external-hosts=${hostsLabel}`);

    await commands.run('docker', [...args, image], project.root, env);
  }

  let network = `${servicesProject(data)}_workspace-services`;
  let networks = await inspect(project, name, '{{json .NetworkSettings.Networks}}');
  if (!networks) throw new Error('could not inspect workspace container networks');

  if (!(network in JSON.parse(networks)))
    await commands.run('docker', ['network', 'connect', network, name], project.root, env);

  await commands.run('docker', ['start', name], project.root, env);
  atomicWrite(join(project.root, 'HOST.md'), hostsMarkdown(data, selected));
  console.log(`workspace hostname: ${data.hostname}`);

  for (let port of [...proxy.publicPorts(selected, project)].sort((a, b) => a - b))
    console.log(`  http://${data.hostname}:${port}`);

  return { name, image, env };
};

let bootstrap = async (
  project: ProjectRoot,
  running: Awaited<ReturnType<typeof ensureRunning>>
) => {
  console.log('Ensuring workspace setup is complete');

  await commands.run(
    'docker',
    [
      'exec',
      running.name,
      '/usr/local/bin/workspace-entrypoint',
      'setup',
      `v1-${running.image}`
    ],
    project.root,
    running.env
  );
};

export let initialize = async (project: ProjectRoot, rebuild: boolean) => {
  let running = await ensureRunning(project, rebuild);
  await bootstrap(project, running);
};

export let open = async (project: ProjectRoot) => {
  let extensions = await commands.output('code', ['--list-extensions'], project.root);
  if (
    !extensions
      .split('\n')
      .some(extension => extension.toLowerCase() === 'ms-vscode-remote.remote-containers')
  )
    throw new Error(
      'VS Code extension `ms-vscode-remote.remote-containers` is required; install the Dev Containers extension'
    );

  await commands.run(
    'code',
    [
      '--new-window',
      '--folder-uri',
      vscodeUri(containerName(await metadata(project)), '/workspace')
    ],
    project.root
  );
};

export let run = async (project: ProjectRoot, rebuild: boolean, openCode: boolean) => {
  await initialize(project, rebuild);

  if (openCode) await open(project);
};

export let control = async (project: ProjectRoot) => {
  let running = await ensureRunning(project, false);
  await bootstrap(project, running);

  await commands.run(
    'docker',
    [
      'exec',
      '--interactive',
      '--tty',
      '--workdir',
      '/workspace',
      running.name,
      'bun',
      'control'
    ],
    project.root,
    running.env
  );
};

export let shell = async (project: ProjectRoot) => {
  let running = await ensureRunning(project, false);
  await bootstrap(project, running);

  await commands.run(
    'docker',
    ['exec', '--interactive', '--tty', running.name, 'zsh', '-l'],
    project.root,
    running.env
  );
};

export let stop = async (project: ProjectRoot, volumes: boolean) => {
  let data = await metadata(project);
  await proxy.unregisterWorkspace(project, data);

  let name = containerName(data);
  let env = workspaceEnvironment(project, data);
  let exists = await inspect(project, name, '{{.Id}}');
  if (exists)
    await commands.run('docker', ['stop', '--timeout', '20', name], project.root, env);

  if (volumes && exists)
    await commands.run('docker', ['rm', '--force', name], project.root, env);

  await commands.run(
    'docker',
    [...composeArgs(project, data), ...(volumes ? ['down', '--volumes'] : ['stop'])],
    project.root,
    env
  );

  if (volumes)
    for (let volume of workspaceVolumes(data)) {
      if (
        await commands
          .runQuiet('docker', ['volume', 'inspect', volume], project.root, env)
          .then(
            () => true,
            () => false
          )
      )
        await commands.run('docker', ['volume', 'rm', volume], project.root, env);
    }
  console.log(
    volumes
      ? 'stopped workspace and removed its persistent data'
      : 'stopped workspace; persistent data was retained'
  );
};

export let status = async (project: ProjectRoot) => {
  let data = await metadata(project);
  console.log(
    `workspace: ${data.id}\nbranch: ${data.branch}\nruntime: docker\nhostname: ${data.hostname}`
  );

  let name = containerName(data);
  let state = (await inspect(project, name, '{{.State.Status}}')) ?? 'not created';
  console.log(`container: ${state}`);

  let count = async (args: string[]) =>
    (
      await commands
        .output('docker', [...composeArgs(project, data), ...args], project.root)
        .catch(() => '')
    )
      .split('\n')
      .filter(Boolean).length;
  console.log(
    `dependencies: ${await count(['ps', '--status', 'running', '--quiet'])}/${await count(['config', '--services'])} running`
  );

  if (state !== 'running') {
    console.log('initialized: unknown (container is not running)');

    return;
  }

  let initialized = await commands
    .runQuiet(
      'docker',
      ['exec', name, 'test', '-f', '/control-state/bootstrap-v1'],
      project.root
    )
    .then(
      () => true,
      () => false
    );
  console.log(`initialized: ${initialized ? 'yes' : 'no'}`);
};
