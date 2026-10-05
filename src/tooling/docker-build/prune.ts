import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

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

let graph = JSON.parse(runTurbo(['run', ...args, '--dry=json'], true));
let packages = [...new Set<string>(graph.tasks.map((task: { package: string }) => task.package))]
  .filter(name => name !== '//')
  .sort();

if (!packages.length) throw new Error('No build workspaces selected');

runTurbo(['prune', ...packages, '--docker', `--out-dir=${outputDirectory}`]);

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

console.log(`Pruned build closure: ${packages.length} task workspaces`);
