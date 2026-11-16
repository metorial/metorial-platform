import { join, relative, resolve } from 'node:path';
import * as environment from '../environment';
import { databaseOwnerEnvironments, databasePackages } from '../dev';
import { sortedEntries } from '../files';
import * as infrastructure from '../infrastructure';
import { applies } from '../manifest';
import { discoverPackages, relativePath } from '../packages';
import * as turbo from '../turbo';
import type {
  Database,
  Environment,
  LoadedManifest,
  ProjectRoot,
  StackDefinition,
  WorkspaceMetadata
} from '../types';

export type StackMode = 'development' | 'production';

export let containerWorkspace = '/workspace';

export let parseStackMode = (text: string): StackMode => {
  switch (text) {
    case 'dev':
    case 'development':
      return 'development';
    case 'prod':
    case 'production':
      return 'production';
  }

  throw new Error(`invalid stack environment ${JSON.stringify(text)}; use dev or prod`);
};

export interface StackContainer {
  image: string;
  build?: {
    context: string;
    dockerfile: string;
    args: Record<string, string>;
    target?: string;
  };
  command?: string;
  volumes?: Record<string, string>;
}

export interface StackUnit {
  name: string;
  package: string;
  ports: number[];
  env: Environment;
  health: { port: number; path: string; status?: number }[];
  process?: { cwd: string; command: string; dependsOn: string[] };
  container?: StackContainer;
}

export interface StackStep {
  label: string;
  cwd: string;
  command: string[];
  env: Environment;
}

export interface StackPlan {
  definition: StackDefinition;
  mode: StackMode;
  name: string;
  id: string;
  hostname: string;
  composeProject: string;
  data: WorkspaceMetadata;
  selected: LoadedManifest[];
  units: StackUnit[];
  init: StackUnit[];
  hosts: string[];
  requirements: infrastructure.Requirements;
  files: { path: string; values: Environment }[];
  prepare: StackStep[];
  postgres: Database[];
  mongo: Database[];
}

export interface PlanOptions {
  name?: string;
  noPrepare?: boolean;
  environment?: Environment;
}

export let stackRunId = (name: string) => `stack-${name}`;

export let stackHostname = (name: string) => `metorial-stack-${name}.localhost`;

export let composeProjectName = (name: string) => `control-stack-${name}`;

export let validRunName = (name: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);

export let definitions = (manifests: LoadedManifest[], kind: ProjectRoot['kind']) =>
  manifests
    .flatMap(loaded => loaded.manifest.stack_definitions)
    .filter(item => item.mode === 'both' || item.mode === kind)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

export let members = (manifests: LoadedManifest[], project: ProjectRoot, identifier: string) =>
  manifests
    .filter(loaded => loaded.manifest.package && loaded.manifest.stacks[identifier])
    .filter(loaded => applies(loaded.manifest, project.kind))
    .filter(loaded => {
      let mode = loaded.manifest.stacks[identifier]!.mode;

      return mode === 'both' || mode === project.kind;
    });

