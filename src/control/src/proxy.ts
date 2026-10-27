import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { atomicWrite, packageName, readJson, sortedEntries, writeJson } from './files';
import { applies } from './manifest';
import { withLock } from './lock';
import * as commands from './process';
import type { LoadedManifest, ProjectRoot, WorkspaceMetadata } from './types';

export interface Route {
  port: number;
  target: string;
}

interface Registrations {
  hostname: string;
  sessions: Record<string, { pid: number; routes: Route[] }>;
}

export let publicPorts = (manifests: LoadedManifest[], project: ProjectRoot) =>
  new Set(
    manifests
      .filter(item => applies(item.manifest, project.kind))
      .flatMap(item => Object.values(item.manifest.endpoints).map(endpoint => endpoint.port))
  );

export let proxyRoot = (_project: ProjectRoot, data: WorkspaceMetadata) => {
  if (process.env.CONTROL_PROXY_ROOT !== undefined) return process.env.CONTROL_PROXY_ROOT;

  let source = data.source_root;
  if (basename(source) === 'oss' && packageName(dirname(source)) === '@metorial/enterprise')
    source = dirname(source);

  return join(source, '.control/proxy');
};

export let renderStatic = (ports: Set<number>) => {
  let entries: Record<string, unknown> = {
    health: { address: ':8082' },
    'port-80': {
      address: ':80',
      http: {
        redirections: { entryPoint: { to: 'port-4300', scheme: 'http', permanent: false } }
      }
    }
  };

  for (let port of [...new Set([...ports, 4300])].sort((a, b) => a - b))
    if (port !== 80) entries[`port-${port}`] = { address: `:${port}` };

  return (
    JSON.stringify(
      {
        global: { checkNewVersion: false, sendAnonymousUsage: false },
        log: { level: 'INFO' },
        api: { dashboard: false },
        ping: { entryPoint: 'health' },
        providers: { file: { directory: '/etc/traefik/dynamic', watch: true } },
        entryPoints: entries
      },
      null,
      2
    ) + '\n'
  );
};

export let renderCompose = (root: string, ports: Set<number>) =>
  JSON.stringify(
    {
      name: 'control-proxy',
      services: {
        traefik: {
          image: 'traefik:v3.7.8',
          restart: 'unless-stopped',
          command: ['--configFile=/etc/traefik/traefik.yml'],
          ports: [...new Set([...ports, 80, 4300])]
            .sort((a, b) => a - b)
            .flatMap(port => [`127.0.0.1:${port}:${port}`, `[::1]:${port}:${port}`]),
          volumes: [
            `${join(root, 'traefik.yml')}:/etc/traefik/traefik.yml:ro`,
            `${join(root, 'dynamic')}:/etc/traefik/dynamic:ro`
          ],
          extra_hosts: ['host.docker.internal:host-gateway'],
          networks: ['control-proxy'],
          healthcheck: {
            test: ['CMD', 'traefik', 'healthcheck', '--ping'],
            interval: '5s',
            timeout: '3s',
            retries: 12
          }
        }
      },
      networks: { 'control-proxy': { name: 'control_proxy', external: true } }
    },
    null,
    2
  ) + '\n';

export let renderDynamic = (id: string, hostname: string, routes: Route[]) =>
  JSON.stringify(
    {
      http: {
        routers: Object.fromEntries(
          routes.map(route => [
            `${id}-${route.port}`,
            {
              rule: `Host(\`${hostname}\`)`,
              entryPoints: [`port-${route.port}`],
              service: `${id}-${route.port}`
            }
          ])
        ),
        services: Object.fromEntries(
          routes.map(route => [
            `${id}-${route.port}`,
            { loadBalancer: { servers: [{ url: route.target }] } }
          ])
        )
      }
    },
    null,
    2
  ) + '\n';

