import { normalizeKey } from './normalize/parseName';
import type { Catalog, Name, NameTarget } from './types';

export * from './types';
export { buildCatalog, type BuildOptions, type BuildResult } from './pipeline/build';
export { emitCatalog } from './pipeline/emit';
export { collectIssues, type CatalogIssue, type IssueKind } from './pipeline/issues';
export {
  loadOverrides,
  readOverrideFiles,
  writeOverrideFiles,
  type OfferingDecision,
  type OverrideFiles
} from './overrides';
export { parseName, normalizeKey } from './normalize/parseName';

// Looks a raw model name up in a published catalog: an exact namespaced id first, then the same
// raw string under any namespace, then a normalized key, as long as all matches agree.
export let createNameLookup = (catalog: Pick<Catalog, 'names'>) => {
  let byId = new Map(catalog.names.map(name => [name.id, name]));
  let byRaw = new Map<string, Name[]>();
  let byKey = new Map<string, Name[]>();

  for (let name of catalog.names) {
    if (name.target.kind === 'unresolved') continue;
    byRaw.set(name.raw, [...(byRaw.get(name.raw) ?? []), name]);
    byKey.set(name.key, [...(byKey.get(name.key) ?? []), name]);
  }

  let agreed = (names: Name[] | undefined): NameTarget | null => {
    if (!names?.length) return null;

    let targets = new Set(names.map(name => JSON.stringify(name.target)));
    return targets.size === 1 ? names[0]!.target : null;
  };

  return (raw: string, namespace?: string): NameTarget | null => {
    if (namespace) {
      let exact = byId.get(`${namespace}:${raw}`);
      if (exact && exact.target.kind !== 'unresolved') return exact.target;
    }

    return agreed(byRaw.get(raw)) ?? agreed(byKey.get(normalizeKey(raw)));
  };
};
