import type {
  ConsumerCatalogBoundary,
  ConsumerCatalogPageDirection,
  ConsumerProviderCatalogEntry
} from './types';

export let getCatalogEntryId = (entry: ConsumerProviderCatalogEntry) => {
  return entry.type == 'provider_template' ? entry.providerTemplate.id : entry.magicMcpServer.id;
};

export let getCatalogComparableName = (d: { name?: string | null; fallbackId: string }) => {
  return d.name?.trim() || d.fallbackId;
};

let getCatalogEntryName = (entry: ConsumerProviderCatalogEntry) => {
  return getCatalogComparableName({
    name: entry.type == 'provider_template' ? entry.providerTemplate.name : entry.magicMcpServer.name,
    fallbackId: getCatalogEntryId(entry)
  });
};

export let compareCatalogEntries = (
  left: ConsumerProviderCatalogEntry,
  right: ConsumerProviderCatalogEntry,
  order: 'asc' | 'desc'
) => {
  let nameCompare = getCatalogEntryName(left).localeCompare(getCatalogEntryName(right));
  if (nameCompare != 0) {
    return order == 'asc' ? nameCompare : -nameCompare;
  }

  let idCompare = getCatalogEntryId(left).localeCompare(getCatalogEntryId(right));
  return order == 'asc' ? idCompare : -idCompare;
};

export let getCatalogBoundaryComparisonOperator = (d: {
  direction: ConsumerCatalogPageDirection;
  order: 'asc' | 'desc';
}) => {
  if (d.direction == 'after') {
    return d.order == 'asc' ? 'gt' : 'lt';
  }

  return d.order == 'asc' ? 'lt' : 'gt';
};

export let getReverseCatalogOrder = (order: 'asc' | 'desc') => {
  return order == 'asc' ? 'desc' : 'asc';
};

export let shouldIncludeUnnamedMagicMcpBoundaryId = (d: {
  boundary: ConsumerCatalogBoundary;
  direction: ConsumerCatalogPageDirection;
  order: 'asc' | 'desc';
}) => {
  let comparison = d.boundary.name.localeCompare(d.boundary.id);
  if (d.direction == 'after') {
    return d.order == 'asc' ? comparison > 0 : comparison < 0;
  }

  return d.order == 'asc' ? comparison < 0 : comparison > 0;
};
