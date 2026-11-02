import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { readJson, sortedEntries, sortJson } from './files';
import { discoverPackages, globMatch, relativePath, wildcard } from './packages';
import * as manifest from './manifest';
import * as environment from './environment';
import { databaseOwnerEnvironments, databasePackages } from './dev';
import * as turbo from './turbo';
import * as commands from './process';
import type { Database, Environment, LoadedManifest, ProjectRoot } from './types';
import type {
  Plan as RunnerPlan,
  Service,
  Stack,
  Step
} from '../../../scripts/dev-tools/e2e/runner';

export type { Service, Stack, Step };

export interface Options {
  filters: string[];
  images?: string;
  workspace?: string;
  keep: boolean;
  planOnly: boolean;
  concurrency?: number;
  testArgs: string[];
}

export interface Plan extends RunnerPlan {
  testArgs: string[];
  postgres: Database[];
  mongo: Database[];
  objectStorage: boolean;
  objectStorageImage?: string;
}

export let serializedPlan = (plan: Plan): RunnerPlan => {
  let {
    postgres: _postgres,
    mongo: _mongo,
    objectStorage: _objectStorage,
    objectStorageImage: _objectStorageImage,
    ...serialized
  } = plan;

  return serialized;
};

export let rootEnvironment = (project: ProjectRoot): Environment => ({
  METORIAL_ENV: 'development',
  METORIAL_SOURCE: project.kind,
  IS_ENTERPRISE: String(project.kind === 'enterprise'),
  METORIAL_HOSTNAME: 'localhost',
  NODE_ENV: 'development',
  ...Object.fromEntries(
    Object.entries(environment.defaultPorts).map(([name, port]) => [
      environment.portKey(name),
      String(port)
    ])
  ),
  [environment.isolated]: '1'
});

export let processEnvironment = (root: Environment) => {
  let env: Environment = { ...root, CONTROL_E2E: '1', TURBO_GLOBAL_WARNING_DISABLED: '1' };
  delete env[environment.isolated];

  return env;
};

export let isPinnedImage = (image: string) =>
  /^ghcr\.io\/metorial\/[a-z0-9-]+@sha256:[a-f0-9]{64}$/.test(image);

export let readImages = (directory: string, manifests: LoadedManifest[]) => {
  let images: Record<string, string> = {};

  for (let loaded of manifests) {
    let name = loaded.manifest.e2e.image;
    if (!name) continue;

    let path = join(directory, `${name}.json`);
    let artifact = readJson<{ name: string; image: string }>(path);
    if (artifact.name !== name)
      throw new Error(
        `${path}: artifact name ${JSON.stringify(artifact.name)} does not match ${JSON.stringify(name)}`
      );

    if (typeof artifact.image !== 'string')
      throw new Error(`invalid tested image artifact ${path}`);

    if (process.env.GITHUB_ACTIONS === 'true' && !isPinnedImage(artifact.image))
      throw new Error(`${path}: image must be a digest-pinned ghcr.io/metorial reference`);
    images[name] = artifact.image;
  }

  return images;
};

export let readObjectStorageImage = (directory: string) => {
  let path = join(directory, 'object-store.json');
  if (!existsSync(path)) return undefined;

  let artifact = readJson<{ name: string; image: string }>(path);
  if (artifact.name !== 'object-store' || typeof artifact.image !== 'string')
    throw new Error(`invalid tested image artifact ${path}`);

  if (process.env.GITHUB_ACTIONS === 'true' && !isPinnedImage(artifact.image))
    throw new Error(`${path}: image must be a digest-pinned ghcr.io/metorial reference`);

  return artifact.image;
};

