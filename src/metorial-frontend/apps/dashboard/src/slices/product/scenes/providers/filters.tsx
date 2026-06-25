import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk';
import { useCurrentInstance, useProviderCategories } from '@metorial/state';
import { Input } from '@metorial/ui';
import { type Dispatch, type SetStateAction, useMemo } from 'react';
import styled from 'styled-components';
import { TableFilters } from '../../../../components/table/components/filter';
import {
  TableFilter,
  TableFilterState,
  getFilterPayload
} from '../../../../components/table/filter';
import { getEnumListFilterValue, getListFilterValue } from '../../../../lib/dataTableUtils';
import { useDebounced } from '../../../../hooks/useDebounced';

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

export let useProviderListingFilters = (p: {
  search: string;
  filterState: TableFilterState[];
}) => {
  let trueFilterValues = useMemo(() => ['true'] as const, []);
  let instance = useCurrentInstance();
  let providerCategories = useProviderCategories(instance.data?.id);
  let searchDebounced = useDebounced(p.search, 500);
  let categories = useMemo(
    () =>
      (providerCategories.data?.items ?? [])
        .map(category => ({ id: category.id, name: category.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [providerCategories.data?.items]
  );

  let filters: TableFilter<any>[] = useMemo(
    () => [
      {
        id: 'providerCategoryId',
        fields: ['providerCategoryId'],
        label: 'Category',
        description: 'Filter by category',
        type: 'select',
        options: categories.map(category => ({ id: category.id, label: category.name }))
      },
      {
        id: 'isVerified',
        fields: ['isVerified'],
        label: 'Verified',
        description: 'Filter by verified status',
        type: 'select',
        options: [{ id: 'true', label: 'Verified only' }]
      }
    ],
    [categories]
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
