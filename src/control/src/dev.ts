import { dirname, join } from 'node:path';
import { readJson, walk } from './files';
import * as environment from './environment';
import * as manifest from './manifest';
import * as workspace from './workspace';
import * as docker from './docker';
import * as turbo from './turbo';
import * as commands from './process';
import * as infrastructure from './infrastructure';
import * as proxy from './proxy';
import type { Environment, LoadedManifest, ProjectRoot } from './types';

export let selection = async (
  project: ProjectRoot,
  selectors: string[],
  initialize = true
) => {
  if (initialize) await workspace.metadata(project);

  let manifests = manifest.discover(project.root);
  await workspace.configureManifests(project, manifests);

  let externals = manifest.loadExternals(project.root, manifests);
  let selected = manifest.selectWithDependencies(
    manifests,
    selectors,
    project.kind,
    externals
  );

  return { manifests, selected, env: environment.rootEnvironment(project) };
};

export let databasePackages = (manifests: LoadedManifest[]) =>
  [
    ...new Set(
      manifests.flatMap(({ manifest }) =>
        [...Object.values(manifest.postgres), ...Object.values(manifest.mongo)].map(
          db => db.package
        )
      )
    )
  ].sort();

export let databaseOwnerEnvironments = (manifests: LoadedManifest[], root: Environment) => {
  let values: Record<string, Environment> = {};
  let packages = databasePackages(manifests);

  for (let loaded of manifests) {
    let resolved = environment.allForManifest(loaded, root);
    let name = loaded.manifest.package?.name;
    if (name && packages.includes(name)) Object.assign((values[name] ??= {}), resolved);

    for (let [key, db] of [
      ...Object.entries(loaded.manifest.postgres),
      ...Object.entries(loaded.manifest.mongo)
    ])
      (values[db.package] ??= {})[key] = resolved[key]!;
  }

  return values;
};

export let writeDatabaseOwnerEnvironments = (
  root: string,
  manifests: LoadedManifest[],
  env: Environment
) => {
  let paths = new Map<string, string>();

  for (let path of walk(root, 'package.json')) {
    let name = readJson<{ name?: string }>(path).name;
    if (name && !paths.has(name)) paths.set(name, dirname(path));
  }

  for (let [name, values] of Object.entries(databaseOwnerEnvironments(manifests, env))) {
    let directory = paths.get(name);
    if (!directory) throw new Error(`unknown database package ${JSON.stringify(name)}`);
    environment.writeDotenv(join(directory, '.env'), values);
  }
};

export let runTurboTask = async (
  root: string,
  env: Environment,
  task: string,
  filters: string[],
  concurrency?: number
) => {
  let [program, args] = turbo.command(root, turbo.runArgs(task, filters, concurrency));
  await commands.run(program, args, root, { ...env, TURBO_GLOBAL_WARNING_DISABLED: '1' });
};

export let prepareSelected = async (
  project: ProjectRoot,
  selected: LoadedManifest[],
  env: Environment,
  skipCommands: boolean
) => {
  for (let loaded of selected.filter(environment.hasValues))
    environment.writeForManifest(loaded, env);

  if (skipCommands) return;
  writeDatabaseOwnerEnvironments(project.root, selected, env);

  let packages = databasePackages(selected);

  for (let [label, task] of [
    ['Generating selected database clients', 'control:db:generate'],
    ['Pushing selected database schemas', 'control:db:push']
  ]) {
    if (!packages.length) continue;
    console.log(label);

    await runTurboTask(project.root, env, task!, packages, 3);
  }
  console.log('Building packages');

  await commands.run('bun', ['run', 'build'], project.root, env);

  for (let loaded of selected) {
    let filter = loaded.manifest.package?.name ?? loaded.path;

    for (let script of loaded.manifest.prepare) {
      console.log(`Preparing [${filter}]: turbo run ${script}`);

      await runTurboTask(project.root, environment.allForManifest(loaded, env), script, [
        filter
      ]);
    }
  }
};

export let runPrepare = async (
  project: ProjectRoot,
  selectors: string[],
  noDocker: boolean
) => {
  let { selected, env } = await selection(project, selectors);
  if (!selected.length) throw new Error('no control.toml manifests were selected');

  if (!noDocker) {
    console.log('Starting development services');

    await docker.start(project.root, selected, env);
    console.log('Development services ready');
  }

  await prepareSelected(project, selected, env, false);
};

