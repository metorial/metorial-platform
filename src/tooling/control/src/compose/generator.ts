import { join, resolve } from 'path';
import { stringify } from 'yaml';
import type { ResolvedDep, ResolvedGraph } from '../types';
import { MOCK_DEFINITIONS } from '../types';
import { controlToolingDir } from '../entrypoint';
import { interpolateEnv, mergeEnv } from '../graph/env';

let networkConfig = (alias: string) => ({
  'control-network': {
    aliases: [alias]
  }
});

let resolveBuild = (graph: ResolvedGraph) => {
  let svc = graph.config.service!;
  let dockerfile = svc.dockerfile ?? 'dev.Dockerfile';

  if (svc.build_context === 'oss') {
    return {
      context: graph.ossRoot,
      dockerfile: dockerfile.startsWith('./') ? dockerfile : `./${dockerfile.replace(/^\.\//, '')}`
    };
  }

  let context = resolve(graph.dir, svc.build_context ?? '.');
  return { context, dockerfile: svc.dockerfile ?? 'dev.Dockerfile' };
};

let defaultServiceHealth = (port: number, path = '/') => ({
  test: [
    'CMD-SHELL',
    `bun -e "fetch('http://localhost:${port}${path}').then(()=>process.exit(0)).catch(()=>process.exit(1))"`
  ],
  interval: '5s',
  timeout: '5s',
  retries: 20
});

let resolveServiceHealth = (graph: ResolvedGraph) => {
  let svc = graph.config.service;
  if (!svc?.port) return undefined;
  if (svc.health?.cmd) {
    return { test: ['CMD-SHELL', svc.health.cmd], interval: '5s', timeout: '5s', retries: 20 };
  }
  return defaultServiceHealth(svc.port, svc.health?.path ?? '/');
};

let resolveControlServiceEnv = (dep: ResolvedDep, graph: ResolvedGraph): Record<string, string> => {
  if (!dep.children) return {};

  let childEnv = interpolateEnv(dep.children.config.env ?? {}, graph.depHosts);
  let depEnv = dep.config.env ? interpolateEnv(dep.config.env, graph.depHosts) : {};
  return mergeEnv(childEnv, depEnv);
};

let depHasHealth = (dep: ResolvedDep) => {
  if (dep.config.preset === 'nats') return false;
  if (dep.kind === 'mock' || dep.kind === 'preset') return true;
  if (dep.kind === 'control') return true;
  if (dep.kind === 'inline') {
    let inline = typeof dep.config.inline === 'object' ? dep.config.inline : undefined;
    return !!(inline?.health?.cmd || inline?.port);
  }
  return true;
};

let resolveControlDependsOn = (
  dep: ResolvedDep,
  graph: ResolvedGraph
): Record<string, { condition: string }> => {
  if (!dep.children) return {};

  let dependsOn: Record<string, { condition: string }> = {};
  for (let childDep of dep.children.deps ?? []) {
    let parentDep = graph.deps.find(d => d.name === childDep.name);
    if (!parentDep) continue;

    dependsOn[parentDep.composeName] = {
      condition: depHasHealth(parentDep) ? 'service_healthy' : 'service_started'
    };
  }

  return dependsOn;
};

let buildControlService = (dep: ResolvedDep, graph: ResolvedGraph, containerName: string) => {
  if (!dep.children) throw new Error(`Control dependency "${dep.name}" is missing resolved child graph`);

  let child = dep.children;
  let build = resolveBuild(child);
  let health = resolveServiceHealth(child);
  let dependsOn = resolveControlDependsOn(dep, graph);

  return {
    build,
    container_name: containerName,
    restart: 'unless-stopped',
    environment: resolveControlServiceEnv(dep, graph),
    depends_on: Object.keys(dependsOn).length > 0 ? dependsOn : undefined,
    healthcheck: health,
    networks: networkConfig(dep.alias)
  };
};

