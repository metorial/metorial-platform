import { join } from 'node:path';
import * as environment from './environment';
import * as manifest from './manifest';
import * as workspace from './workspace';
import * as docker from './docker';
import { generate as generateDockerfiles } from './dockerfile/generate';
import * as turbo from './turbo';
import { databaseOwnerEnvironments, databasePackages, runDatabaseScripts } from './database';
import * as commands from './process';
import * as infrastructure from './infrastructure';
import * as proxy from './proxy';
import { clearServicePorts } from './ports';
import type { Environment, LoadedManifest, ProjectRoot } from './types';

export let syncDockerfiles = (project: ProjectRoot, manifests: LoadedManifest[]) => {
  try {
    return generateDockerfiles(project, { write: true }, manifests).changed;
  } catch (error) {
    commands.say(
      `could not generate Dockerfiles: ${error instanceof Error ? error.message : error}`
    );

    return [];
  }
};

export let selection = async (
  project: ProjectRoot,
  selectors: string[],
  initialize = true
) => {
  if (initialize) await workspace.metadata(project);

  let manifests = manifest.discover(project.root);
  await workspace.configureManifests(project, manifests);
  if (initialize) syncDockerfiles(project, manifests);

  let externals = manifest.loadExternals(project.root, manifests);
  let selected = manifest.selectWithDependencies(
    manifests,
    selectors,
    project.kind,
    externals
  );

  return { manifests, selected, env: environment.rootEnvironment(project) };
};

export { databasePackages, databaseOwnerEnvironments };

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
  if (skipCommands) return;

  let packages = databasePackages(selected);

  if (packages.length) {
    commands.say('Generating selected database clients');
    await runDatabaseScripts(project, selected, env, 'generate', { cached: true });
  }

  let push = async () => {
    if (!packages.length) return;
    commands.say('Pushing selected database schemas');
    await runDatabaseScripts(project, selected, env, 'push', { cached: true });
  };
  let build = async () => {
    commands.say('Building packages');
    await commands.run('bun', ['run', 'build'], project.root, env);
  };

  let results = await Promise.allSettled([push(), build()]);
  let failed = results.find(result => result.status === 'rejected');
  if (failed) throw (failed as PromiseRejectedResult).reason;

  for (let loaded of selected) {
    let filter = loaded.manifest.package?.name ?? loaded.path;

    for (let script of loaded.manifest.prepare) {
      commands.say(`Preparing [${filter}]: turbo run ${script}`);

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
  if (!selected.length) throw new Error('no control manifests were selected');

  if (!noDocker) {
    commands.say('Starting development services');

    await docker.start(project.root, selected, env);
    commands.say('Development services ready');
  }

  await prepareSelected(project, selected, env, false);
};

export let runDatabaseTask = async (
  project: ProjectRoot,
  selectors: string[],
  task: 'generate' | 'push' | 'migrate'
) => {
  let { selected, env } = await selection(project, selectors);
  if (!selected.length) throw new Error('no control manifests were selected');

  if (task === 'push') {
    commands.say('Starting required development database services');

    await docker.start(project.root, selected, env, true);
  }

  let packages = databasePackages(selected);
  if (!packages.length) {
    commands.say('No database packages selected');

    return;
  }
  commands.say(
    `${{ generate: 'Generating selected database clients', push: 'Pushing selected database schemas', migrate: 'Migrating selected databases' }[task]}: ${packages.join(', ')}`
  );

  await runDatabaseScripts(project, selected, env, task, { cached: false });
};

export let cleanupCommands = async (selected: LoadedManifest[], env: Environment) => {
  let firstError: unknown;

  for (let loaded of [...selected].reverse()) {
    for (let command of [...loaded.manifest.cleanup.commands].reverse()) {
      try {
        await commands.shell(
          command,
          loaded.directory,
          environment.allForManifest(loaded, env)
        );
      } catch (error) {
        commands.warn(`warning: cleanup command failed in ${loaded.directory}: ${error}`);
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
  if (!selected.length) throw new Error('no control manifests or run commands were selected');

  if (dryRun) {
    let packages = turbo.plan(selected, project.root, env);
    commands.say(`root: ${project.root}`);
    commands.say(
      `infrastructure: ${infrastructure.serviceNames(infrastructure.requirementsFromManifests(selected)).join(', ')}`
    );

    if (!noPrepare) {
      let packages = databasePackages(selected).join(', ');
      commands.say(`prepare: turbo run control:db:generate (${packages})`);
      commands.say(`prepare: turbo run control:db:push (${packages})`);
      commands.say('prepare: bun run build');
    }

    for (let loaded of selected) {
      let filter = loaded.manifest.package?.name ?? loaded.path;

      for (let script of loaded.manifest.prepare)
        commands.say(`prepare [${filter}]: turbo run ${script} --filter=${filter}`);

      for (let [name, run] of Object.entries(loaded.manifest.run).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0
      ))
        commands.say(`dev [${loaded.directory}:${name}]: ${run.command}`);
    }
    commands.say(`would generate ${packages.length} Turbo mirror package(s)`);

    return;
  }

  let managed = !!process.env.CONTROL_WORKSPACE_ID?.trim();
  if (managed && !noDocker) commands.say('Using workspace-managed development services');

  let projects: docker.ComposeProject[] = [];

  try {
    if (!noDocker && !managed) {
      commands.say('Starting development services');
      projects = await docker.start(project.root, selected, env);
      commands.say('Development services ready');
    }

    await prepareSelected(project, selected, env, noPrepare);

    let packages = turbo.plan(selected, project.root, env);
    if (!packages.length) throw new Error('selected manifests contain no run commands');

    let generated = join(project.root, '.control/dev/turbo');
    turbo.generate(generated, packages);
    commands.say(`Prepared ${packages.length} run command(s)`);

    let data = await workspace.metadata(project);
    await proxy.ensure(project, data, proxy.publicPorts(manifests, project));

    let unregister = await proxy.register(project, data, selected);
    if (proxy.publicPorts(selected, project).has(proxy.mailPort))
      commands.say(`Mail inbox: http://${data.hostname}:${proxy.mailPort}`);
    let interactive = !!(process.stdin.isTTY && process.stdout.isTTY);
    let args = [
      'run',
      'dev',
      `--ui=${interactive ? 'tui' : 'stream'}`,
      '--env-mode=loose',
      '--continue=always',
      `--concurrency=${packages.length + 1}`,
      ...turbo.filters(packages)
    ];
    let [program, commandArgs] = turbo.command(project.root, args);

    let result: unknown;

    try {
      await clearServicePorts(
        selected
          .filter(({ manifest }) => Object.keys(manifest.run).length)
          .flatMap(({ manifest }) =>
            Object.values(manifest.endpoints).map(
              endpoint => endpoint.bind_port ?? endpoint.port
            )
          ),
        project.root,
        commands.say
      );
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
