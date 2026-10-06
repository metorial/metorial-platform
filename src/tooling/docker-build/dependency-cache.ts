import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

let [command, dockerfile, ...tasks] = process.argv.slice(2);
dockerfile = dockerfile ? relative(process.cwd(), resolve(dockerfile)) : '';
let metadataOnly = process.env.DOCKER_BUILD_METADATA_ONLY === 'true';
let cacheDirectory = process.env.DOCKER_BUILD_CACHE_DIRECTORY || resolve(process.env.RUNNER_TEMP ?? '/tmp', 'docker-dependencies');
let enterprise = existsSync('oss/package.json');
let tooling = enterprise ? 'oss/src/tooling/docker-build' : 'src/tooling/docker-build';
let tracked = Bun.spawnSync(['git', 'ls-files', '--recurse-submodules', '-z']);
if (tracked.exitCode) throw new Error(tracked.stderr.toString());
let files = tracked.stdout.toString().split('\0').filter(path => path && existsSync(path)).sort();
let recipePath = join(cacheDirectory, 'recipe.json');

if (command === 'fingerprint') {
  let lifecycleDirectories = files.filter(path => path.endsWith('/package.json')).filter(path => {
    let manifest = JSON.parse(readFileSync(path, 'utf8'));
    return ['preinstall', 'install', 'postinstall', 'prepare'].some(name => manifest.scripts?.[name]);
  }).map(dirname).filter(path => path !== '.' && path !== 'oss');
  let inputs = files.filter(path =>
    /(^|\/)(package\.json|bun\.lockb?|bunfig\.toml|turbo\.json|\.npmrc|\.gitignore|\.dockerignore)$/.test(path) ||
    path.startsWith(tooling + '/') || path.startsWith(tooling.replace('docker-build', 'warp-cache') + '/') ||
    (metadataOnly && /(^|\/)src\/origin\/apps\/code-bucket\//.test(path)) ||
    path.startsWith('.github/actions/') || path.startsWith('.github/workflows/') || /(^|\/)(tsconfig[^/]*\.json|prisma\.config\.ts)$/.test(path) ||
    lifecycleDirectories.some(directory => path.startsWith(directory + '/'))
  );
  let stages = new Set<string>(['scratch']);
  let bases: string[] = [];
  for (let match of (metadataOnly ? '' : readFileSync(dockerfile, 'utf8')).matchAll(/^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/gim)) {
    if (!stages.has(match[1].toLowerCase())) {
      let result = Bun.spawnSync(['docker', 'buildx', 'imagetools', 'inspect', match[1], '--format', '{{.Manifest.Digest}}']);
      if (result.exitCode) throw new Error(result.stderr.toString());
      bases.push(match[1] + '@' + result.stdout.toString().trim());
    }
    if (match[2]) stages.add(match[2].toLowerCase());
  }
  let hash = createHash('sha256');
  hash.update(JSON.stringify({ version: 1, metadataOnly, tasks, dockerfile, bases, platform: process.platform, arch: process.arch, bun: Bun.version }));
  for (let path of [...new Set([...inputs, dockerfile])].sort()) {
    hash.update(path + '\0');
    hash.update(readFileSync(path));
  }
  console.log(`key=${metadataOnly ? 'image-metadata' : 'docker-dependencies'}-v1-${hash.digest('hex')}`);
  console.log(`cache=${cacheDirectory}`);
} else if (command === 'capture') {
  rmSync(join(cacheDirectory, 'json'), { recursive: true, force: true });
  mkdirSync(cacheDirectory, { recursive: true });
  cpSync('out/json', join(cacheDirectory, 'json'), { recursive: true });
  let fullFiles = [...new Bun.Glob('**/*').scanSync({ cwd: 'out/full', onlyFiles: true, dot: true })];
  let directories = fullFiles.filter(path => path.endsWith('/package.json') && existsSync(join(cacheDirectory, 'json', path))).map(dirname);
  let extras = fullFiles.filter(path => !directories.some(directory => path.startsWith(directory + '/')));
  let generated = fullFiles.filter(path => /(^|\/)(package|turbo)\.json$/.test(path) && (!existsSync(path) || !readFileSync(path).equals(readFileSync(join('out/full', path)))));
  rmSync(join(cacheDirectory, 'generated'), { recursive: true, force: true });
  for (let path of generated) {
    let target = join(cacheDirectory, 'generated', path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join('out/full', path), target, { dereference: false });
  }
  await Bun.write(recipePath, JSON.stringify({ directories, extras, generated }));
} else if (command === 'restore') {
  let recipe = JSON.parse(readFileSync(recipePath, 'utf8')) as { directories: string[]; extras: string[]; generated: string[] };
  rmSync('out', { recursive: true, force: true });
  cpSync(join(cacheDirectory, 'json'), 'out/json', { recursive: true });
  for (let path of files.filter(path => recipe.extras.includes(path) || recipe.directories.some(directory => path.startsWith(directory + '/')))) {
    let target = join('out/full', path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(path, target, { dereference: false });
  }
  for (let path of recipe.generated) {
    let target = join('out/full', path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(cacheDirectory, 'generated', path), target, { dereference: false });
  }
} else {
  throw new Error(`Unknown dependency cache command: ${command}`);
}
