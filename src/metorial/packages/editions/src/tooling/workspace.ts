import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { isEdition, type Edition } from '../edition';

export type WorkspacePackage = {
  name: string;
  dir: string;
  editions: Edition[] | null;
  dependencies: string[];
};

export type Workspace = {
  root: string;
  packages: Map<string, WorkspacePackage>;
};

let readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));

let readEditions = (manifest: any): Edition[] | null => {
  let declared = manifest?.metorial?.editions;
  if (!Array.isArray(declared)) return null;

  for (let edition of declared) {
    if (!isEdition(edition))
      throw new Error(`Unknown edition "${edition}" in a package manifest`);
  }

  return declared;
};

export let readWorkspace = async (root: string): Promise<Workspace> => {
  let absoluteRoot = resolve(root);
  let rootManifest = await readJson(join(absoluteRoot, 'package.json'));
  let patterns: string[] = Array.isArray(rootManifest.workspaces)
    ? rootManifest.workspaces
    : (rootManifest.workspaces?.packages ?? []);

  let packages = new Map<string, WorkspacePackage>();

  for (let pattern of patterns) {
    let glob = new Bun.Glob(`${pattern.replace(/\/$/, '')}/package.json`);

    for await (let match of glob.scan({ cwd: absoluteRoot, onlyFiles: true })) {
      if (match.split('/').includes('node_modules')) continue;

      let manifestPath = join(absoluteRoot, match);
      let manifest = await readJson(manifestPath);
      if (!manifest.name) continue;

      packages.set(manifest.name, {
        name: manifest.name,
        dir: dirname(manifestPath),
        editions: readEditions(manifest),
        dependencies: [
          ...Object.keys(manifest.dependencies ?? {}),
          ...Object.keys(manifest.optionalDependencies ?? {})
        ]
      });
    }
  }

  return { root: absoluteRoot, packages };
};

export let resolveWorkspaceEntry = (workspace: Workspace, entry: string) => {
  let byName = workspace.packages.get(entry);
  if (byName) return byName;

  let entryDir = resolve(workspace.root, entry);

  for (let pkg of workspace.packages.values()) {
    if (pkg.dir == entryDir) return pkg;
  }

  if (!existsSync(entryDir))
    throw new Error(`Unknown workspace package or directory: ${entry}`);

  throw new Error(`${entry} is not a workspace package`);
};

export let findOwningPackage = (workspace: Workspace, absolutePath: string) => {
  let best: WorkspacePackage | null = null;

  for (let pkg of workspace.packages.values()) {
    if (!absolutePath.startsWith(pkg.dir + '/')) continue;
    if (!best || pkg.dir.length > best.dir.length) best = pkg;
  }

  return best;
};

export let isPackageAllowed = (pkg: WorkspacePackage, edition: Edition) =>
  !pkg.editions || pkg.editions.includes(edition);
