import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Edition } from '../edition';
import {
  findOwningPackage,
  isPackageAllowed,
  resolveWorkspaceEntry,
  type Workspace
} from './workspace';

export type Violation = {
  kind: 'graph' | 'bundle' | 'denied-package';
  message: string;
};

export let verifyPackageGraph = (
  workspace: Workspace,
  edition: Edition,
  entries: string[]
): Violation[] => {
  let violations: Violation[] = [];
  let parents = new Map<string, string | null>();
  let queue: string[] = [];

  for (let entry of entries) {
    let pkg = resolveWorkspaceEntry(workspace, entry);

    parents.set(pkg.name, null);
    queue.push(pkg.name);
  }

  while (queue.length) {
    let name = queue.shift()!;
    let pkg = workspace.packages.get(name)!;

    if (!isPackageAllowed(pkg, edition)) {
      let chain: string[] = [];

      for (let step: string | null = name; step; step = parents.get(step) ?? null) {
        chain.unshift(step);
      }

      violations.push({
        kind: 'graph',
        message: `${name} is not available in the ${edition} edition but is reachable: ${chain.join(' -> ')}`
      });

      continue;
    }

    for (let dependency of pkg.dependencies) {
      if (!workspace.packages.has(dependency) || parents.has(dependency)) continue;

      parents.set(dependency, name);
      queue.push(dependency);
    }
  }

  return violations;
};

let listSourceMaps = async (path: string): Promise<string[]> => {
  if (path.endsWith('.map')) return [path];

  let results: string[] = [];

  for (let entry of await readdir(path, { withFileTypes: true })) {
    let child = join(path, entry.name);

    if (entry.isDirectory()) results.push(...(await listSourceMaps(child)));
    else if (entry.name.endsWith('.map')) results.push(child);
  }

  return results;
};

let nodeModulesPackage = (sourcePath: string) => {
  let marker = '/node_modules/';
  let index = sourcePath.lastIndexOf(marker);
  if (index < 0) return null;

  let parts = sourcePath.slice(index + marker.length).split('/');

  return parts[0]!.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]!;
};

export let verifySourceMaps = async (
  workspace: Workspace,
  edition: Edition,
  paths: string[],
  denyPackages: string[] = []
): Promise<Violation[]> => {
  let violations: Violation[] = [];
  let seen = new Set<string>();

  for (let path of paths) {
    for (let mapPath of await listSourceMaps(resolve(path))) {
      let map = JSON.parse(await readFile(mapPath, 'utf8'));
      let root = resolve(dirname(mapPath), map.sourceRoot ?? '');

      for (let source of (map.sources ?? []) as string[]) {
        let absolute = resolve(root, source.replace(/^webpack:\/\/[^/]*\//, ''));
        if (seen.has(absolute)) continue;

        seen.add(absolute);

        let owner = findOwningPackage(workspace, absolute);

        if (owner && !isPackageAllowed(owner, edition)) {
          violations.push({
            kind: 'bundle',
            message: `${owner.name} is not available in the ${edition} edition but ${absolute} was bundled`
          });
        }

        let external = nodeModulesPackage(absolute);

        if (external && denyPackages.includes(external)) {
          violations.push({
            kind: 'denied-package',
            message: `${external} must not be part of the ${edition} edition but ${absolute} was bundled`
          });
        }
      }
    }
  }

  return violations;
};
