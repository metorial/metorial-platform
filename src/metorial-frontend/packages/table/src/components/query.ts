import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TableFilter,
  TableFilterState,
  deserializeFromQuery,
  serializeToQuery
} from '../filter';

let emptyFilters: TableFilter<any>[] = [];

let getFilterQueryKeys = (filters: TableFilter<any>[]) => {
  let keys = new Set<string>();

  for (let filter of filters) {
    keys.add(filter.id);

    if (filter.type == 'number' || filter.type == 'date') {
      keys.add(`${filter.id}_gt`);
      keys.add(`${filter.id}_lt`);
      keys.add(`${filter.id}_gte`);
      keys.add(`${filter.id}_lte`);
    }
  }

  return keys;
};

let getManagedQueryString = (searchParams: URLSearchParams, filterKeys: Set<string>) => {
  let managedSearchParams = new URLSearchParams();
  let orderedKeys = ['search', ...[...filterKeys].sort()];

  for (let key of orderedKeys) {
    for (let value of searchParams.getAll(key)) {
      managedSearchParams.append(key, value);
    }
  }

  return managedSearchParams.toString();
};

export let useFilterQuery = ({
  filters,
  filterState: [filterState, setFilterState],
  searchState: [search, setSearch],
  debouncedSearch
}: {
  filters?: TableFilter<any>[];
  filterState: [TableFilterState[], React.Dispatch<React.SetStateAction<TableFilterState[]>>];
  searchState: [string, React.Dispatch<React.SetStateAction<string>>];
  debouncedSearch: string;
}) => {
  let [searchParams, setSearchParams] = useSearchParams();
  let currentFilters = filters ?? emptyFilters;
  let filterKeys = useMemo(() => getFilterQueryKeys(currentFilters), [currentFilters]);

  let latest = useRef({ searchParams, setSearchParams, search, filterState });
  latest.current = { searchParams, setSearchParams, search, filterState };

  let lastSetQueryRef = useRef<string | undefined>(undefined);
  let pendingHydrationRef = useRef<{
    filters?: TableFilterState[];
    search?: string;
  } | null>(null);

  useEffect(() => {
    try {
      let query = new URLSearchParams(searchParams);
      let isOwnWrite = lastSetQueryRef.current == query.toString();
      lastSetQueryRef.current = undefined;
      if (isOwnWrite) return;

      let filterValues = deserializeFromQuery(query, currentFilters);
      let nextSearch = query.get('search') ?? '';

      let filtersChanged =
        serializeToQuery(latest.current.filterState) != serializeToQuery(filterValues);
      let searchChanged = latest.current.search != nextSearch;
      if (!filtersChanged && !searchChanged) return;

      pendingHydrationRef.current = {
        filters: filtersChanged ? filterValues : undefined,
        search: searchChanged ? nextSearch : undefined
      };

      if (filtersChanged) setFilterState(filterValues);
      if (searchChanged) setSearch(nextSearch);
    } catch (e) {
      console.error(e);
    }
  }, [currentFilters, searchParams, setFilterState, setSearch]);

  // Only filter/search state changes may write to the URL, and only once state has caught
  // up with the URL. Otherwise stale state gets written on top of an external navigation,
  // and since setSearchParams navigates relative to this route it pulls the user back here.
  useEffect(() => {
    try {
      let { searchParams, setSearchParams, search } = latest.current;

      let pending = pendingHydrationRef.current;
      if (pending) {
        let filtersPending = pending.filters && pending.filters !== filterState;
        let searchPending = pending.search !== undefined && pending.search !== search;
        if (filtersPending || searchPending) return;
        pendingHydrationRef.current = null;
      }

      let nextSearch =
        search == debouncedSearch ? debouncedSearch : searchParams.get('search');

      let filterQuery = serializeToQuery(filterState);
      let nextSearchParams = new URLSearchParams(searchParams);
      let currentManagedQuery = getManagedQueryString(searchParams, filterKeys);

      for (let key of filterKeys) {
        nextSearchParams.delete(key);
      }

      let nextFilterSearchParams = new URLSearchParams(filterQuery);
      for (let [key, value] of nextFilterSearchParams.entries()) {
        nextSearchParams.append(key, value);
      }

      if (nextSearch) nextSearchParams.set('search', nextSearch);
      else nextSearchParams.delete('search');

      let nextManagedQuery = getManagedQueryString(nextSearchParams, filterKeys);
      if (currentManagedQuery == nextManagedQuery) return;

      nextSearchParams.delete('before');
      nextSearchParams.delete('after');

      lastSetQueryRef.current = nextSearchParams.toString();
      setSearchParams(nextSearchParams, { replace: true });
    } catch (e) {
      console.error(e);
    }
  }, [debouncedSearch, filterKeys, filterState]);
};
