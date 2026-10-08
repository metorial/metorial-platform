import { installKey } from './install-key';
import { restoreNestedResolutions } from './lockfile';
import { executableTargets } from './targets';
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

let [command, ...tasks] = process.argv.slice(2);
let workspace = resolve(process.env.RUNNER_TEMP ?? '/tmp', 'test-workspace');
let cache = resolve(process.env.RUNNER_TEMP ?? '/tmp', 'test-install');
let output = (name: string, value: string) => {
  console.log(`${name}=${value}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
};

if (command === 'prepare') {
  let started = performance.now();
  let tooling = existsSync('oss/package.json') ? 'oss/src/tooling' : 'src/tooling';
  let metadataEnvironment = { ...process.env };
  for (let name of [
    'TURBO_API',
    'TURBO_TEAM',
    'TURBO_TOKEN',
    'TURBO_REMOTE_CACHE_SIGNATURE_KEY'
  ])
    delete metadataEnvironment[name];
  let dry = Bun.spawnSync(
    ['bunx', 'turbo@2.9.18', 'run', ...tasks, '--dry=json', '--cache=local:,remote:'],
    {
      env: metadataEnvironment,
      stdout: 'pipe',
      stderr: 'inherit'
    }
  );
  if (dry.exitCode) throw new Error(`Test target discovery failed: ${dry.exitCode}`);
  let names = tasks.filter(argument => !argument.startsWith('--'));
  let targets = executableTargets({ names, tasks: JSON.parse(dry.stdout.toString()).tasks });
  if (!targets.length) throw new Error('No executable test or prerequisite tasks selected');
  let selected = [...names, ...targets.map(name => `--filter=${name}`)];
  console.log(`Executable test targets: ${targets.length}`);
  let result = Bun.spawnSync(['bun', `${tooling}/docker-build/prune.ts`, ...selected], {
    stdout: 'inherit',
    stderr: 'inherit'
  });
  if (result.exitCode) throw new Error(`Test pruning failed: ${result.exitCode}`);

  rmSync(workspace, { recursive: true, force: true });
  cpSync('out/full', workspace, { recursive: true });
  await Bun.write(
    join(workspace, 'bun.lock'),
    JSON.stringify(
      restoreNestedResolutions(
        Bun.JSONC.parse(readFileSync('bun.lock', 'utf8')),
        Bun.JSONC.parse(readFileSync('out/json/bun.lock', 'utf8'))
      ),
      null,
      2
    ) + '\n'
  );
  cpSync('.gitignore', join(workspace, '.gitignore'));
  cpSync(dirname(import.meta.path), join(workspace, tooling, 'test-ci'), { recursive: true });
  await Bun.write(join(workspace, '.test-command.json'), JSON.stringify(selected));
  let manifestPath = join(workspace, 'package.json');
  let manifest = await Bun.file(manifestPath).json();
  for (let name of ['preinstall', 'postinstall', 'cleanup-oss'])
    delete manifest.scripts?.[name];
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  let configuration = await Bun.file(join(workspace, 'turbo.json')).json();
  let sharedInputs = new Set<string>(
    Object.values(configuration.tasks).flatMap((task: any) =>
      (task.inputs ?? []).filter(
        (input: unknown) => typeof input === 'string' && input.startsWith('$TURBO_ROOT$/')
      )
    )
  );
  for (let pattern of sharedInputs) {
    for (let path of new Bun.Glob(pattern.slice('$TURBO_ROOT$/'.length)).scanSync({
      onlyFiles: true
    })) {
      mkdirSync(join(workspace, dirname(path)), { recursive: true });
      cpSync(path, join(workspace, path));
    }
  }

  let files = [
    ...new Bun.Glob('**/*').scanSync({ cwd: workspace, dot: true, onlyFiles: true })
  ].sort();
  let manifests = files.filter(
    path => path.endsWith('/package.json') || path === 'package.json'
  );
  let directories = manifests.map(dirname);
  let lifecycleDirectories = manifests
    .filter(path => {
      let value = JSON.parse(readFileSync(join(workspace, path), 'utf8'));
      return ['preinstall', 'install', 'postinstall', 'prepare'].some(
        name => value.scripts?.[name]
      );
    })
    .map(dirname)
    .filter(directory => directory !== '.');
  let key = installKey({
    workspace,
    files,
    lifecycleDirectories,
    runtime: {
      bun: Bun.version,
      node: Bun.spawnSync(['node', '--version']).stdout.toString().trim(),
      os: process.platform,
      arch: process.arch
    }
  });
  await Bun.write(
    join(workspace, '.test-install-paths.json'),
    JSON.stringify(directories.map(directory => join(directory, 'node_modules')))
  );
  output('workspace', workspace);
  output('cache', cache);
  output('key', key);
  console.log(`Test workspace pruning: ${((performance.now() - started) / 1000).toFixed(1)}s`);
} else if (command === 'capture' || command === 'restore') {
  let paths = (await Bun.file(join(workspace, '.test-install-paths.json')).json()) as string[];
  if (command === 'capture') rmSync(cache, { recursive: true, force: true });
  for (let path of paths) {
    let source = join(command === 'capture' ? workspace : cache, path);
    let target = join(command === 'capture' ? cache : workspace, path);
    if (!existsSync(source)) continue;
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true, dereference: false });
  }
} else throw new Error(`Unknown test workspace command: ${command}`);