export let hostAlias = (packageName: string) => packageName.replace(/^@[^/]+\//, '');

let containerPath = (project: ProjectRoot, path: string) =>
  join(containerWorkspace, relative(project.root, path));

let sanitizeImage = (name: string) =>
  name
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export let stackImageTag = (packageName: string) =>
  `control-stack/${sanitizeImage(packageName)}:local`;

let workspaceOf = (project: ProjectRoot, loaded: LoadedManifest, workspace?: string) =>
  resolve(
    project.root,
    workspace ??
      (project.oss !== project.root && loaded.directory.startsWith(project.oss) ? 'oss' : '.')
  );

export let productionContainer = (
  project: ProjectRoot,
  loaded: LoadedManifest,
  identifier: string
): StackContainer | undefined => {
  let production = loaded.manifest.stacks[identifier]!.production;
  let packageName = loaded.manifest.package!.name;
  if (production.disabled) return undefined;

  let volumes = loaded.manifest.stacks[identifier]!.volumes;

  if (production.image && !production.dockerfile)
    return { image: production.image, command: production.command, volumes };

  let target =
    loaded.manifest.ci.dockerfiles[0] ??
    loaded.manifest.ci.images.find(i => i.build || i.dockerfile);
  let dockerfile = production.dockerfile
    ? resolve(project.root, production.dockerfile)
    : resolve(loaded.directory, target?.dockerfile ?? 'Dockerfile');
  let context = workspaceOf(project, loaded, production.workspace ?? target?.workspace);

  return {
    image: production.image ?? stackImageTag(packageName),
    command: production.command,
    volumes,
    build: { context, dockerfile, args: production.args, target: production.target }
  };
};

let rootFor = (
  project: ProjectRoot,
  mode: StackMode,
  hostname: string,
  definition: StackDefinition
): Environment => {
  let root = environment.rootEnvironment(project);
  delete root[environment.isolated];
  if (mode === 'production') delete root[environment.devLoginSecretKey];

  for (let [name, port] of Object.entries(environment.defaultPorts))
    root[environment.portKey(name)] = String(port);

  return {
    ...root,
    METORIAL_ENV: mode,
    NODE_ENV: mode,
    METORIAL_HOSTNAME: hostname,
    ...(definition.edition ? { METORIAL_EDITION: definition.edition } : {})
  };
};

export let planStack = (
  project: ProjectRoot,
  manifests: LoadedManifest[],
  identifier: string,
  mode: StackMode,
  options: PlanOptions = {}
): StackPlan => {
  let definition = definitions(manifests, project.kind).find(item => item.id === identifier);
  if (!definition) {
    let known = definitions(manifests, project.kind).map(item => item.id);
    throw new Error(
      `unknown stack ${JSON.stringify(identifier)}${known.length ? `; available: ${known.join(', ')}` : ' for this checkout'}`
    );
  }

  let name = options.name ?? identifier;
  if (!validRunName(name))
    throw new Error(
      `invalid stack name ${JSON.stringify(name)}; use lowercase letters, digits and dashes`
    );

  let selected = members(manifests, project, identifier);
  if (!selected.length) throw new Error(`stack ${identifier} has no members in this checkout`);

  let id = stackRunId(name);
  let hostname = stackHostname(name);
  let root = rootFor(project, mode, hostname, definition);
  let units: StackUnit[] = [];
  let init: StackUnit[] = [];
  let initSteps: StackStep[] = [];
  let files: Record<string, Environment> = {};

  let memberEnv = (loaded: LoadedManifest) => {
    let member = loaded.manifest.stacks[identifier]!;

    return {
      ...(definition.edition ? { METORIAL_EDITION: definition.edition } : {}),
      ...environment.allForManifest(loaded, root),
      ...environment.resolveEnvironment(member.env, root),
      ...environment.resolveEnvironment(
        mode === 'development' ? member.development.env : member.production.env,
        root
      )
    };
  };

  for (let loaded of selected) {
    let manifest = loaded.manifest;
    let packageName = manifest.package!.name;
    let member = manifest.stacks[identifier]!;
    let ports = Object.values(manifest.endpoints).map(endpoint => endpoint.port);
    let health = [
      ...Object.values(manifest.endpoints).flatMap(endpoint =>
        endpoint.health
          ? [
              {
                port: endpoint.port,
                path:
                  typeof endpoint.health === 'string' ? endpoint.health : endpoint.health.path,
                status:
                  typeof endpoint.health === 'string' ? undefined : endpoint.health.status
              }
            ]
          : []
      ),
      ...manifest.health
    ];
    let env = memberEnv(loaded);
    let runs = member.development.run
      ? Object.fromEntries(
          member.development.run.map((script, index) => [
            index === 0 ? 'dev' : String(index + 1),
            { command: `bun run ${script}`, cwd: undefined, env: {}, depends_on: [] }
          ])
        )
      : manifest.run;
    let production = productionContainer(project, loaded, identifier);

    if (member.init) {
      let unit: StackUnit = {
        name: turbo.turboPackageName(packageName, 'dev'),
        package: packageName,
        ports: [],
        env,
        health: []
      };

      if (mode === 'production') {
        if (!production)
          throw new Error(`${packageName} has no production image in stack ${identifier}`);
        init.push({ ...unit, container: production });
      } else if (!member.development.disabled) {
        let script = member.development.run?.[0];
        if (!script)
          throw new Error(`${packageName} has no development script in stack ${identifier}`);
        init.push(unit);
        initSteps.push({
          label: `Initializing ${packageName}`,
          cwd: relative(project.root, loaded.directory) || '.',
          command: ['bun', 'run', script],
          env: { ...root, ...options.environment, ...env }
        });
      }
      continue;
    }

    if (mode === 'production') {
      if (!production)
        throw new Error(`${packageName} has no production image in stack ${identifier}`);

      units.push({
        name: turbo.turboPackageName(packageName, 'dev'),
        package: packageName,
        ports,
        env,
        health,
        container: production
      });
      continue;
    }

    if (member.development.disabled) continue;

    if (member.development.container || !Object.keys(runs).length) {
      if (!production)
        throw new Error(`${packageName} has nothing to run in stack ${identifier}`);

      units.push({
        name: turbo.turboPackageName(packageName, 'dev'),
        package: packageName,
        ports,
        env,
        health,
        container: production
      });
      continue;
    }

    for (let [runName, run] of sortedEntries(runs))
      units.push({
        name: turbo.turboPackageName(packageName, runName),
        package: packageName,
        ports,
        env: { ...env, ...environment.resolveEnvironment(run.env, root) },
        health,
        process: {
          cwd: containerPath(project, resolve(loaded.directory, run.cwd ?? '.')),
          command: run.command,
          dependsOn: run.depends_on.map(dependency =>
            turbo.turboPackageName(packageName, dependency)
          )
        }
      });
  }

  for (let unit of units) {
    if (!unit.process) continue;

    let manifest = selected.find(
      loaded => loaded.manifest.package?.name === unit.package
    )?.manifest;
    for (let dependency of manifest?.dependencies ?? []) {
      for (let other of units) {
        if (other.process && other.package === dependency.identifier && other !== unit)
          unit.process.dependsOn.push(other.name);
      }
    }
  }

  let active = selected.filter(loaded =>
    [...units, ...init].some(unit => unit.package === loaded.manifest.package!.name)
  );
  let requirements = infrastructure.requirementsFromManifests(active);
  let prepare: StackStep[] = [];

  if (mode === 'development') {
    let packages = databasePackages(active);
    let processEnv: Environment = {
      ...root,
      ...options.environment,
      CONTROL_STACK: '1',
      TURBO_GLOBAL_WARNING_DISABLED: '1'
    };

    let known = discoverPackages(project.root);

    for (let [owner, values] of Object.entries(databaseOwnerEnvironments(active, root))) {
      let item = known.find(candidate => candidate.name === owner);
      if (!item) throw new Error(`unknown database package ${JSON.stringify(owner)}`);
      files[relativePath(project.root, join(item.directory, '.env'))] = values;
    }

    for (let loaded of active)
      Object.assign(
        (files[relativePath(project.root, join(loaded.directory, '.env'))] ??= {}),
        memberEnv(loaded)
      );

    let turboStep = (
      label: string,
      task: string,
      filters: string[],
      env: Environment,
      concurrency?: number
    ): StackStep => ({
      label,
      cwd: '.',
      command: ['bun', 'x', 'turbo', ...turbo.runArgs(task, filters, concurrency)],
      env
    });

    if (!options.noPrepare) {
      if (packages.length) {
        prepare.push(
          turboStep(
            'Generating database clients',
            'control:db:generate',
            packages,
            processEnv,
            3
          )
        );
        prepare.push(
          turboStep(
            'Pushing database schemas',
            'control:db:push',
            packages,
            { ...processEnv, ...environment.prismaDevelopmentEnvironment },
            3
          )
        );
      }

      prepare.push({
        label: 'Building packages',
        cwd: '.',
        command: ['bun', 'run', 'build'],
        env: processEnv
      });

      for (let loaded of active)
        for (let script of loaded.manifest.prepare)
          prepare.push(
            turboStep(
              `Preparing ${loaded.manifest.package!.name}: ${script}`,
              script,
              [loaded.manifest.package!.name],
              { ...processEnv, ...environment.allForManifest(loaded, root) }
            )
          );
    }

    prepare.push(...initSteps);
  }

  let databases = (type: 'postgres' | 'mongo') =>
    [
      ...new Map(
        active
          .flatMap(loaded => Object.values(loaded.manifest[type]))
          .map(db => [db.database, db])
      ).values()
    ].sort((a, b) => (a.database < b.database ? -1 : 1));

  return {
    definition,
    mode,
    name,
    id,
    hostname,
    composeProject: composeProjectName(name),
    data: {
      id,
      branch: `${identifier}/${mode === 'development' ? 'dev' : 'prod'}`,
      hostname,
      source_root: project.root,
      runtime: 'docker',
      endpoint_ports: {}
    },
    selected: active,
    units: units.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    init,
    hosts: [...new Set(active.map(loaded => hostAlias(loaded.manifest.package!.name)))].sort(),
    requirements,
    files: sortedEntries(files).map(([path, values]) => ({ path, values })),
    prepare,
    postgres: databases('postgres'),
    mongo: databases('mongo')
  };
};
