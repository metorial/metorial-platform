import { useEffect, useMemo, useState } from 'react';
import { sortExactMatchesFirst, useEntityFilterLabels } from '../model/entityFilter';
import { type ListFilter, matchesQuery } from '../model/state';
import {
  rememberFilterLabels,
  type TableFilter,
  type TableFilterPayloadMap
} from '../model/tableFilter';
import type { OptionListItem } from './optionList';

export let useDebouncedValue = <T>(value: T, delay: number) => {
  let [debounced, setDebounced] = useState(value);

  useEffect(() => {
    let timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
};

export type ListFilterOptions = {
  items: OptionListItem[];
  pinnedItems: OptionListItem[];
  isLoading: boolean;
  empty?: string;
};

let matchesOption = (
  option: { id: string; label: string; description?: string; slug?: string },
  query: string
) => {
  let normalized = query.trim().toLowerCase();
  return (
    option.id.toLowerCase() == normalized ||
    option.slug?.toLowerCase() == normalized ||
    matchesQuery(`${option.label} ${option.description ?? ''}`, normalized)
  );
};

let useSelectOptions = (
  filter: TableFilter<any> & { type: 'select' },
  search: string,
  selected: string[]
): ListFilterOptions => {
  let query = search.trim();

  return useMemo(() => {
    let items = query ? filter.options.filter(o => matchesOption(o, query)) : filter.options;
    let pinnedItems = query ? [] : filter.options.filter(o => selected.includes(o.id));
    return { items, pinnedItems, isLoading: false };
  }, [filter.options, query, selected]);
};

let useEntityOptions = (
  filter: TableFilter<any> & { type: 'entity' },
  search: string,
  filters: TableFilterPayloadMap,
  selected: string[]
): ListFilterOptions => {
  let debouncedSearch = useDebouncedValue(search, 250);
  let query = debouncedSearch.trim();
  let remoteSearch = filter.remoteSearch !== false;

  let result = filter.useOptions({ search: debouncedSearch, filters });
  let selectedLabels = useEntityFilterLabels(filter, selected);

  useEffect(() => rememberFilterLabels(filter.id, result.items), [filter.id, result.items]);

  let items = useMemo(() => {
    if (remoteSearch || !query) return sortExactMatchesFirst(result.items, query);
    return sortExactMatchesFirst(
      result.items.filter(item => matchesOption(item, query)),
      query
    );
  }, [result.items, remoteSearch, query]);

  let pinnedItems = useMemo(() => {
    if (query) return [];
    return selected.map(
      (id, i) => result.items.find(item => item.id == id) ?? { id, label: selectedLabels[i] }
    );
  }, [query, selected, selectedLabels, result.items]);

  return {
    items,
    pinnedItems,
    isLoading: !!result.isLoading || search != debouncedSearch,
    empty: result.empty
  };
};

// Entity filters fetch through a hook, so callers must key the rendering component by
// filter id to keep the hook order stable when the active filter changes.
export let useListFilterOptions = (
  filter: ListFilter,
  search: string,
  filters: TableFilterPayloadMap,
  selected: string[]
) =>
  filter.type == 'select'
    ? useSelectOptions(filter, search, selected)
    : useEntityOptions(filter, search, filters, selected);
