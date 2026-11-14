import {
  getFilterPayload,
  type FilterPayload,
  type TableFilter,
  type TableFilterState
} from '@metorial/filter-bar';
import { useEffect, useMemo, useState } from 'react';
import { useFilterQuery } from '../lib/query';

let noFilters: TableFilter<any>[] = [];

export let useFilterState = (opts: {
  filters?: TableFilter<any>[];
  debounce?: number;
  syncUrl?: boolean;
}) => {
  let filterState = useState([] as TableFilterState[]);
  let [search, setSearch] = useState('');
  let [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    let to = setTimeout(() => setDebouncedSearch(search), opts.debounce ?? 300);
    return () => clearTimeout(to);
  }, [search, opts.debounce]);

  let filters = opts.filters ?? noFilters;

  useFilterQuery({
    filters: opts.syncUrl === false ? noFilters : filters,
    filterState,
    searchState: [search, setSearch],
    debouncedSearch
  });

  let payload: Record<string, FilterPayload> = useMemo(
    () => getFilterPayload(filterState[0]),
    [filterState[0]]
  );

  return {
    filters,
    filterState,
    searchState: [search, setSearch] as const,
    search: debouncedSearch || undefined,
    payload,
    hasActiveFilters: filterState[0].length > 0,
    hasActiveSearch: search.trim().length > 0,
    toolbarProps: {
      filters,
      filterState,
      searchState: [search, setSearch] as const
    }
  };
};
