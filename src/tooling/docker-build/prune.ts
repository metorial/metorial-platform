import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

let turboVersion = '2.9.18';
let outputDirectory = 'out';
let args = process.argv.slice(2);
let enterprise = existsSync('oss/package.json');
let toolingDirectory = enterprise ? 'oss/src/tooling' : 'src/tooling';
let metadataEnvironment = { ...process.env };

for (let name of ['TURBO_API', 'TURBO_TEAM', 'TURBO_TOKEN', 'TURBO_REMOTE_CACHE_SIGNATURE_KEY']) {
  delete metadataEnvironment[name];
}

let runTurbo = (args: string[], capture = false) => {
  let result = Bun.spawnSync(['bunx', `turbo@${turboVersion}`, '--skip-infer', ...args], {
    env: metadataEnvironment,
    stdout: capture ? 'pipe' : 'inherit',
    stderr: 'inherit'
  });

  if (result.exitCode !== 0) throw new Error(`Turbo failed with exit code ${result.exitCode}`);

  return capture ? result.stdout.toString() : '';
};

if (args.includes('--filter=@metorial-subspace/app-worker')) {
  args.push('--filter=@metorial/db', '--filter=@metorial/multi-region', '--filter=@metorial-subspace/db');
}

let filters = args.filter(argument => argument.startsWith('--filter='));
let taskNames = args.filter(argument => !argument.startsWith('--'));
let packages: string[] = [];
let workspaceDirectories = new Map<string, string>();

if (filters.length && filters.every(filter => !/[.*!{}\[\]]/.test(filter.slice('--filter='.length))) &&
  args.every(argument => !argument.startsWith('--') || argument.startsWith('--filter='))) {
  let names = filters.map(filter => filter.slice('--filter='.length));
  let fields = names.map((name, index) =>
    `p${index}: package(name: ${JSON.stringify(name)}) { name path tasks { items { name allDependencies { items { package { name path } } } } } }`
  );
  let response = JSON.parse(runTurbo(['query', `{ ${fields.join(' ')} }`], true));
  if (response.errors?.length) throw new Error(JSON.stringify(response.errors));

  let complete = names.every((name, index) => taskNames.every(taskName =>
    response.data[`p${index}`]?.tasks.items.some((task: { name: string }) => task.name === taskName)
  ));
  if (complete) {
    for (let [index, name] of names.entries()) {
      let workspace = response.data[`p${index}`];
      packages.push(name);
      workspaceDirectories.set(name, workspace.path);

      for (let task of workspace.tasks.items) {
        if (taskNames.includes(task.name)) {
          for (let dependency of task.allDependencies.items) {
            packages.push(dependency.package.name);
            workspaceDirectories.set(dependency.package.name, dependency.package.path);
          }
        }
      }
    }
  }
}

if (!packages.length) {
  let graph = runTurbo(['run', ...args, '--graph', '--cache=local:,remote:'], true);
  packages = [...graph.matchAll(/"\[root\] ([^"#]+)#[^"\n]+"/g)].map(match => match[1]);
}

packages = [...new Set(packages)].filter(name => name !== '//').sort();

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

if (packages.some(name => !workspaceDirectories.has(name))) {
  let workspaces = JSON.parse(runTurbo(['ls', '--output=json'], true)) as {
    packages: { items: { name: string; path: string }[] };
  };
  for (let workspace of workspaces.packages.items) workspaceDirectories.set(workspace.name, workspace.path);
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

for (let name of packages) {
  let directory = workspaceDirectories.get(name);
  if (!directory) throw new Error(`Missing workspace directory for ${name}`);

  while (directory !== '.') {
    ancestors.add(directory);
    directory = dirname(directory);
  }
}

ancestors.add('.');

for (let directory of ancestors) {
  for (let entry of readdirSync(directory, { withFileTypes: true })) {
    if ((!entry.isFile() && !entry.isSymbolicLink()) || !/^(tsconfig.*\.json|prisma\.config\.ts)$/.test(entry.name)) continue;
    let config = entry.name;
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

