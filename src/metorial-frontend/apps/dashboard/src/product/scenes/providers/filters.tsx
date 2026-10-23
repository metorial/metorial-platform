import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk';
import { providerCategoriesLoader, useCurrentInstance } from '@metorial/state';
import { Input } from '@metorial/ui';
import { type Dispatch, type SetStateAction, useMemo } from 'react';
import styled from 'styled-components';
import {
  TableFilters,
  TableFilter,
  TableFilterState,
  getFilterPayload,
  getEnumListFilterValue,
  getListFilterValue
} from '@metorial/table';
import { useDebounced } from '@metorial/use-debounced';
import { defineEntityFilter, useEntityList } from '../entityFilters';

let Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  flex-wrap: nowrap;
`;

let SearchWrapper = styled.div`
  flex: 1 1 auto;
  min-width: 220px;
`;

let providerCategoryFilter = (instanceId: string | undefined) =>
  defineEntityFilter({
    id: 'providerCategoryId',
    label: 'Category',
    noun: 'categories',
    mode: 'recent',
    useList: q => {
      let categories = useEntityList(
        providerCategoriesLoader.use(instanceId && q ? { instanceId } : null),
        category => ({ id: category.id, label: category.name, slug: category.slug })
      );
      let idsKey = q?.ids?.join(',');

      return useMemo(() => {
        let ids = idsKey ? new Set(idsKey.split(',')) : undefined;
        let items = categories.items
          .filter(category => !ids || ids.has(category.id))
          .sort((a, b) => a.label.localeCompare(b.label));

        return { items, isLoading: categories.isLoading };
      }, [categories, idsKey]);
    }
  })();

export let useProviderListingFilters = (p: {
  search: string;
  filterState: TableFilterState[];
}) => {
  let trueFilterValues = useMemo(() => ['true'] as const, []);
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;
  let searchDebounced = useDebounced(p.search, 500);

  let filters: TableFilter<any>[] = useMemo(
    () => [
      providerCategoryFilter(instanceId),
      {
        id: 'isVerified',
        fields: ['isVerified'],
        label: 'Verified',
        description: 'Filter by verified status',
        type: 'select',
        options: [{ id: 'true', label: 'Verified only' }]
      }
    ],
    [instanceId]
  );

  let filterPayload = useMemo(() => getFilterPayload(p.filterState), [p.filterState]);
  let providerCategoryId = getListFilterValue(
    filterPayload.providerCategoryId
  ) as DashboardInstanceProviderListingsListQuery['providerCategoryId'];
  let isVerified = !!getEnumListFilterValue(filterPayload.isVerified, trueFilterValues)
    ? true
    : undefined;

  let providerListingsFilter = useMemo(
    (): DashboardInstanceProviderListingsListQuery => ({
      ...(searchDebounced.trim() ? { search: searchDebounced.trim() } : {}),
      ...(providerCategoryId ? { providerCategoryId } : {}),
      ...(isVerified ? { isVerified } : {})
    }),
    [searchDebounced, providerCategoryId, isVerified]
  );

  return {
    filters,
    searchDebounced,
    providerListingsFilter
  };
};

export let ProviderListingFilters = (p: {
  searchState: [string, Dispatch<SetStateAction<string>>];
  filterState: [TableFilterState[], Dispatch<SetStateAction<TableFilterState[]>>];
  filters: TableFilter<any>[];
}) => {
  let [search, setSearch] = p.searchState;
  let [filterState, setFilterState] = p.filterState;

  return (
    <Toolbar>
      <SearchWrapper>
        <Input
          label="Search"
          hideLabel
          size="2"
          placeholder="Search providers..."
          value={search}
          onInput={setSearch}
        />
      </SearchWrapper>

      <TableFilters
        filters={p.filters}
        filterState={[filterState, setFilterState]}
        fullWidth={false}
        wrap={false}
        defaultFilterId="providerCategoryId"
        resetCurrentFilterOnOpen
      />
    </Toolbar>
  );
};