let presetPostgres = (dep: ResolvedDep, containerName: string) => {
  let env = dep.config.env ?? {
    POSTGRES_USER: 'postgres',
    POSTGRES_PASSWORD: 'postgres',
    POSTGRES_DB: 'postgres'
  };
  let user = env.POSTGRES_USER ?? 'postgres';

  let volumes: Record<string, any> = {
    [`${dep.composeName}-data`]: {}
  };

  let serviceVolumes = [`${dep.composeName}-data:/var/lib/postgresql/data`];
  if (dep.config.init) {
    serviceVolumes.push(
      `${resolve(dep.sourceDir, dep.config.init)}:/docker-entrypoint-initdb.d/init-test-db.sh:ro`
    );
  }

  return {
    volumes,
    service: {
      image: dep.config.image ?? 'postgres:16-alpine',
      container_name: containerName,
      restart: 'unless-stopped',
      environment: env,
      volumes: serviceVolumes,
      healthcheck: {
        test: ['CMD-SHELL', `pg_isready -U ${user}`],
        interval: '5s',
        timeout: '5s',
        retries: 10
      },
      networks: networkConfig(dep.alias)
    },
    hasHealth: true
  };
};

let presetRedis = (dep: ResolvedDep, containerName: string) => ({
  volumes: {},
  service: {
    image: dep.config.image ?? 'redis:7-alpine',
    container_name: containerName,
    restart: 'unless-stopped',
    healthcheck: {
      test: ['CMD', 'redis-cli', 'ping'],
      interval: '5s',
      timeout: '5s',
      retries: 10
    },
    networks: networkConfig(dep.alias)
  },
  hasHealth: true
});

let presetNats = (dep: ResolvedDep, containerName: string) => ({
  volumes: {},
  service: {
    image: dep.config.image ?? 'nats:2-alpine',
    container_name: containerName,
    restart: 'unless-stopped',
    command: '--cluster_name NATS --cluster nats://0.0.0.0:6222 --http_port 8222',
    networks: networkConfig(dep.alias)
  },
  hasHealth: false
});

let mockService = (dep: ResolvedDep, containerName: string) => {
  let mock = MOCK_DEFINITIONS[dep.config.mock!];
  if (!mock) throw new Error(`Unknown mock "${dep.config.mock}"`);

  return {
    volumes: {},
    service: {
      build: {
        context: join(controlToolingDir, 'mocks'),
        dockerfile: 'Dockerfile',
        args: { MOCK_SERVER: mock.serverPath }
      },
      container_name: containerName,
      restart: 'unless-stopped',
      environment: { PORT: String(mock.port) },
      healthcheck: {
        test: ['CMD-SHELL', mock.healthCmd],
        interval: '5s',
        timeout: '5s',
        retries: 10
      },
      networks: networkConfig(dep.alias)
    },
    hasHealth: true
  };
};

let inlineService = (dep: ResolvedDep, graph: ResolvedGraph, containerName: string) => {
  let inline = typeof dep.config.inline === 'object' ? dep.config.inline : undefined;
  if (!inline) throw new Error(`Inline dependency ${dep.name} is missing [deps.inline] config`);

  let build = inline.build
    ? {
        context: inline.build.context === 'oss' ? graph.ossRoot : resolve(dep.sourceDir, inline.build.context),
        dockerfile: inline.build.dockerfile
      }
    : undefined;

  let health = inline.health?.cmd
    ? { test: ['CMD-SHELL', inline.health.cmd], interval: '5s', timeout: '5s', retries: 10 }
    : inline.port
      ? defaultServiceHealth(inline.port, inline.health?.path ?? '/health')
      : undefined;

  return {
    volumes: {},
    service: {
      ...(inline.image ? { image: inline.image } : {}),
      ...(build ? { build } : {}),
      container_name: containerName,
      restart: 'unless-stopped',
      ...(dep.config.env
        ? { environment: interpolateEnv(dep.config.env, graph.depHosts) }
        : {}),
      command: inline.command,
      healthcheck: health,
      networks: networkConfig(dep.alias)
    },
    hasHealth: !!health
  };
};

let buildLeafDep = (dep: ResolvedDep, graph: ResolvedGraph, containerName: string) => {
  if (dep.kind === 'preset') {
    if (dep.config.preset === 'postgres') return presetPostgres(dep, containerName);
    if (dep.config.preset === 'redis') return presetRedis(dep, containerName);
    if (dep.config.preset === 'nats') return presetNats(dep, containerName);
  }
  if (dep.kind === 'mock') return mockService(dep, containerName);
  if (dep.kind === 'inline') return inlineService(dep, graph, containerName);
  throw new Error(`Unhandled dependency ${dep.name}`);
};

