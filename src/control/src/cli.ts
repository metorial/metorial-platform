import { commandHelp } from './help';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ancestors, canonical, packageScripts, within } from './files';
import { detect } from './root';
import * as commands from './process';
import * as turbo from './turbo';
import * as workspace from './workspace';
import * as environment from './environment';
import * as dev from './dev';
import * as docker from './docker';
import * as cleanup from './cleanup';
import * as e2e from './e2e';
import { inventory } from './ci';
import type { ProjectRoot } from './types';

let commandOptions: Record<
  string,
  { flags?: string[]; values?: string[]; min?: number; max?: number }
> = {
  ci: {},
  'ci describe': { flags: ['json'], max: 0 },
  dev: { flags: ['no-docker', 'no-prepare', 'stop-docker', 'dry-run'] },
  prepare: { flags: ['no-docker'] },
  db: {},
  'db generate': {},
  'db push': {},
  env: { flags: ['json'] },
  run: {},
  'test:unit': {},
  'test:e2e': { flags: ['keep', 'plan'], values: ['images', 'workspace', 'concurrency'] },
  cleanup: { flags: ['dry-run', 'docker'] },
  docker: {},
  'docker stop': {},
  workspace: {},
  'workspace create': { flags: ['no-open'], min: 1, max: 1 },
  'workspace list': { max: 0 },
  'workspace remove': { min: 1, max: 1 },
  'workspace start': { flags: ['rebuild', 'no-open'], max: 1 },
  'workspace dev': { max: 1 },
  'workspace shell': { max: 1 },
  'workspace stop': { flags: ['volumes'], max: 1 },
  'workspace status': { max: 1 }
};

export interface Arguments {
  root?: string;
  oss: boolean;
  command: string;
  subcommand?: string;
  positional: string[];
  flags: Set<string>;
  values: Record<string, string>;
  testArgs: string[];
  help: boolean;
  version: boolean;
}

let parseArgumentsUnchecked = (args: string[]): Arguments => {
  let parsed: Arguments = {
    oss: false,
    command: '',
    positional: [],
    flags: new Set(),
    values: {},
    testArgs: [],
    help: false,
    version: false
  };
  let nested = new Set(['ci', 'db', 'docker', 'workspace']);

  for (let index = 0; index < args.length; index++) {
    let argument = args[index]!;
    if (parsed.command === 'run') {
      parsed.positional.push(...args.slice(index));
      break;
    }

    if (argument === '--' && parsed.command === 'test:e2e') {
      parsed.testArgs = args.slice(index + 1);
      break;
    }

    if (argument === '--') {
      parsed.positional.push(...args.slice(index + 1));
      break;
    }

    let [option, ...equal] = argument.split('=');
    let value = equal.length ? equal.join('=') : undefined;
    let takeValue = () => {
      if (value !== undefined) return value;

      let next = args[++index];
      if (next === undefined || next.startsWith('--'))
        throw new Error(`a value is required for ${option}`);

      return next;
    };
    if (option === '--root') {
      parsed.root = takeValue();
      continue;
    }

    if (argument === '--oss') {
      parsed.oss = true;
      continue;
    }

    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }

    if (argument === '--version' || argument === '-V') {
      parsed.version = true;
      continue;
    }

    if (!parsed.command && argument === 'help') {
      let target = parseArgumentsUnchecked([
        ...args.slice(0, index),
        ...args.slice(index + 1),
        '--help'
      ]);
      target.help = true;

      return target;
    }

    if (!parsed.command && !argument.startsWith('-')) {
      parsed.command = argument === 'start' ? 'dev' : argument;

      if (!Object.hasOwn(commandOptions, parsed.command))
        throw new Error(`unrecognized subcommand '${argument}'`);
      continue;
    }

    if (nested.has(parsed.command) && !parsed.subcommand && !argument.startsWith('-')) {
      parsed.subcommand =
        parsed.command === 'workspace' && argument === 'connect' ? 'start' : argument;

      if (!commandOptions[`${parsed.command} ${parsed.subcommand}`])
        throw new Error(`unrecognized subcommand '${argument}'`);
      continue;
    }

    let key = parsed.command + (parsed.subcommand ? ` ${parsed.subcommand}` : '');
    let options = commandOptions[key];
    if (option!.startsWith('-')) {
      let name = option!.replace(/^--/, '');
      if (options?.values?.includes(name)) {
        if (parsed.values[name] !== undefined)
          throw new Error(`the argument '--${name}' cannot be used multiple times`);
        parsed.values[name] = takeValue();
      } else if (options?.flags?.includes(name) && value === undefined) {
        if (parsed.flags.has(name))
          throw new Error(`the argument '--${name}' cannot be used multiple times`);
        parsed.flags.add(name);
      } else throw new Error(`unexpected argument '${argument}' found`);
    } else parsed.positional.push(argument);
  }

  if (parsed.help || parsed.version) return parsed;

  if (!parsed.command) throw new Error('a subcommand is required');

  if (nested.has(parsed.command) && !parsed.subcommand)
    throw new Error(`${parsed.command} requires a subcommand`);

  let options =
    commandOptions[parsed.command + (parsed.subcommand ? ` ${parsed.subcommand}` : '')]!;
  if (
    parsed.positional.length < (options.min ?? 0) ||
    parsed.positional.length > (options.max ?? Infinity)
  )
    throw new Error('unexpected or missing positional arguments');

  if (parsed.values.workspace !== undefined && parsed.values.images === undefined)
    throw new Error('--workspace requires --images');

  if (
    parsed.values.concurrency !== undefined &&
    (!/^\d+$/.test(parsed.values.concurrency) ||
      Number(parsed.values.concurrency) > 0xffffffff)
  )
    throw new Error('invalid value for --concurrency');

  return parsed;
};