export let buildPlan = (
  project: ProjectRoot,
  manifests: LoadedManifest[],
  options: Options
): Plan => {
  let mode: 'images' | 'local' = options.images !== undefined ? 'images' : 'local';
  let root = rootEnvironment(project);
  let applicable = manifests.filter(item => manifest.applies(item.manifest, project.kind));
  let byName = new Map(
    applicable
      .filter(item => item.manifest.package)
      .map(item => [item.manifest.package!.name, item])
  );

  let packages = discoverPackages(project.root);
  let owners = new Map<string, string>();
  let stacks = applicable
    .filter(item => item.manifest.e2e.tests.length)
    .map(loaded => {
      let name = loaded.manifest.package!.name;
      let tests = new Set<string>();

      for (let pattern of loaded.manifest.e2e.tests) {
        let matched = packages.filter(item =>
          globMatch(resolve(dirname(loaded.path), pattern), item.directory)
        );
        if (!matched.length)
          throw new Error(
            `${loaded.path}: e2e test glob ${JSON.stringify(pattern)} matches no packages`
          );

        for (let item of matched) if (item.scripts.has('test:e2e')) tests.add(item.name);
      }

      for (let test of tests) {
        if (owners.has(test) && owners.get(test) !== name)
          throw new Error(
            `e2e test package ${JSON.stringify(test)} belongs to both ${owners.get(test)} and ${name}`
          );
        owners.set(test, name);
      }

      return { loaded, tests: [...tests].sort() };
    });
  if (!stacks.length) throw new Error('no e2e stacks are declared for this checkout');

  if (options.filters.length) {
    for (let filter of options.filters)
      if (
        !stacks.some(
          item =>
            wildcard(filter, item.loaded.manifest.package!.name) ||
            item.tests.some(test => wildcard(filter, test))
        )
      )
        throw new Error(
          `e2e filter ${JSON.stringify(filter)} matches no stack or test package`
        );
    stacks = stacks.flatMap(item => {
      let tests = options.filters.some(filter =>
        wildcard(filter, item.loaded.manifest.package!.name)
      )
        ? item.tests
        : item.tests.filter(test => options.filters.some(filter => wildcard(filter, test)));

      return tests.length ? [{ ...item, tests }] : [];
    });
  }

  let suts = stacks.map(item => item.loaded);
  let sutNames = new Set(suts.map(item => item.manifest.package!.name));
  let extra = suts.flatMap(item =>
    item.manifest.e2e.services.map(name => {
      let target = byName.get(name);
      if (!target)
        throw new Error(`${item.path}: unknown e2e service ${JSON.stringify(name)}`);

      return target;
    })
  );
  let seen = new Set<string>();

  let dependencies = [
    ...manifest.dependencyClosure(manifests, [...suts, ...extra], project.kind),
    ...extra
  ].filter(item => {
    let name = item.manifest.package!.name;
    if (sutNames.has(name) || seen.has(name)) return false;
    seen.add(name);

    return true;
  });
  let all = [...dependencies, ...suts];
  let images = options.images !== undefined ? readImages(options.images, all) : undefined;
  let ports = new Map<number, string>();

  for (let loaded of all) {
    let name = loaded.manifest.package!.name;

    for (let port of new Set([
      ...Object.values(loaded.manifest.endpoints).map(endpoint => endpoint.port),
      ...loaded.manifest.health.map(check => check.port)
    ])) {
      if (ports.has(port))
        throw new Error(
          `e2e services ${JSON.stringify(ports.get(port))} and ${JSON.stringify(name)} both listen on port ${port}; they share one network namespace`
        );
      ports.set(port, name);
    }
  }

  let service = (loaded: LoadedManifest, role: string): Service => {
    let name = loaded.manifest.package!.name;
    let e2e = loaded.manifest.e2e;
    let health = manifest.healthChecks(loaded.manifest).map(check => ({
      url: `http://localhost:${check.port}${check.path}`,
      ...(check.status === undefined ? {} : { status: check.status })
    }));
    if (!health.length)
      throw new Error(
        `${loaded.path}: e2e ${role} ${JSON.stringify(name)} declares no health check (add \`health\` to an endpoint or a [[health]] entry)`
      );

    if (mode === 'local' && !e2e.start.length)
      throw new Error(
        `${loaded.path}: e2e ${role} ${JSON.stringify(name)} declares no [e2e] start scripts`
      );

    if (mode === 'images' && !e2e.image)
      throw new Error(
        `${loaded.path}: e2e ${role} ${JSON.stringify(name)} declares no [e2e] image`
      );

    return {
      name,
      directory: relativePath(project.root, dirname(loaded.path)),
      start: e2e.start,
      ...(images && e2e.image ? { image: images[e2e.image]! } : {}),
      env: {
        ...environment.allForManifest(loaded, root),
        ...environment.resolveEnvironment(e2e.env, root),
        CONTROL_E2E: '1'
      },
      health
    };
  };
  let objectStorage = suts.some(item =>
    item.manifest.e2e.resources.some(resource => resource.type === 'object-storage')
  );
  let dependencyServices = dependencies.map(loaded => service(loaded, 'dependency'));
  let sutServices = suts.map(loaded => service(loaded, 'system under test'));
  let endpoints = JSON.stringify(
    Object.fromEntries(
      [...all]
        .sort((a, b) => (a.manifest.package!.name < b.manifest.package!.name ? -1 : 1))
        .map(item => [
          item.manifest.package!.name,
          Object.fromEntries(
            sortedEntries(item.manifest.endpoints).map(([name, endpoint]) => [
              name,
              `http://localhost:${endpoint.port}`
            ])
          )
        ])
    )
  );

  let plannedStacks: Stack[] = stacks.map((item, index) => {
    let roots = [
      item.loaded,
      ...item.loaded.manifest.e2e.services.map(name => byName.get(name)!)
    ];
    let services = [
      ...new Set(
        [...roots, ...manifest.dependencyClosure(manifests, roots, project.kind)].map(
          item => item.manifest.package!.name
        )
      )
    ].sort();

    return {
      name: sutServices[index]!.name,
      tests: item.tests,
      services,
      env: { ...sutServices[index]!.env, CONTROL_E2E_ENDPOINTS: endpoints }
    };
  });
  let files: Record<string, Environment> = {};
  let prepare: Step[] = [];
  if (mode === 'local') {
    for (let [name, values] of Object.entries(databaseOwnerEnvironments(all, root))) {
      let item = packages.find(item => item.name === name);
      if (!item) throw new Error(`unknown database package ${JSON.stringify(name)}`);
      files[relativePath(project.root, join(item.directory, '.env'))] = values;
    }

    for (let item of [...dependencyServices, ...sutServices])
      Object.assign(
        (files[item.directory === '.' ? '.env' : `${item.directory}/.env`] ??= {}),
        item.env
      );

    let env = processEnvironment(root);
    let step = (
      label: string,
      task: string,
      filters: string[],
      env: Environment,
      concurrency?: number
    ): Step => ({
      label,
      cwd: '.',
      command: ['bun', 'x', 'turbo', ...turbo.runArgs(task, filters, concurrency)],
      env
    });
    let dbPackages = databasePackages(all);
    if (dbPackages.length) {
      prepare.push(
        step('Generating database clients', 'control:db:generate', dbPackages, env, 3)
      );
      prepare.push(step('Pushing database schemas', 'control:db:push', dbPackages, env, 3));
    }

    prepare.push({
      label: 'Building packages',
      cwd: '.',
      command: ['bun', 'run', 'build'],
      env
    });

    for (let item of all)
      for (let script of item.manifest.prepare)
        prepare.push(
          step(
            `Preparing ${item.manifest.package!.name}: ${script}`,
            script,
            [item.manifest.package!.name],
            { ...environment.allForManifest(item, root), ...env }
          )
        );
  }

  let databases = (type: 'postgres' | 'mongo') =>
    [
      ...new Map(
        all.flatMap(item => Object.values(item.manifest[type])).map(db => [db.database, db])
      ).values()
    ].sort((a, b) => (a.database < b.database ? -1 : 1));

  return {
    mode,
    concurrency: Math.max(1, options.concurrency ?? 4),
    testArgs: options.testArgs,
    healthTimeoutSeconds: Math.max(
      ...suts
        .map(item => item.manifest.e2e.health_timeout)
        .filter((value): value is number => value !== undefined),
      ...(suts.some(item => item.manifest.e2e.health_timeout !== undefined) ? [] : [300])
    ),
    files: sortedEntries(files).map(([path, values]) => ({ path, values })),
    prepare,
    dependencies: dependencyServices,
    suts: sutServices,
    stacks: plannedStacks,
    postgres: databases('postgres'),
    mongo: databases('mongo'),
    objectStorage,
    ...(objectStorage && options.images !== undefined
      ? { objectStorageImage: readObjectStorageImage(options.images) }
      : {})
  };
};

