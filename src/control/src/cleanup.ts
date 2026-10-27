import { existsSync, lstatSync, readdirSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { within } from './files';
import type { LoadedManifest } from './types';

export let plan = (root: string, manifests: LoadedManifest[]) => {
  let paths = new Set(
    ['.control/.dev.tmp', '.control/dev', '.control/tmp'].map(path => join(root, path))
  );
  let collect = (directory: string) => {
    let entries;

    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (let entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;

      let path = join(directory, entry.name);
      if (entry.name === '.git') continue;

      if (
        path === join(root, 'oss') &&
        existsSync(join(path, '.git')) &&
        lstatSync(join(path, '.git')).isDirectory()
      )
        continue;

      if (
        ['node_modules', 'dist', '.next', '.cache', '.turbo', 'generated', 'out'].includes(
          entry.name
        )
      )
        paths.add(path);
      else collect(path);
    }
  };
  collect(root);

  for (let loaded of manifests) {
    for (let path of loaded.manifest.cleanup.paths) {
      if (isAbsolute(path) || path.split(/[\\/]/).includes('..')) continue;

      let joined = join(dirname(loaded.path), path);
      if (within(root, joined)) paths.add(joined);
    }
  }

  return [...paths].sort().map(path => ({ path, exists: existsSync(path) }));
};

export let execute = (items: { path: string; exists: boolean }[], dryRun: boolean) => {
  let removed = 0;

  for (let item of items.filter(item => item.exists)) {
    if (dryRun) {
      console.log(`would remove ${item.path}`);
      continue;
    }
    rmSync(item.path, { recursive: true });
    console.log(`removed ${item.path}`);
    removed++;
  }

  return removed;
};