export class CliError extends Error {}

export let parseArguments = (args: string[]): Arguments => {
  try {
    return parseArgumentsUnchecked(args);
  } catch (error) {
    throw new CliError(error instanceof Error ? error.message : String(error));
  }
};

export let helpText = (args: Arguments) =>
  commandHelp[args.command + (args.subcommand ? ` ${args.subcommand}` : '')]!;

export let packageDirectory = (project: ProjectRoot, start: string) => {
  for (let directory of ancestors(canonical(start))) {
    if (!within(canonical(project.root), directory)) break;

    if (existsSync(join(directory, 'package.json'))) {
      if ([canonical(project.root), canonical(project.oss)].includes(directory)) break;

      return directory;
    }
  }
  throw new Error('control run must be run from a package; the project root does not count');
};

export let run = async (args = process.argv.slice(2), cwd = process.cwd()) => {
  let parsed = parseArguments(args);
  if (parsed.version) {
    console.log('control 0.1.0');

    return;
  }

  if (parsed.help) {
    console.log(helpText(parsed));

    return;
  }

  let start = parsed.root ?? cwd;
  let project = detect(start);
  if (parsed.oss) project = { kind: 'oss', root: project.oss, oss: project.oss };

  let positional = parsed.positional;
  let flags = parsed.flags;
  switch (parsed.command) {
    case 'ci':
      console.log(JSON.stringify(inventory(project), null, 2));
      return;
    case 'dev':
      await dev.run(
        project,
        positional,
        flags.has('no-docker'),
        flags.has('no-prepare'),
        flags.has('stop-docker'),
        flags.has('dry-run')
      );
      return;
    case 'prepare':
      await dev.runPrepare(project, positional, flags.has('no-docker'));
      return;
    case 'db':
      await dev.runDatabaseTask(project, positional, parsed.subcommand as 'generate' | 'push');
      return;
    case 'env': {
      let written = await environment.writeForProject(project, positional);
      if (flags.has('json')) console.log(JSON.stringify(written, null, 2));
      else {
        for (let path of written) console.log(`wrote ${path}`);
        console.log(`updated ${written.length} environment file(s)`);
      }

      return;
    }
    case 'run': {
      let directory = canonical(start);
      if (statSync(directory).isFile()) directory = dirname(directory);

      let packagePath = packageDirectory(project, directory);
      if (!positional.length) {
        let scripts = Object.keys(packageScripts(packagePath));
        if (!scripts.length) console.log('no package scripts');
        else for (let script of scripts) console.log(`control run ${script}`);
      } else {
        await environment.writeForProject(project, []);

        await commands.run('bun', ['run', ...positional], directory);
      }

      return;
    }
    case 'test:unit': {
      let [program, commandArgs] = turbo.command(
        project.root,
        turbo.runArgs('test', positional, 1)
      );
      await commands.run(program, commandArgs, project.root);

      return;
    }
    case 'test:e2e':
      await e2e.run(project, {
        filters: positional,
        images: parsed.values.images,
        workspace: parsed.values.workspace,
        concurrency:
          parsed.values.concurrency === undefined
            ? undefined
            : Number(parsed.values.concurrency),
        keep: flags.has('keep'),
        planOnly: flags.has('plan'),
        testArgs: parsed.testArgs
      });
      return;
    case 'cleanup': {
      let { manifests, selected, env } = await dev.selection(project, positional, false);
      if (flags.has('docker'))
        await docker.stop(project.root, docker.composeProjects(project.root, selected), env);

      let removed = cleanup.execute(
        cleanup.plan(project.root, manifests),
        flags.has('dry-run')
      );
      if (!flags.has('dry-run')) console.log(`cleaned ${removed} artifact(s)`);

      return;
    }
    case 'docker': {
      let { selected, env } = await dev.selection(project, positional, false);
      await docker.stop(project.root, docker.composeProjects(project.root, selected), env);

      return;
    }
    case 'workspace': {
      let branch = positional[0];
      if (parsed.subcommand === 'create') {
        await workspace.create(project, branch!, !flags.has('no-open'));

        return;
      }

      if (parsed.subcommand === 'remove') {
        await workspace.remove(project, branch!);

        return;
      }

      if (parsed.subcommand === 'list') {
        let entries = await workspace.list(project);
        if (!entries.length) console.log('no workspaces');

        for (let entry of entries)
          console.log(
            [
              entry.branch,
              entry.path,
              ...(entry.id && entry.hostname && entry.runtime
                ? [entry.id, entry.hostname, entry.runtime]
                : [])
            ].join('\t')
          );

        return;
      }

      let target = await workspace.resolve(project, branch);
      let runtime =
        (await workspace.metadata(target)).runtime === 'host'
          ? await import('./workspace-host')
          : await import('./workspace-dev');
      switch (parsed.subcommand) {
        case 'start':
          await runtime.run(target, flags.has('rebuild'), !flags.has('no-open'));
          return;
        case 'dev':
          await runtime.control(target);
          return;
        case 'shell':
          await runtime.shell(target);
          return;
        case 'stop':
          await runtime.stop(target, flags.has('volumes'));
          return;
        case 'status':
          await runtime.status(target);
          return;
      }
    }
  }
};
