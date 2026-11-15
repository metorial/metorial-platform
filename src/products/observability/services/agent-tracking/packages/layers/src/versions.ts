export let SUMMARY_VERSION = 4;
export let ATTRIBUTION_VERSION = 1;
export let FACTS_VERSION = 4;

export let rebuildLayers = ['summary', 'attribution', 'facts'] as const;

export type RebuildLayer = (typeof rebuildLayers)[number];

export let currentVersions: Record<RebuildLayer, number> = {
  summary: SUMMARY_VERSION,
  attribution: ATTRIBUTION_VERSION,
  facts: FACTS_VERSION
};

export let normalizeLayers = (layers: readonly string[]): RebuildLayer[] =>
  rebuildLayers.filter(layer => layers.includes(layer));

export let behindLayers = (versions: Partial<Record<RebuildLayer, number>> | undefined) =>
  rebuildLayers.filter(layer => (versions?.[layer] ?? 0) < currentVersions[layer]);

export let manualRebuildReason = 'manual';
export let versionRebuildReason = 'version_upgrade';
export let catalogRebuildReason = 'catalog_change';
export let priceOverrideRebuildReason = 'price_override';
