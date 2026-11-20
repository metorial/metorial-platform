// Builds the node_modules of a bundled service image from the bundle manifests its build wrote
// (@metorial/editions bundleManifest.ts):
//
//   - packages the bundle imports at runtime are copied whole, with their installed dependencies
//   - packages compiled into the bundle keep only their package.json, so image scanners (Trivy,
//     Grype, Docker Scout, ...) still see the code the image ships
//   - everything else in the install is left out
//
//   bun runtime-modules.ts --node-modules /app/node_modules --out /out/node_modules \
//     --manifests <dir> [--manifests <dir> ...]
//
// Manifests are found in bundle-manifest/ folders below each --manifests directory and removed
// afterwards so they are not shipped. The first --manifests directory must contain at least one.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync
} from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

let manifestDirectoryName = 'bundle-manifest';

type BundleManifest = { version: 1; inputs: string[]; externals: string[] };

type PackageManifest = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

export type RuntimeModulesResult = {
  bundled: string[];
  runtime: string[];
  unresolved: string[];
};

let builtins = new Set(builtinModules);

let readJson = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;

let isBareSpecifier = (specifier: string) =>
  !specifier.startsWith('.') &&
  !specifier.startsWith('/') &&
  !specifier.startsWith('node:') &&
  !/^[a-z]+:/i.test(specifier) &&
  specifier !== 'bun';

export let packageNameOf = (specifier: string) => {
  let parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!;
};

// The package directory is the one directly after the last node_modules segment, which skips
// nested package.json files that only set "type" or "exports" for a subfolder.
export let packageRootOf = (file: string) => {
  let parts = file.split(sep);
  let index = parts.lastIndexOf('node_modules');
  if (index < 0 || index + 1 >= parts.length) return undefined;

  let length = parts[index + 1]!.startsWith('@') ? 3 : 2;
  if (index + length > parts.length) return undefined;

  return parts.slice(0, index + length).join(sep);
};

let findManifests = (directory: string): string[] => {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    let path = join(directory, entry.name);
    if (!entry.isDirectory() || entry.name === 'node_modules') return [];
    if (entry.name !== manifestDirectoryName) return findManifests(path);

    return readdirSync(path)
      .filter(name => name.endsWith('.json'))
      .map(name => join(path, name));
  });
};

let readManifest = (path: string) => {
  let manifest = readJson<BundleManifest>(path);
  if (
    manifest.version !== 1 ||
    !Array.isArray(manifest.inputs) ||
    !Array.isArray(manifest.externals)
  )
    throw new Error(`${path} is not a version 1 bundle manifest`);

  return manifest;
};

let resolveDependency = (from: string, name: string, nodeModules: string) => {
  let directory = from;

  while (true) {
    let candidate = join(directory, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (directory === dirname(nodeModules) || directory === dirname(directory))
      return undefined;
    directory = dirname(directory);
  }
};

// Packages a workspace installed in its own node_modules keep their path below .workspaces/, which
// scanners still recognise and Node never resolves.
let manifestPath = (nodeModules: string, directory: string) =>
  directory.startsWith(nodeModules + sep)
    ? relative(nodeModules, directory)
    : join('.workspaces', relative(dirname(nodeModules), directory));

let dependencyNames = (manifest: PackageManifest) =>
  Object.keys({
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies
  });

export let buildRuntimeModules = (options: {
  nodeModules: string;
  out: string;
  manifestDirectories: string[];
}): RuntimeModulesResult => {
  let nodeModules = realpathSync(options.nodeModules);
  let [primary, ...others] = options.manifestDirectories.map(directory => resolve(directory));
  if (!primary) throw new Error('At least one --manifests directory is required');

  let primaryManifests = findManifests(primary);
  if (!primaryManifests.length)
    throw new Error(
      `No ${manifestDirectoryName}/*.json below ${primary}: build the bundle with --bundle-manifest`
    );

  let manifests = [...primaryManifests, ...others.flatMap(findManifests)];
  let bundled = new Set<string>();
  let externals = new Set<string>();
  let missing = new Set<string>();

  for (let path of manifests) {
    let manifest = readManifest(path);

    for (let input of manifest.inputs) {
      let root = packageRootOf(resolve(dirname(path), input));
      if (!root) continue;

      if (!existsSync(join(root, 'package.json'))) missing.add(root);
      else bundled.add(realpathSync(root));
    }

    for (let specifier of manifest.externals)
      if (isBareSpecifier(specifier) && !builtins.has(specifier))
        externals.add(packageNameOf(specifier));
  }

  // A stale build cache can restore a bundle built against another install; its inventory would
  // be wrong, so stop instead of shipping it.
  if (missing.size)
    throw new Error(
      `Bundled packages missing from the install:\n  ${[...missing].join('\n  ')}`
    );

  let runtime = new Set<string>();
  let unresolved: string[] = [];
  let queue: string[] = [];

  // At runtime the bundle resolves its imports from the image's top-level node_modules.
  for (let name of externals) {
    let directory = join(nodeModules, name);
    if (existsSync(join(directory, 'package.json'))) queue.push(realpathSync(directory));
    else unresolved.push(name);
  }

  while (queue.length) {
    let directory = queue.pop()!;
    if (runtime.has(directory)) continue;
    runtime.add(directory);

    for (let name of dependencyNames(
      readJson<PackageManifest>(join(directory, 'package.json'))
    )) {
      let dependency = resolveDependency(directory, name, nodeModules);
      if (dependency) queue.push(realpathSync(dependency));
    }
  }

  rmSync(options.out, { recursive: true, force: true });
  mkdirSync(options.out, { recursive: true });

  for (let directory of bundled) {
    if (runtime.has(directory)) continue;

    let target = join(options.out, manifestPath(nodeModules, directory));
    mkdirSync(target, { recursive: true });
    cpSync(join(directory, 'package.json'), join(target, 'package.json'));
  }

  // Parents first, so a nested node_modules copied with its parent is not copied twice.
  let runtimeDirectories = [...runtime].sort();
  for (let directory of runtimeDirectories) {
    let target = join(options.out, relative(nodeModules, directory));
    if (
      existsSync(join(target, 'package.json')) &&
      runtimeDirectories.some(parent => directory.startsWith(parent + sep))
    )
      continue;

    cpSync(directory, target, { recursive: true, dereference: false });
  }

  for (let path of manifests) rmSync(dirname(path), { recursive: true, force: true });

  let names = (directories: Iterable<string>) =>
    [...directories].map(directory => manifestPath(nodeModules, directory)).sort();

  return {
    bundled: names([...bundled].filter(directory => !runtime.has(directory))),
    runtime: names(runtime),
    unresolved: unresolved.sort()
  };
};

if (import.meta.main) {
  let { values } = parseArgs({
    options: {
      'node-modules': { type: 'string' },
      out: { type: 'string' },
      manifests: { type: 'string', multiple: true }
    }
  });

  if (!values['node-modules'] || !values.out || !values.manifests?.length) {
    console.error(
      'Usage: runtime-modules.ts --node-modules <dir> --out <dir> --manifests <dir> [--manifests <dir> ...]'
    );
    process.exit(1);
  }

  let result = buildRuntimeModules({
    nodeModules: values['node-modules'],
    out: values.out,
    manifestDirectories: values.manifests
  });

  console.log(
    `Runtime modules: ${result.runtime.length} packages loaded at runtime, ${result.bundled.length} bundled packages kept as manifests`
  );
  for (let name of result.runtime) console.log(`  runtime  ${name}`);
  if (result.unresolved.length)
    console.log(`Not installed, imported optionally: ${result.unresolved.join(', ')}`);
}
