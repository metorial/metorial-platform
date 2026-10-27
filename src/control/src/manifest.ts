import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { packageScripts, readJson, sortedEntries, walk } from './files';
import { externalSchema, manifestSchema, parse } from './schema';
import type { Database, EnvValue, LoadedManifest, Manifest, RootKind } from './types';

export let applies = (manifest: Manifest, kind: RootKind) =>
  manifest.mode === 'both' || manifest.mode === kind;

export let validateTemplates = (value: string, allowed: string[]) => {
  let remaining = value;

  while (remaining.includes('{{')) {
    remaining = remaining.slice(remaining.indexOf('{{') + 2);

    let end = remaining.indexOf('}}');
    if (end < 0) throw new Error(`unclosed template in ${JSON.stringify(value)}`);

    let template = remaining.slice(0, end);
    if (!allowed.includes(template))
      throw new Error(
        `unknown template ${JSON.stringify(template)} in ${JSON.stringify(value)}`
      );
    remaining = remaining.slice(end + 2);
  }

  if (remaining.includes('}}'))
    throw new Error(`unmatched template delimiter in ${JSON.stringify(value)}`);
};

export let load = (path: string): LoadedManifest => {
  let raw = parse(
    manifestSchema,
    Bun.TOML.parse(readFileSync(path, 'utf8')),
    `invalid ${path}`
  );
  if (raw.name !== undefined && raw.package)
    throw new Error(`${path}: use either top-level name/group/dev or package/run, not both`);

  let dev = raw.name !== undefined ? raw.dev : undefined;
  let manifest: Manifest = {
    package:
      raw.name !== undefined
        ? { name: raw.name, groups: raw.group ? [raw.group] : [] }
        : raw.package
          ? { ...raw.package, groups: raw.package.groups ?? [] }
          : undefined,
    mode: raw.mode ?? 'both',
    dependencies: (raw.dependencies ?? []).map(item =>
      typeof item === 'string'
        ? { identifier: item, start: true, env: [] }
        : { ...item, start: item.start ?? true, env: item.env ?? [] }
    ),
    endpoints: Object.fromEntries(
      sortedEntries(raw.endpoints ?? {}).map(([name, endpoint]) => [
        name,
        { ...endpoint, env: endpoint.env ?? [] }
      ])
    ),
    dependency_endpoints: {},
    resources: (raw.resources ?? []).map(item => ({ ...item, env: item.env ?? [] })),
    groups: raw.groups ?? {},
    env: { ...raw.env, ...dev?.env },
    expose: [...(raw.expose ?? []), ...(dev?.expose ?? [])],
    postgres: {},
    mongo: {},
    run: Object.fromEntries(
      sortedEntries(raw.run ?? {}).map(([name, run]) => [
        name,
        { ...run, env: run.env ?? {}, depends_on: run.depends_on ?? [] }
      ])
    ),
    prepare: [...(raw.prepare ?? []), ...(dev?.prepare ?? [])],
    docker: {
      compose: raw.docker?.compose ?? [],
      services: raw.docker?.services ?? [],
      stop: raw.docker?.stop ?? false
    },
    cleanup: {
      paths: raw.cleanup?.paths ?? [],
      commands: [...(raw.cleanup?.commands ?? []), ...(dev?.cleanup ?? [])]
    },
    health: raw.health ?? [],
    e2e: {
      ...raw.e2e,
      start: raw.e2e?.start ?? [],
      tests: raw.e2e?.tests ?? [],
      services: raw.e2e?.services ?? [],
      env: raw.e2e?.env ?? {},
      resources: raw.e2e?.resources ?? []
    },
    ci: {
      images: (raw.ci?.images ?? []).map(image => ({
        ...image,
        group: image.group ?? 'oss',
        platform: image.platform ?? 'linux/amd64',
        stagingOnly: image.stagingOnly ?? false
      })),
      suite: raw.ci?.suite
        ? {
            ...raw.ci.suite,
            runner: raw.ci.suite.runner ?? 'control',
            groups: raw.ci.suite.groups ?? 2,
            workspacePackages: raw.ci.suite.workspacePackages ?? [],
            profiles: raw.ci.suite.profiles ?? []
          }
        : undefined
    }
  };

  for (let type of ['postgres', 'mongo'] as const) {
    for (let [name, db] of sortedEntries(raw[type] ?? {})) {
      manifest[type][name] = {
        host: '127.0.0.1',
        port: type === 'postgres' ? 5432 : 27017,
        ...(type === 'postgres' ? { user: 'postgres', password: 'postgres' } : {}),
        ...Object.fromEntries(Object.entries(db).filter(([, value]) => value !== undefined))
      } as Database;
    }
  }

  for (let [index, script] of (dev?.run ?? []).entries()) {
    manifest.run[index === 0 ? 'dev' : String(index + 1)] = {
      command: `bun run ${script}`,
      env: {},
      depends_on: []
    };
  }

  for (let [, db] of sortedEntries(dev?.db ?? {})) {
    let postgres = db.engine === 'postgres';
    manifest[postgres ? 'postgres' : 'mongo'][db.env] = {
      package: db.package,
      database: db.name,
      host: '127.0.0.1',
      port: postgres ? 35432 : 32707,
      user: postgres ? 'postgres' : 'mongo',
      password: postgres ? 'postgres' : 'mongo',
      service: postgres ? 'postgres-db2' : 'mongodb',
      ...(postgres ? {} : { auth_source: 'admin' })
    };
  }

  for (let [index, exposure] of manifest.expose.entries()) {
    if (!Object.values(manifest.endpoints).some(endpoint => endpoint.port === exposure.port)) {
      manifest.endpoints[index === 0 ? 'http' : `http-${index + 1}`] = {
        port: exposure.port,
        env: []
      };
    }
  }

  validate(manifest, path, dev?.run ?? []);

  return { path, manifest };
};