export let ciRuntime = ():
  { images?: Record<string, string>; keys?: Record<string, string> } | undefined =>
  process.env.CONTROL_CI_RUNTIME === undefined
    ? undefined
    : readJson(process.env.CONTROL_CI_RUNTIME);

export let parseFingerprints = (text: string, names: Set<string>): Record<string, string> => {
  let start = text.indexOf('{');
  if (start < 0) throw new Error('Turbo printed no dry-run summary');

  let summary = JSON.parse(text.slice(start)) as {
    tasks?: { taskId?: string; hash?: string }[];
  };
  let fingerprints: Record<string, string> = {};

  for (let task of summary.tasks ?? []) {
    if (!task.taskId?.endsWith('#e2e:fingerprint') || typeof task.hash !== 'string') continue;

    let name = task.taskId.slice(0, -'#e2e:fingerprint'.length);
    if (names.has(name)) fingerprints[name] = task.hash;
  }

  for (let name of [...names].sort())
    if (!Object.hasOwn(fingerprints, name))
      throw new Error(`Turbo did not fingerprint ${JSON.stringify(name)}`);

  return fingerprints;
};

export let attachCacheKeys = (plan: Plan, fingerprints: Record<string, string>) => {
  let environments = new Map(
    [...plan.dependencies, ...plan.suts].map(service => [service.name, service.env])
  );
  let runtime;

  try {
    runtime = ciRuntime();
  } catch {}

  for (let stack of plan.stacks)
    stack.cacheKeyInputs = sortJson({
      version: 1,
      mode: plan.mode,
      env: stack.env,
      services: Object.fromEntries(
        stack.services.map(name => [
          name,
          { fingerprint: fingerprints[name] ?? null, env: environments.get(name) ?? null }
        ])
      ),
      ci: runtime?.keys?.[stack.name] ?? null
    });
};

export let serviceFingerprints = async (project: ProjectRoot, plan: Plan) => {
  let names = new Set([...plan.dependencies, ...plan.suts].map(service => service.name));
  let args = [
    'run',
    'e2e:fingerprint',
    '--dry=json',
    '--cache=local:,remote:',
    ...[...names].sort().map(name => `--filter=${name}`)
  ];
  let [program, commandArgs] = process.env.TURBO_EXECUTABLE
    ? [process.env.TURBO_EXECUTABLE, args]
    : turbo.command(project.root, args);

  return parseFingerprints(await commands.output(program!, commandArgs!, project.root), names);
};
