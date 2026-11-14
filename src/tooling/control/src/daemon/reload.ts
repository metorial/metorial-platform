import { existsSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { sortedEntries } from '../files';
import type { TurboPackage } from '../turbo';
import type { LoadedManifest } from '../types';

export let definitionSources = join(
  import.meta.dir,
  '../../../../metorial/packages/control/src'
);

export interface PackageChanges {
  added: TurboPackage[];
  changed: TurboPackage[];
  removed: string[];
}

export let fingerprint = (pkg: TurboPackage) =>
  JSON.stringify([
    pkg.command,
    pkg.cwd,
    sortedEntries(pkg.environment),
    [...pkg.dependencies].sort()
  ]);

export let diffPackages = (
  current: Map<string, TurboPackage>,
  next: TurboPackage[]
): PackageChanges => {
  let names = new Set(next.map(item => item.name));

  return {
    added: next.filter(item => !current.has(item.name)),
    changed: next.filter(item => {
      let existing = current.get(item.name);

      return existing !== undefined && fingerprint(existing) !== fingerprint(item);
    }),
    removed: [...current.keys()].filter(name => !names.has(name))
  };
};

export let routeKey = (selected: LoadedManifest[]) =>
  JSON.stringify(selected.map(loaded => [loaded.path, loaded.manifest.endpoints]));

export let infrastructureKey = (selected: LoadedManifest[]) =>
  JSON.stringify(
    selected.map(loaded => [
      loaded.path,
      {
        ...loaded.manifest,
        run: undefined,
        env: undefined,
        endpoints: undefined,
        dependency_endpoints: undefined
      }
    ])
  );

export let watchDefinitions = (
  manifests: LoadedManifest[],
  onChange: (file: string) => void,
  delay = 300
) => {
  let directories = [
    ...new Set([...manifests.map(loaded => dirname(loaded.path)), definitionSources])
  ].filter(existsSync);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest = '';

  let watchers = directories.flatMap(directory => {
    try {
      return [
        watch(directory, { recursive: true }, (_event, name) => {
          if (!name || !/\.(ts|json)$/.test(name.toString())) return;

          latest = join(directory, name.toString());
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            timer = undefined;
            onChange(latest);
          }, delay);
        })
      ];
    } catch {
      return [];
    }
  });

  return () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    for (let watcher of watchers) watcher.close();
  };
};