export let ensure = async (
  project: ProjectRoot,
  data: WorkspaceMetadata,
  ports: Set<number>
) => {
  let root = proxyRoot(project, data);
  mkdirSync(join(root, 'dynamic'), { recursive: true });
  mkdirSync(join(root, 'registrations'), { recursive: true });

  let changed = await withLock(join(root, 'lock'), () => {
    let statePath = join(root, 'state.json');
    let state = existsSync(statePath)
      ? readJson<{ version?: number; ports?: number[] }>(statePath)
      : {};
    let combined = new Set([...(state.ports ?? []), ...ports]);
    if (
      combined.size === (state.ports ?? []).length &&
      state.version === 3 &&
      existsSync(join(root, 'compose.yml')) &&
      existsSync(join(root, 'traefik.yml'))
    )
      return false;

    writeJson(statePath, { version: 3, ports: [...combined].sort((a, b) => a - b) });
    atomicWrite(join(root, 'traefik.yml'), renderStatic(combined));
    atomicWrite(join(root, 'compose.yml'), renderCompose(root, combined));

    return true;
  });
  await commands
    .runQuiet('docker', ['network', 'create', 'control_proxy'], project.root)
    .catch(() => {});
  console.log(
    changed
      ? 'Updating shared development proxy'
      : 'Ensuring shared development proxy is running'
  );

  await commands.run(
    'docker',
    [
      'compose',
      '--project-name',
      'control_proxy',
      '--file',
      join(root, 'compose.yml'),
      'up',
      '--detach',
      '--wait'
    ],
    project.root
  );
};

let writeRegistration = (root: string, id: string, registrations: Registrations) => {
  let path = join(root, 'registrations', `${id}.json`);
  let dynamic = join(root, 'dynamic', `${id}.yml`);
  if (!Object.keys(registrations.sessions).length) {
    rmSync(path, { force: true });
    rmSync(dynamic, { force: true });

    return;
  }

  let routes = new Map<number, Route>();

  for (let [, session] of sortedEntries(registrations.sessions))
    for (let route of session.routes)
      if (!routes.has(route.port)) routes.set(route.port, route);
  writeJson(path, registrations);
  atomicWrite(
    dynamic,
    renderDynamic(
      id,
      registrations.hostname,
      [...routes.values()].sort((a, b) => a.port - b.port)
    )
  );
};

export let processIsAlive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

export let register = async (
  project: ProjectRoot,
  data: WorkspaceMetadata,
  selected: LoadedManifest[]
) => {
  let root = proxyRoot(project, data);
  let host = data.runtime === 'host' ? 'host.docker.internal' : `metorial-ws-${data.id}`;
  let routes = new Map<number, Route>();

  for (let loaded of selected) {
    for (let endpoint of Object.values(loaded.manifest.endpoints)) {
      if (routes.has(endpoint.port))
        throw new Error(
          `workspace ${JSON.stringify(data.id)} has multiple active endpoints on public port ${endpoint.port}`
        );
      routes.set(endpoint.port, {
        port: endpoint.port,
        target: `http://${host}:${data.runtime === 'host' ? (endpoint.bind_port ?? endpoint.port) : endpoint.port}`
      });
    }
  }

  let token = `${process.pid}-${BigInt(Date.now()) * 1000000n + (process.hrtime.bigint() % 1000000n)}`;
  let path = join(root, 'registrations', `${data.id}.json`);
  await withLock(join(root, 'lock'), () => {
    let registrations = existsSync(path)
      ? readJson<Registrations>(path)
      : { hostname: '', sessions: {} };
    registrations.sessions = Object.fromEntries(
      Object.entries(registrations.sessions).filter(([, session]) =>
        processIsAlive(session.pid)
      )
    );

    if (registrations.hostname && registrations.hostname !== data.hostname)
      registrations.sessions = {};
    registrations.hostname = data.hostname;

    for (let route of routes.values())
      for (let session of Object.values(registrations.sessions))
        for (let existing of session.routes) {
          if (existing.port === route.port)
            throw new Error(
              `workspace ${JSON.stringify(data.id)} already has ${existing.target !== route.target ? 'a different route' : 'an active development service'} on public port ${route.port}`
            );
        }
    registrations.sessions[token] = {
      pid: process.pid,
      routes: [...routes.values()].sort((a, b) => a.port - b.port)
    };
    writeRegistration(root, data.id, registrations);
  });

  return async () =>
    withLock(join(root, 'lock'), () => {
      if (!existsSync(path)) return;

      let registrations = readJson<Registrations>(path);
      delete registrations.sessions[token];
      writeRegistration(root, data.id, registrations);
    });
};

export let unregisterWorkspace = async (project: ProjectRoot, data: WorkspaceMetadata) => {
  let root = proxyRoot(project, data);
  await withLock(join(root, 'lock'), () => {
    rmSync(join(root, 'registrations', `${data.id}.json`), { force: true });
    rmSync(join(root, 'dynamic', `${data.id}.yml`), { force: true });
  });
};
