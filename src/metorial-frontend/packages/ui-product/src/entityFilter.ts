import { useEffect, useMemo } from 'react';
import {
  getCachedFilterLabel,
  hasCachedFilterLabel,
  rememberFilterLabels,
  type TableFilter,
  type TableFilterEntityOption,
  type TableFilterEntityOptions,
  type TableFilterPayloadMap
} from './tableFilter';

export type EntityFilterSource = {
  useSearch: (args: {
    search: string;
    filters: TableFilterPayloadMap;
  }) => TableFilterEntityOptions;
  useByIds?: (ids: string[]) => TableFilterEntityOption[];
  remoteSearch?: boolean;
  searchPlaceholder?: string;
};

export type EntityFilterInput = EntityFilterSource & {
  id: string;
  label: string;
  fields?: string[];
  pinned?: boolean;
  description?: `Filter by ${string}`;
};

export let createEntityFilter = (d: EntityFilterInput): TableFilter<{ id: string }> => {
  let useByIds = d.useByIds;

  return {
    id: d.id,
    fields: d.fields ?? [d.id],
    label: d.label,
    description: d.description ?? `Filter by ${d.label.toLowerCase()}`,
    pinned: d.pinned,
    type: 'entity',
    remoteSearch: d.remoteSearch,
    searchPlaceholder: d.searchPlaceholder,
    useOptions: d.useSearch,
    useValueLabels: useByIds
      ? ids => {
          let items = useByIds(ids);
          return useMemo(
            () => Object.fromEntries(items.map(item => [item.id, item.label])),
            [items]
          );
        }
      : undefined
  };
};

let noValueLabels = (): Record<string, string> => ({});

export let useEntityFilterLabels = (filter: TableFilter<any>, ids: string[]) => {
  let useValueLabels = (filter.type == 'entity' && filter.useValueLabels) || noValueLabels;
  let idsKey = ids.join(',');

  let missingIds = useMemo(
    () => ids.filter(id => !hasCachedFilterLabel(filter.id, id)),
    [filter.id, idsKey]
  );
  let resolved = useValueLabels(missingIds);

  useEffect(() => {
    let found = missingIds
      .filter(id => resolved[id])
      .map(id => ({ id, label: resolved[id]! }));
    if (found.length) rememberFilterLabels(filter.id, found);
  }, [filter.id, missingIds, resolved]);

  return ids.map(id => resolved[id] ?? getCachedFilterLabel(filter.id, id));
};

export let sortExactMatchesFirst = <T extends TableFilterEntityOption>(
  items: T[],
  search: string
) => {
  let query = search.trim().toLowerCase();
  if (!query) return items;

  let isExact = (item: T) =>
    item.id.toLowerCase() == query || item.slug?.toLowerCase() == query;

  return [...items.filter(isExact), ...items.filter(item => !isExact(item))];
};
