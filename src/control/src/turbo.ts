import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { atomicWrite, sortedEntries, writeJson } from './files';
import { allForManifest, resolveEnvironment, writeDotenv } from './environment';
import type { Environment, LoadedManifest } from './types';

export interface TurboPackage {
  name: string;
  directory: string;
  cwd: string;
  command: string;
  environment: Environment;
  dependencies: string[];
}

export let sanitize = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');

export let turboPackageName = (packageName: string, runName: string) => {
  let name = sanitize(packageName).replace(/^metorial-/, '');
  let run = sanitize(runName);

  return !run || run === 'dev' ? name : sanitize(`${name}-${run}`);
};

export let plan = (
  manifests: LoadedManifest[],
  root: string,
  rootEnvironment: Environment
): TurboPackage[] => {
  let packages: TurboPackage[] = [];
  let names = new Set<string>();

  for (let loaded of manifests) {
    let packageName = loaded.manifest.package?.name ?? 'root';

    for (let [runName, run] of sortedEntries(loaded.manifest.run)) {
      let name = turboPackageName(packageName, runName);
      if (names.has(name))
        throw new Error(`duplicate generated Turbo package name ${JSON.stringify(name)}`);
      names.add(name);
      packages.push({
        name,
        directory: join('packages', name),
        cwd: resolve(dirname(loaded.path) || root, run.cwd ?? '.'),
        command: run.command,
        environment: {
          ...allForManifest(loaded, rootEnvironment),
          ...resolveEnvironment(run.env, rootEnvironment)
        },
        dependencies: run.depends_on.map(dependency =>
          turboPackageName(packageName, dependency)
        )
      });
    }
  }

  return packages.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
};

export let generate = (workspace: string, packages: TurboPackage[]) => {
  let staging = join(dirname(workspace), '.dev.tmp');
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(join(staging, 'packages'), { recursive: true });
  writeJson(join(staging, 'package.json'), {
    name: '@metorial/control-dev',
    private: true,
    packageManager: 'bun@1.2.15',
    workspaces: ['packages/*']
  });

  writeJson(join(staging, 'turbo.json'), {
    $schema: 'https://turbo.build/schema.json',
    tasks: { dev: { cache: false, persistent: true } }
  });

  let workspaces: Record<string, unknown> = { '': { name: '@metorial/control-dev' } };

  for (let item of packages) {
    let directory = join(staging, item.directory);
    mkdirSync(directory, { recursive: true });

    let dependencies = Object.fromEntries(item.dependencies.map(name => [name, '*']));
    writeJson(join(directory, 'package.json'), {
      name: item.name,
      private: true,
      scripts: { dev: 'bun --env-file=.env ./run.mjs' },
      ...(item.dependencies.length ? { dependencies } : {})
    });
    workspaces[item.directory] = {
      name: item.name,
      ...(item.dependencies.length
        ? {
            dependencies: Object.fromEntries(
              item.dependencies.map(name => [name, 'workspace:*'])
            )
          }
        : {})
    };
    writeDotenv(join(directory, '.env'), item.environment);

    atomicWrite(
      join(directory, 'run.mjs'),
      `let cwd = ${JSON.stringify(item.cwd)};\nlet command = ${JSON.stringify(item.command)};\nlet cmd = process.platform === 'win32'\n  ? ['cmd.exe', '/D', '/S', '/C', command]\n  : ['/bin/sh', '-eu', '-c', command];\nlet child = Bun.spawn({ cmd, cwd, env: process.env, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });\nprocess.exit(await child.exited);\n`
    );
  }
  writeJson(join(staging, 'bun.lock'), { lockfileVersion: 1, workspaces, packages: {} });
  rmSync(workspace, { recursive: true, force: true });
  renameSync(staging, workspace);
};

export let filters = (packages: TurboPackage[]) =>
  [...new Set(packages.map(item => item.name))].sort().flatMap(name => ['--filter', name]);

export let command = (root: string, args: string[]): [string, string[]] =>
  existsSync(join(root, 'node_modules/.bin/turbo'))
    ? [join(root, 'node_modules/.bin/turbo'), args]
    : ['bun', ['x', 'turbo', ...args]];

export let runArgs = (task: string, filters: string[], concurrency?: number) => [
  'run',
  task,
  '--ui=stream',
  ...(concurrency !== undefined ? [`--concurrency=${concurrency}`] : []),
  ...filters.flatMap(filter => ['--filter', filter])
];