export let validate = (manifest: Manifest, path: string, scripts: string[] = []) => {
  let fail = (message: string): never => {
    throw new Error(`${path}: ${message}`);
  };
  let identifier = (kind: string, value: string) => {
    if (!value.trim() || /\s/.test(value)) fail(`invalid ${kind} ${JSON.stringify(value)}`);
  };
  let name = (kind: string, value: string) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) fail(`invalid ${kind} ${JSON.stringify(value)}`);
  };
  let envValue = (key: string, value: EnvValue) => {
    if (!/^[a-zA-Z0-9_]+$/.test(key)) fail(`invalid environment key ${JSON.stringify(key)}`);

    if (value === false) fail('environment booleans may only be true (lookup)');

    if (typeof value === 'object' && value.value !== undefined && value.from !== undefined)
      fail(`environment key ${JSON.stringify(key)} cannot set both value and from`);
  };

  let keys = new Map<string, string>();
  let register = (key: string, source: string) => {
    if (keys.has(key))
      fail(
        `environment key ${JSON.stringify(key)} is declared by both ${keys.get(key)} and ${source}`
      );
    keys.set(key, source);
  };
  let structured = (
    entry: { key: string; value: string },
    templates: string[],
    source: string
  ) => {
    envValue(entry.key, '');
    validateTemplates(entry.value, templates);
    register(entry.key, source);
  };
  let unique = <T>(items: T[], kind: string) => {
    if (new Set(items).size !== items.length) fail(`duplicate ${kind}`);
  };

  if (manifest.package) {
    if (!manifest.package.name.trim()) fail('package.name cannot be empty');

    if (!existsSync(join(dirname(path), 'package.json')))
      fail('control.toml must be colocated with package.json');
  } else if (Object.keys(manifest.endpoints).length) fail('endpoints require a named package');

  let scriptNames = [...scripts, ...manifest.e2e.start];
  if (scriptNames.length) {
    let available = packageScripts(dirname(path));

    for (let script of scriptNames) {
      if (!/^[a-zA-Z0-9_:.\-]+$/.test(script))
        fail(`invalid package script ${JSON.stringify(script)}`);

      if (!Object.hasOwn(available, script))
        fail(`package.json does not declare required script ${JSON.stringify(script)}`);
    }
  }

  for (let [key, value] of sortedEntries(manifest.env)) {
    envValue(key, value);
    register(key, '[env]/[dev.env]');
  }
  unique(
    Object.values(manifest.endpoints).map(endpoint => endpoint.port),
    'endpoint port'
  );

  for (let [key, endpoint] of sortedEntries(manifest.endpoints)) {
    name('endpoint', key);

    if (!endpoint.port) fail(`endpoint ${JSON.stringify(key)} port cannot be zero`);

    for (let entry of endpoint.env)
      structured(entry, ['HOSTNAME', 'PORT', 'BIND_PORT'], `endpoint ${JSON.stringify(key)}`);
  }
  unique(
    manifest.resources.map(resource => resource.type),
    'resource declaration'
  );

  for (let resource of manifest.resources) {
    for (let entry of resource.env)
      structured(
        entry,
        [
          'HOSTNAME',
          'PORT',
          'CONTROL_PORT_REDIS',
          'CONTROL_PORT_NATS',
          'CONTROL_PORT_ETCD_CLIENT',
          'CONTROL_PORT_ETCD_PEER'
        ],
        `resource ${resource.type}`
      );
  }
  unique(
    manifest.dependencies.map(dependency => dependency.identifier),
    'dependency'
  );

  for (let dependency of manifest.dependencies) {
    identifier('dependency identifier', dependency.identifier);

    for (let entry of dependency.env) {
      name('dependency endpoint', entry.endpoint);
      structured(
        entry,
        ['HOSTNAME', 'PORT'],
        `dependency ${JSON.stringify(dependency.identifier)}`
      );
    }
  }
  unique(
    manifest.expose.map(exposure => exposure.port),
    'exposed HTTP port'
  );

  if (manifest.expose.some(exposure => !exposure.port))
    fail('exposed HTTP port cannot be zero');

  for (let type of ['postgres', 'mongo'] as const) {
    for (let [key, db] of sortedEntries(manifest[type])) {
      envValue(key, '');

      if (!db.database || /[\0'\"]/.test(db.database))
        fail(`invalid ${type} database ${JSON.stringify(key)}`);
      identifier(`${type} database package`, db.package);
      register(key, `${type} database`);
    }
  }

  for (let [key, run] of sortedEntries(manifest.run)) {
    if (!key.trim() || !run.command.trim()) fail('run names and commands cannot be empty');

    for (let dependency of run.depends_on)
      if (!Object.hasOwn(manifest.run, dependency))
        fail(
          `run ${JSON.stringify(key)} depends on unknown local run ${JSON.stringify(dependency)}`
        );

    for (let [envKey, value] of sortedEntries(run.env)) {
      envValue(envKey, value);

      if (keys.has(envKey))
        fail(
          `environment key ${JSON.stringify(envKey)} is declared by both ${keys.get(envKey)} and run ${JSON.stringify(key)}`
        );
    }
  }

  for (let check of healthChecks(manifest)) {
    if (!check.port) fail('health check port cannot be zero');

    if (!check.path.startsWith('/') || /\s/.test(check.path))
      fail(
        `health path ${JSON.stringify(check.path)} must start with '/' and contain no whitespace`
      );

    if (check.status !== undefined && (check.status < 100 || check.status > 599))
      fail(`health status ${check.status} is invalid`);
  }
  unique(
    manifest.health.map(check => check.port),
    'health check port'
  );

  if (manifest.health.length && !manifest.package)
    fail('health checks require a named package');

  let e2e = manifest.e2e;
  if (
    (e2e.start.length ||
      e2e.image !== undefined ||
      e2e.tests.length ||
      e2e.services.length ||
      e2e.health_timeout !== undefined ||
      Object.keys(e2e.env).length ||
      e2e.resources.length) &&
    !manifest.package
  )
    fail('[e2e] requires a named package');

  if (e2e.image !== undefined && !/^[a-z0-9-]+$/.test(e2e.image))
    fail(`invalid e2e image name ${JSON.stringify(e2e.image)}`);

  if (
    !e2e.tests.length &&
    (e2e.services.length || e2e.health_timeout !== undefined || e2e.resources.length)
  )
    fail('e2e services, health_timeout and resources require e2e tests');

  for (let pattern of e2e.tests)
    if (!pattern.trim() || isAbsolute(pattern))
      fail(`e2e test glob ${JSON.stringify(pattern)} must be a relative package directory`);
  unique(e2e.services, 'e2e service');

  for (let service of e2e.services) identifier('e2e service', service);

  if (e2e.health_timeout === 0) fail('e2e health_timeout cannot be zero');
  unique(
    e2e.resources.map(resource => resource.type),
    'e2e resource declaration'
  );

  for (let [key, value] of sortedEntries(e2e.env)) envValue(key, value);
};

export let healthChecks = (manifest: Manifest) => [
  ...sortedEntries(manifest.endpoints).flatMap(([, endpoint]) =>
    endpoint.health
      ? [
          {
            port: endpoint.bind_port ?? endpoint.port,
            ...(typeof endpoint.health === 'string'
              ? { path: endpoint.health }
              : endpoint.health)
          }
        ]
      : []
  ),
  ...manifest.health
];

export let discover = (root: string): LoadedManifest[] => {
  let manifests = walk(root, 'control.toml').map(load);
  let packages = new Map<string, LoadedManifest>();

  for (let loaded of manifests) {
    let name = loaded.manifest.package?.name;
    if (!name) continue;

    if (packages.has(name))
      throw new Error(
        `duplicate control package name ${JSON.stringify(name)}: ${packages.get(name)!.path} and ${loaded.path}`
      );
    packages.set(name, loaded);
  }

  let npmPackages = walk(root, 'package.json').map(path => ({
    path,
    value: readJson<{ name?: string; scripts?: Record<string, unknown> }>(path)
  }));

  for (let loaded of manifests) {
    let manifest = loaded.manifest;

    for (let db of [...Object.values(manifest.postgres), ...Object.values(manifest.mongo)]) {
      let candidates = npmPackages.filter(item => item.value.name === db.package);
      if (!candidates.length)
        throw new Error(
          `${loaded.path}: database references unknown npm package ${JSON.stringify(db.package)}`
        );

      for (let script of ['control:db:generate', 'control:db:push']) {
        if (!candidates.some(item => typeof item.value.scripts?.[script] === 'string'))
          throw new Error(
            `${loaded.path}: database package ${JSON.stringify(db.package)} does not declare required script ${JSON.stringify(script)}`
          );
      }
    }

    if (!manifest.package && manifest.dependencies.length)
      throw new Error(`${loaded.path}: dependencies require a named package`);

    for (let target of [
      ...manifest.dependencies.map(item => item.identifier),
      ...manifest.e2e.services
    ]) {
      if (target === manifest.package?.name)
        throw new Error(
          `${loaded.path}: package cannot reference itself as a dependency or e2e service`
        );

      let dependency = packages.get(target);
      if (!dependency)
        throw new Error(
          `${loaded.path}: references unknown dependency ${JSON.stringify(target)}`
        );

      for (let kind of ['oss', 'enterprise'] as const) {
        if (applies(manifest, kind) && !applies(dependency.manifest, kind))
          throw new Error(
            `${loaded.path}: dependency ${JSON.stringify(target)} has incompatible mode`
          );
      }
    }
  }

  let visited = new Set<string>();
  let visit = (name: string, path: string[]) => {
    if (path.includes(name))
      throw new Error(
        `control package dependency cycle: ${[...path.slice(path.indexOf(name)), name].join(' -> ')}`
      );

    if (visited.has(name)) return;

    for (let dependency of packages
      .get(name)!
      .manifest.dependencies.filter(item => item.start))
      visit(dependency.identifier, [...path, name]);
    visited.add(name);
  };

  for (let name of [...packages.keys()].sort()) visit(name, []);

  refreshDependencyEndpoints(manifests);
  validateDependencyEndpoints(manifests);

  return manifests;
};

export let refreshDependencyEndpoints = (
  manifests: LoadedManifest[],
  hostname = 'localhost'
) => {
  let packages = new Map(
    manifests
      .filter(item => item.manifest.package)
      .map(item => [
        item.manifest.package!.name,
        Object.fromEntries(
          sortedEntries(item.manifest.endpoints).map(([name, endpoint]) => [
            name,
            { hostname, port: endpoint.port }
          ])
        )
      ])
  );

  for (let loaded of manifests) {
    loaded.manifest.dependency_endpoints = Object.fromEntries(
      loaded.manifest.dependencies.map(item => [
        item.identifier,
        structuredClone(packages.get(item.identifier) ?? {})
      ])
    );
  }
};

export let validateDependencyEndpoints = (manifests: LoadedManifest[]) => {
  for (let loaded of manifests) {
    for (let dependency of loaded.manifest.dependencies) {
      for (let env of dependency.env) {
        if (!loaded.manifest.dependency_endpoints[dependency.identifier]?.[env.endpoint])
          throw new Error(
            `${loaded.path}: dependency ${JSON.stringify(dependency.identifier)} references unknown endpoint ${JSON.stringify(env.endpoint)}`
          );
      }
    }
  }
};

export let readExternals = (root: string) => {
  let path = join(root, 'control-external.toml');

  return existsSync(path)
    ? (parse(externalSchema, Bun.TOML.parse(readFileSync(path, 'utf8')), path).external ?? [])
    : [];
};

export let loadExternals = (root: string, manifests: LoadedManifest[]): Set<string> => {
  let identifiers = new Set<string>();

  for (let external of readExternals(root)) {
    if (
      !external.identifier.trim() ||
      /\s/.test(external.identifier) ||
      !external.hostname.trim() ||
      /\s/.test(external.hostname)
    )
      throw new Error('invalid external identifier or hostname');

    if (identifiers.has(external.identifier))
      throw new Error(`duplicate external ${JSON.stringify(external.identifier)}`);
    identifiers.add(external.identifier);

    let target = manifests.find(item => item.manifest.package?.name === external.identifier);
    if (!target)
      throw new Error(
        `external references unknown dependency ${JSON.stringify(external.identifier)}`
      );

    for (let [name, port] of sortedEntries(external.mapping ?? {})) {
      if (!port)
        throw new Error(`external endpoint ${JSON.stringify(name)} port cannot be zero`);

      if (!target.manifest.endpoints[name])
        throw new Error(`external maps unknown endpoint ${JSON.stringify(name)}`);
    }

    for (let loaded of manifests) {
      for (let dependency of loaded.manifest.dependencies.filter(
        item => item.identifier === external.identifier
      )) {
        for (let env of dependency.env)
          if (external.mapping?.[env.endpoint] === undefined)
            throw new Error(
              `external ${JSON.stringify(external.identifier)} is missing mapping for referenced endpoint ${JSON.stringify(env.endpoint)}`
            );

        for (let [name, port] of sortedEntries(external.mapping ?? {}))
          loaded.manifest.dependency_endpoints[external.identifier]![name] = {
            hostname: external.hostname,
            port
          };
      }
    }
  }
  validateDependencyEndpoints(manifests);

  return identifiers;
};

export let select = (
  manifests: LoadedManifest[],
  selectors: string[],
  kind: RootKind
): LoadedManifest[] => {
  let applicable = manifests.filter(item => applies(item.manifest, kind));
  if (!selectors.length) return applicable;

  let groups = new Map<string, Set<string>>();

  for (let loaded of manifests)
    for (let [name, members] of sortedEntries(loaded.manifest.groups))
      groups.set(name, new Set([...(groups.get(name) ?? []), ...members]));

  let matched = new Set<string>();
  let result = applicable.filter(({ manifest }) => {
    if (!manifest.package) return true;

    let found = false;

    for (let selector of selectors) {
      let hit =
        manifest.package.name === selector ||
        manifest.package.groups.includes(selector) ||
        groups.get(selector)?.has(manifest.package.name);
      if (hit || groups.has(selector)) matched.add(selector);
      found ||= !!hit;
    }

    return found;
  });
  let unknown = selectors.filter(selector => !matched.has(selector));
  if (unknown.length)
    throw new Error(`unknown package/group selector(s): ${unknown.join(', ')}`);

  return result;
};

export let dependencyClosure = (
  manifests: LoadedManifest[],
  roots: LoadedManifest[],
  kind: RootKind,
  excluded = new Set<string>()
): LoadedManifest[] => {
  let packages = new Map(
    manifests
      .filter(item => applies(item.manifest, kind) && item.manifest.package)
      .map(item => [item.manifest.package!.name, item])
  );
  let visited = new Set(
    roots.flatMap(item => (item.manifest.package ? [item.manifest.package.name] : []))
  );
  let result: LoadedManifest[] = [];
  let visit = (name: string) => {
    if (excluded.has(name) || visited.has(name)) return;

    let loaded = packages.get(name);
    if (!loaded) throw new Error(`unknown control package dependency ${JSON.stringify(name)}`);
    visited.add(name);

    for (let dependency of loaded.manifest.dependencies.filter(item => item.start))
      visit(dependency.identifier);
    result.push(loaded);
  };

  for (let loaded of roots)
    for (let dependency of loaded.manifest.dependencies.filter(item => item.start))
      visit(dependency.identifier);

  return result;
};

export let selectWithDependencies = (
  manifests: LoadedManifest[],
  selectors: string[],
  kind: RootKind,
  excluded = new Set<string>()
): LoadedManifest[] => {
  let selected = select(manifests, selectors, kind).filter(
    item => !excluded.has(item.manifest.package?.name ?? '')
  );
  if (!selectors.length) return selected;

  let roots = selected.filter(item => !item.manifest.package);
  let direct = selected.filter(item => item.manifest.package);

  return [
    ...roots,
    ...new Set([...dependencyClosure(manifests, direct, kind, excluded), ...direct])
  ];
};
