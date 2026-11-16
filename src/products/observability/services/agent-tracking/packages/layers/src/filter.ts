// A slice matches when it matches any listed value. `modelRaws` matches the raw whatever it
// resolved to, so a slice still matches after its rebuild resolved it.
export type RebuildFilter = {
  modelIds?: string[];
  modelRaws?: string[];
  vendorIds?: string[];
  clientFamilies?: string[];
};

// `to: null` runs up to when the organization's run is planned, which also covers sessions that
// settled against the old knowledge while the new version was still propagating.
export type RebuildImpact = { filter: RebuildFilter | null; from: string; to: string | null };

let rebuildFilterKeys = [
  'modelIds',
  'modelRaws',
  'vendorIds',
  'clientFamilies'
] as const satisfies (keyof RebuildFilter)[];

export let normalizeRebuildFilter = (filter: RebuildFilter): RebuildFilter => {
  let normalized: RebuildFilter = {};

  for (let key of rebuildFilterKeys) {
    let values = [...new Set(filter[key] ?? [])].sort();
    if (values.length) normalized[key] = values;
  }

  return normalized;
};

export let isEmptyRebuildFilter = (filter: RebuildFilter) =>
  rebuildFilterKeys.every(key => !filter[key]?.length);

// `null` matches every slice, so it absorbs any filter it is merged with.
export let mergeRebuildFilters = (
  a: RebuildFilter | null,
  b: RebuildFilter | null
): RebuildFilter | null => {
  if (!a || !b) return null;

  let merged: RebuildFilter = {};
  for (let key of rebuildFilterKeys) merged[key] = [...(a[key] ?? []), ...(b[key] ?? [])];

  return normalizeRebuildFilter(merged);
};

export let rebuildFilterSize = (filter: RebuildFilter | null) =>
  filter ? rebuildFilterKeys.reduce((sum, key) => sum + (filter[key]?.length ?? 0), 0) : 0;
