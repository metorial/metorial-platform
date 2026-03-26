import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TableFilter,
  TableFilterState,
  deserializeFromQuery,
  serializeToQuery
} from '../filter';

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

export let useFilterQuery = ({
  filters,
  filterState: [filterState, setFilterState],
  searchState: [, setSearch],
  debouncedSearch
}: {
  filters?: TableFilter<any>[];
  filterState: [TableFilterState[], React.Dispatch<React.SetStateAction<TableFilterState[]>>];
  searchState: [string, React.Dispatch<React.SetStateAction<string>>];
  debouncedSearch: string;
}) => {
  let [searchParams, setSearchParams] = useSearchParams();
  let currentFilters = filters || [];
  let filterKeys = useMemo(() => getFilterQueryKeys(currentFilters), [currentFilters]);

  let lastSetQueryRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    try {
      let query = new URLSearchParams(searchParams);
      let queryString = query.toString();
      let filterValues = deserializeFromQuery(query, currentFilters);
      let nextSearch = query.get('search') ?? '';

      if (lastSetQueryRef.current == queryString) return;

      setFilterState(filterValues);
      setSearch(current => (current == nextSearch ? current : nextSearch));
    } catch (e) {
      console.error(e);
    }
  }, [currentFilters, searchParams, setFilterState, setSearch]);

  useEffect(() => {
    try {
      let filterQuery = serializeToQuery(filterState);
      let nextSearchParams = new URLSearchParams(searchParams);

      for (let key of filterKeys) {
        nextSearchParams.delete(key);
      }

      let nextFilterSearchParams = new URLSearchParams(filterQuery);
      for (let [key, value] of nextFilterSearchParams.entries()) {
        nextSearchParams.append(key, value);
      }

      if (debouncedSearch) nextSearchParams.set('search', debouncedSearch);
      else nextSearchParams.delete('search');

      nextSearchParams.delete('before');
      nextSearchParams.delete('after');

      let query = nextSearchParams.toString();
      if (searchParams.toString() == query) return;

      lastSetQueryRef.current = query;
      setSearchParams(nextSearchParams, { replace: true });
    } catch (e) {
      console.error(e);
    }
  }, [debouncedSearch, filterKeys, filterState, searchParams, setSearchParams]);
};
