import { useEffect, useMemo, useState } from 'react';
import type { PaginatedLoaderResult, TableStateProviderResult } from '../types';

export let paginatedState = <Item extends { id: string }>(
  loader: PaginatedLoaderResult<Item>
): TableStateProviderResult<Item> => ({
  isLoading: loader.isLoading,
  error: loader.error,
  hasMoreAfter: loader.data?.pagination.hasMoreAfter ?? false,
  hasMoreBefore: loader.data?.pagination.hasMoreBefore ?? false,
  items: loader.data?.items ?? [],
  loadNext: loader.next,
  loadPrevious: loader.previous
});

let noop = () => {};

export let staticState = <Item extends { id: string }>(
  items: Item[],
  opts: { isLoading?: boolean; error?: TableStateProviderResult<Item>['error'] } = {}
): TableStateProviderResult<Item> => ({
  isLoading: opts.isLoading ?? false,
  error: opts.error,
  hasMoreAfter: false,
  hasMoreBefore: false,
  items,
  loadNext: noop,
  loadPrevious: noop
});

export type ItemsSourceOptions<Item> = {
  pageSize?: number;
  searchFields?: (keyof Item & string)[] | ((row: Item) => (string | null | undefined)[]);
};

let matchesSearch = <Item>(
  row: Item,
  search: string,
  fields: ItemsSourceOptions<Item>['searchFields']
) => {
  if (!fields) return true;

  let values =
    typeof fields == 'function'
      ? fields(row)
      : fields.map(field => (row as any)?.[field] as string | null | undefined);

  let needle = search.toLowerCase();
  return values.some(value => value?.toString().toLowerCase().includes(needle));
};

export let useClientItemsState = <Item extends { id: string }>(
  source: {
    items: Item[];
    isLoading?: boolean;
    error?: TableStateProviderResult<Item>['error'];
  },
  search: string | undefined,
  opts: ItemsSourceOptions<Item>
): TableStateProviderResult<Item> => {
  let [page, setPage] = useState(0);

  let filtered = useMemo(
    () =>
      search
        ? source.items.filter(row => matchesSearch(row, search!, opts.searchFields))
        : source.items,
    [source.items, search, opts.searchFields]
  );

  useEffect(() => setPage(0), [search]);

  let pageSize = opts.pageSize;
  if (!pageSize) return staticState(filtered, source);

  let start = page * pageSize;
  let end = start + pageSize;

  return {
    isLoading: source.isLoading ?? false,
    error: source.error,
    items: filtered.slice(start, end),
    hasMoreBefore: page > 0,
    hasMoreAfter: end < filtered.length,
    loadNext: () => setPage(p => p + 1),
    loadPrevious: () => setPage(p => Math.max(0, p - 1))
  };
};

export let withDefaults = <Defaults extends object, Values extends object>(
  defaults: Defaults | undefined,
  values: Values
): Defaults & Values => {
  let result: any = { ...defaults };

  for (let [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length == 0) continue;
    result[key] = value;
  }

  return result;
};