let depWaitCondition = (dep: ResolvedDep, hasHealth?: boolean) => ({
  condition: (hasHealth ?? depHasHealth(dep)) ? 'service_healthy' : 'service_started'
});

let containerNameFor = (projectName: string, depName: string) => `${projectName}-${depName}`;

export let collectContainerNames = (graph: ResolvedGraph, projectName: string): string[] => {
  let names = graph.deps.map(dep => containerNameFor(projectName, dep.name));
  let isSidecar = graph.config.test?.e2e?.runner === 'sidecar';
  names.push(isSidecar ? containerNameFor(projectName, 'test') : containerNameFor(projectName, 'service'));
  return names;
};

export let generateComposeServices = (graph: ResolvedGraph, projectName: string) => {
  let services: Record<string, any> = {};
  let volumes: Record<string, any> = {};
  let dependsOn: Record<string, { condition: string }> = {};
  let seen = new Set<string>();

  for (let dep of graph.deps) {
    if (seen.has(dep.name)) continue;

    let containerName = containerNameFor(projectName, dep.name);

    if (dep.kind === 'control') {
      let scope = dep.config.scope ?? 'service';

      if (scope === 'service') {
        seen.add(dep.name);
        let built = buildControlService(dep, graph, containerName);
        services[dep.composeName] = built;
        dependsOn[dep.composeName] = depWaitCondition(dep, !!built.healthcheck);
        continue;
      }

      if (!dep.children) throw new Error(`Control dependency "${dep.name}" is missing child graph`);

      for (let childDep of dep.children.deps) {
        if (seen.has(childDep.name)) continue;
        seen.add(childDep.name);

        let childContainerName = containerNameFor(projectName, childDep.name);
        let childComposeName = `${graph.rootPrefix}-${childDep.name}`;

        if (childDep.kind === 'control' && childDep.config.scope === 'service') {
          let built = buildControlService(
            {
              ...childDep,
              composeName: childComposeName,
              alias: childDep.name,
              sourceDir: dep.children!.dir
            },
            dep.children!,
            childContainerName
          );
          services[childComposeName] = built;
          dependsOn[childComposeName] = depWaitCondition(childDep, !!built.healthcheck);
          continue;
        }

        let leaf = buildLeafDep(
          {
            ...childDep,
            composeName: childComposeName,
            alias: childDep.name,
            sourceDir: dep.children!.dir
          },
          dep.children!,
          childContainerName
        );
        services[childComposeName] = leaf.service;
        Object.assign(volumes, leaf.volumes);
        dependsOn[childComposeName] = depWaitCondition(childDep, leaf.hasHealth ?? true);
      }

      let childService = buildControlService(dep, graph, containerName);
      services[dep.composeName] = childService;
      dependsOn[dep.composeName] = depWaitCondition(dep, !!childService.healthcheck);
      seen.add(dep.name);
      continue;
    }

    seen.add(dep.name);
    let built = buildLeafDep(dep, graph, containerName);
    services[dep.composeName] = built.service;
    Object.assign(volumes, built.volumes);
    dependsOn[dep.composeName] = depWaitCondition(dep, built.hasHealth ?? true);
  }

  let build = resolveBuild(graph);
  let isSidecar = graph.config.test?.e2e?.runner === 'sidecar';
  let runnerKey = graph.testRunnerComposeName;
  let runnerContainer = isSidecar
    ? containerNameFor(projectName, 'test')
    : containerNameFor(projectName, 'service');

  services[runnerKey] = {
    build,
    container_name: runnerContainer,
    restart: 'unless-stopped',
    command: ['sh', '-c', 'sleep infinity'],
    environment: graph.env,
    depends_on: dependsOn,
    networks: networkConfig(graph.name)
  };

  if (isSidecar) {
    services[runnerKey].healthcheck = {
      test: ['CMD-SHELL', 'sleep 0'],
      interval: '5s',
      timeout: '5s',
      retries: 3
    };
  }

  return { services, volumes };
};

export let generateCompose = (graph: ResolvedGraph, projectName: string) => {
  let { services, volumes } = generateComposeServices(graph, projectName);
  return stringify({
    name: projectName,
    services,
    volumes,
    networks: { 'control-network': { driver: 'bridge' } }
  });
};