export let runDatabaseTask = async (
  project: ProjectRoot,
  selectors: string[],
  task: 'generate' | 'push'
) => {
  let { selected, env } = await selection(project, selectors);
  if (!selected.length) throw new Error('no control.toml manifests were selected');

  if (task === 'push') {
    console.log('Starting required development database services');

    await docker.start(project.root, selected, env, true);
  }

  await prepareSelected(project, selected, env, true);
  writeDatabaseOwnerEnvironments(project.root, selected, env);

  let packages = databasePackages(selected);
  if (!packages.length) {
    console.log('No database packages selected');

    return;
  }
  console.log(
    `${task === 'generate' ? 'Generating selected database clients' : 'Pushing selected database schemas'}: ${packages.join(', ')}`
  );

  await runTurboTask(project.root, env, `control:db:${task}`, packages, 3);
};

export let cleanupCommands = async (selected: LoadedManifest[], env: Environment) => {
  let firstError: unknown;

  for (let loaded of [...selected].reverse()) {
    for (let command of [...loaded.manifest.cleanup.commands].reverse()) {
      try {
        await commands.shell(
          command,
          dirname(loaded.path),
          environment.allForManifest(loaded, env)
        );
      } catch (error) {
        console.error(`warning: cleanup command failed in ${dirname(loaded.path)}: ${error}`);
        firstError ??= error;
      }
    }
  }

  if (firstError) throw firstError;
};

export let run = async (
  project: ProjectRoot,
  selectors: string[],
  noDocker: boolean,
  noPrepare: boolean,
  stopDocker: boolean,
  dryRun: boolean
) => {
  let { manifests, selected, env } = await selection(project, selectors, !dryRun);
  if (!selected.length)
    throw new Error('no control.toml manifests or run commands were selected');

  if (dryRun) {
    let packages = turbo.plan(selected, project.root, env);
    console.log(`root: ${project.root}`);
    console.log(
      `infrastructure: ${infrastructure.serviceNames(infrastructure.requirementsFromManifests(selected)).join(', ')}`
    );

    if (!noPrepare) {
      let packages = databasePackages(selected).join(', ');
      console.log(`prepare: turbo run control:db:generate (${packages})`);
      console.log(`prepare: turbo run control:db:push (${packages})`);
      console.log('prepare: bun run build');
    }

    for (let loaded of selected) {
      let filter = loaded.manifest.package?.name ?? loaded.path;

      for (let script of loaded.manifest.prepare)
        console.log(`prepare [${filter}]: turbo run ${script} --filter=${filter}`);

      for (let [name, run] of Object.entries(loaded.manifest.run).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0
      ))
        console.log(`dev [${dirname(loaded.path)}:${name}]: ${run.command}`);
    }
    console.log(`would generate ${packages.length} Turbo mirror package(s)`);

    return;
  }

  let managed = !!process.env.CONTROL_WORKSPACE_ID?.trim();
  if (managed && !noDocker) console.log('Using workspace-managed development services');

  let projects: docker.ComposeProject[] = [];

  try {
    if (!noDocker && !managed) {
      console.log('Starting development services');
      projects = await docker.start(project.root, selected, env);
      console.log('Development services ready');
    }

    await prepareSelected(project, selected, env, noPrepare);

    let packages = turbo.plan(selected, project.root, env);
    if (!packages.length) throw new Error('selected manifests contain no run commands');

    let generated = join(project.root, '.control/dev/turbo');
    turbo.generate(generated, packages);
    console.log(`Prepared ${packages.length} run command(s)`);

    let data = await workspace.metadata(project);
    await proxy.ensure(project, data, proxy.publicPorts(manifests, project));

    let unregister = await proxy.register(project, data, selected);
    let interactive = !!(process.stdin.isTTY && process.stdout.isTTY);
    let args = [
      'run',
      'dev',
      `--ui=${interactive ? 'tui' : 'stream'}`,
      '--continue=always',
      `--concurrency=${packages.length + 1}`,
      ...turbo.filters(packages)
    ];
    let [program, commandArgs] = turbo.command(project.root, args);

    let result: unknown;

    try {
      await commands.wait(
        commands.spawn(
          program,
          commandArgs,
          generated,
          { ...env, TURBO_GLOBAL_WARNING_DISABLED: '1' },
          interactive
        ),
        program,
        false,
        true
      );
    } catch (error) {
      if (!(error instanceof commands.Interrupted)) result = error;
    }

    try {
      await unregister();
    } catch (error) {
      result ??= error;
    }

    try {
      await cleanupCommands(selected, env);
    } catch (error) {
      result ??= error;
    }

    if (stopDocker || selected.some(item => item.manifest.docker.stop))
      await docker.stop(project.root, projects, env);

    if (result) throw result;
  } catch (error) {
    await docker.stop(project.root, projects, env);

    if (!(error instanceof commands.Interrupted)) throw error;
  }
};
