import {
  createEntityFilter,
  type TableFilter,
  type TableFilterEntityOption,
  type TableFilterEntityOptions,
  type TableFilterPayloadMap
} from '@metorial/ui-product';
import { useMemo } from 'react';

export type EntityFilterOptions = {
  id?: string;
  fields?: string[];
  label?: string;
  pinned?: boolean;
};

export type EntityListQuery = {
  search?: string;
  ids?: string[];
  limit: number;
  filters: TableFilterPayloadMap;
};

export type EntityList = { items: TableFilterEntityOption[]; isLoading: boolean };

type ListResult<T> = {
  data?: { items: T[] } | T[] | null;
  isLoading: boolean;
};

export type EntityDefinition = {
  id: string;
  label: string;
  noun: string;
  mode: 'search' | 'recent';
  useList: (query: EntityListQuery | null) => EntityList;
  blockedMessage?: (filters: TableFilterPayloadMap) => string | undefined;
};

let RECENT_LIMIT = 100;
let SEARCH_LIMIT = 50;

let looksLikeId = (value: string) => /^[a-z][a-z0-9]*_[A-Za-z0-9]{6,}$/.test(value);

export let toEntityList = <T>(
  result: ListResult<T>,
  toOption: (item: T) => TableFilterEntityOption
): EntityList => {
  let items = Array.isArray(result.data) ? result.data : (result.data?.items ?? []);
  return { items: items.map(toOption), isLoading: result.isLoading };
};

export let useEntityList = <T>(
  result: ListResult<T>,
  toOption: (item: T) => TableFilterEntityOption
) => {
  let data = result.data;
  return useMemo(
    () => toEntityList({ data, isLoading: result.isLoading }, toOption),
    [data, result.isLoading]
  );
};

export let getFilterIds = (filters: TableFilterPayloadMap, field: string): string[] => {
  let value = filters[field];
  if (typeof value == 'string') return [value];
  if (value && typeof value == 'object' && !(value instanceof Date) && value.in) {
    return (value.in as unknown[]).filter((id): id is string => typeof id == 'string');
  }
  return [];
};

export let shortId = (id: string) => (id.length > 16 ? `${id.slice(0, 16)}…` : id);

export let formatCreated = (date: Date | string) =>
  new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

let uniqueById = (items: TableFilterEntityOption[]) => {
  let seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

let emptyMessage = (def: EntityDefinition, search: string) =>
  search ? `No matching ${def.noun} found.` : `No ${def.noun} available.`;

let createSearchOptions =
  (def: EntityDefinition) =>
  ({ search, filters }: { search: string; filters: TableFilterPayloadMap }) => {
    let query = search.trim();
    let blocked = def.blockedMessage?.(filters);
    let list = def.useList(
      blocked ? null : { search: query || undefined, limit: SEARCH_LIMIT, filters }
    );

    return {
      items: list.items,
      isLoading: list.isLoading,
      empty: blocked ?? emptyMessage(def, query)
    } satisfies TableFilterEntityOptions;
  };

let createRecentOptions =
  (def: EntityDefinition) =>
  ({ search, filters }: { search: string; filters: TableFilterPayloadMap }) => {
    let query = search.trim();
    let blocked = def.blockedMessage?.(filters);
    let recent = def.useList(blocked ? null : { limit: RECENT_LIMIT, filters });
    let exact = def.useList(
      !blocked && looksLikeId(query) ? { ids: [query], limit: 1, filters } : null
    );

    let items = useMemo(
      () => uniqueById([...exact.items, ...recent.items]),
      [exact.items, recent.items]
    );

    return {
      items,
      isLoading: recent.isLoading || exact.isLoading,
      empty: blocked ?? emptyMessage(def, query)
    } satisfies TableFilterEntityOptions;
  };

let noFilters: TableFilterPayloadMap = {};

export let defineEntityFilter =
  (def: EntityDefinition) =>
  (opts: EntityFilterOptions = {}): TableFilter<{ id: string }> =>
    createEntityFilter({
      id: opts.id ?? def.id,
      fields: opts.fields,
      label: opts.label ?? def.label,
      pinned: opts.pinned,
      remoteSearch: def.mode == 'search',
      searchPlaceholder:
        def.mode == 'search' ? `Search ${def.noun}...` : `Filter ${def.noun}...`,
      useSearch: def.mode == 'search' ? createSearchOptions(def) : createRecentOptions(def),
      useByIds: ids =>
        def.useList(ids.length ? { ids, limit: ids.length, filters: noFilters } : null).items
    });
