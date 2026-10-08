import { installKey } from './install-key';
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
  let result = Bun.spawnSync(['bun', `${tooling}/docker-build/prune.ts`, ...tasks], {
    stdout: 'inherit',
    stderr: 'inherit'
  });
  if (result.exitCode) throw new Error(`Test pruning failed: ${result.exitCode}`);

  rmSync(workspace, { recursive: true, force: true });
  cpSync('out/full', workspace, { recursive: true });
  cpSync('out/json/bun.lock', join(workspace, 'bun.lock'));
  cpSync('.gitignore', join(workspace, '.gitignore'));
  cpSync(dirname(import.meta.path), join(workspace, tooling, 'test-ci'), { recursive: true });
  let manifestPath = join(workspace, 'package.json');
  let manifest = await Bun.file(manifestPath).json();
  for (let name of ['preinstall', 'postinstall', 'cleanup-oss'])
    delete manifest.scripts?.[name];
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

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
