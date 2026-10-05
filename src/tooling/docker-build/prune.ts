import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

let turboVersion = '2.9.18';
let outputDirectory = 'out';
let args = process.argv.slice(2);
let enterprise = existsSync('oss/package.json');
let toolingDirectory = enterprise ? 'oss/src/tooling' : 'src/tooling';

let runTurbo = (args: string[], capture = false) => {
  let result = Bun.spawnSync(['bunx', `turbo@${turboVersion}`, ...args], {
    stdout: capture ? 'pipe' : 'inherit',
    stderr: 'inherit'
  });

  if (result.exitCode !== 0) process.exit(result.exitCode);

  return capture ? result.stdout.toString() : '';
};

if (args.includes('--filter=@metorial-subspace/app-worker')) {
  args.push('--filter=@metorial/db', '--filter=@metorial/multi-region', '--filter=@metorial-subspace/db');
}

let graph = JSON.parse(runTurbo(['run', ...args, '--dry=json', '--cache=local:,remote:'], true));
let packages = [...new Set<string>(graph.tasks.map((task: { package: string }) => task.package))]
  .filter(name => name !== '//')
  .sort();

if (!packages.length) throw new Error('No build workspaces selected');

let rootManifest = await Bun.file('package.json').json();

while (true) {
  rmSync(outputDirectory, { recursive: true, force: true });
  runTurbo(['prune', ...packages, '--docker', `--out-dir=${outputDirectory}`]);

  let lockfile = readFileSync(join(outputDirectory, 'json', 'bun.lock'), 'utf8');
  let additionalPackages = new Set<string>();

  // Published dependencies can resolve to workspace overrides outside Turbo's task graph.
  for (let block of lockfile.matchAll(/"(?:dependencies|optionalDependencies|peerDependencies)":\s*(\{[^{}]*\})/g)) {
    for (let dependency of block[1].matchAll(/"([^"\n]+)":\s*"[^"\n]*"/g)) {
      let name = dependency[1];

      if (rootManifest.overrides?.[name]?.startsWith('workspace:') && !packages.includes(name)) {
        additionalPackages.add(name);
      }
    }
  }

  if (!additionalPackages.size) break;

  packages = [...packages, ...additionalPackages].sort();
}

for (let directory of ['json', 'full']) {
  let target = join(outputDirectory, directory);
  cpSync('bunfig.toml', join(target, 'bunfig.toml'));

  if (enterprise) {
    let manifestPath = join(target, 'package.json');
    let manifest = await Bun.file(manifestPath).json();
    delete manifest.scripts.postinstall;
    delete manifest.scripts['cleanup-oss'];
    await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
}

mkdirSync(join(outputDirectory, 'full', toolingDirectory), { recursive: true });
cpSync(join(toolingDirectory, 'warp-cache'), join(outputDirectory, 'full', toolingDirectory, 'warp-cache'), {
  recursive: true
});

let ancestors = new Set<string>();

for (let task of graph.tasks) {
  let directory = task.directory;

  while (directory !== '.') {
    ancestors.add(directory);
    directory = dirname(directory);
  }
}

ancestors.add('.');

for (let directory of ancestors) {
  for (let config of new Bun.Glob('tsconfig*.json').scanSync({ cwd: directory })) {
    let target = join(outputDirectory, 'full', directory);
    mkdirSync(target, { recursive: true });
    cpSync(join(directory, config), join(target, config));
  }
}

let originDirectory = enterprise ? 'oss/src/origin/apps/code-bucket' : 'src/origin/apps/code-bucket';
let originService = enterprise ? 'oss/src/origin/apps/service' : 'src/origin/apps/service';

if (existsSync(join(outputDirectory, 'full', originService))) {
  let target = join(outputDirectory, 'full', originDirectory);
  mkdirSync(target, { recursive: true });

  for (let asset of ['package.json', 'index.ts', 'ts-proto-gen']) {
    cpSync(join(originDirectory, asset), join(target, asset), { recursive: true });
  }
}

console.log(`Pruned build closure: ${packages.length} task workspaces`);
