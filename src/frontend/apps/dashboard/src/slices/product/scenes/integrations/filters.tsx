import type { DashboardInstanceIntegrationsListQuery } from '@metorial/dashboard-sdk';
import { useCurrentInstance, useProviderListings } from '@metorial/state';
import { Input } from '@metorial/ui';
import { type Dispatch, type SetStateAction, useMemo } from 'react';
import styled from 'styled-components';
import { TableFilters } from '../../../../components/table/components/filter';
import {
  TableFilter,
  TableFilterState,
  getFilterPayload
} from '../../../../components/table/filter';
import {
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue
} from '../../../../lib/dataTableUtils';
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

let integrationStatusValues = ['active', 'archived', 'deleted'] as const;

export let useIntegrationFilters = (p: {
  search: string;
  filterState: TableFilterState[];
}) => {
  let instance = useCurrentInstance();
  let providerListings = useProviderListings(instance.data?.id, {
    orderByRank: true,
    limit: 100
  });
  let searchDebounced = useDebounced(p.search, 500);
  let providerOptions = useMemo(
    () =>
      [...new Map(
        (providerListings.data?.items ?? []).map(listing => [
          listing.provider.id,
          {
            id: listing.provider.id,
            label: listing.name ?? listing.provider.name ?? listing.provider.slug
          }
        ])
      ).values()].sort((a, b) => a.label.localeCompare(b.label)),
    [providerListings.data?.items]
  );

  let filters: TableFilter<any>[] = useMemo(
    () => [
      {
        id: 'status',
        fields: ['status'],
        label: 'Status',
        description: 'Filter by status',
        type: 'select',
        options: [
          { id: 'active', label: 'Active' },
          { id: 'archived', label: 'Archived' },
          { id: 'deleted', label: 'Deleted' }
        ]
      },
      {
        id: 'providerId',
        fields: ['providerId'],
        label: 'Provider',
        description: 'Filter by provider',
        type: 'select',
        options: providerOptions
      },
      {
        id: 'createdAt',
        fields: ['createdAt'],
        label: 'Created',
        description: 'Filter by created date',
        type: 'date'
      },
      {
        id: 'updatedAt',
        fields: ['updatedAt'],
        label: 'Updated',
        description: 'Filter by updated date',
        type: 'date'
      }
    ],
    [providerOptions]
  );

  let filterPayload = useMemo(() => getFilterPayload(p.filterState), [p.filterState]);
  let hasStatusFilter = p.filterState.some(filter => filter.id === 'status');
  let selectedStatus = getEnumListFilterValue(filterPayload.status, integrationStatusValues);
  let status = hasStatusFilter ? selectedStatus : (selectedStatus ?? ['active']);
  let providerId = getStringFilterValue(filterPayload.providerId);
  let createdAt = getDateRangeFilterValue(filterPayload.createdAt);
  let updatedAt = getDateRangeFilterValue(filterPayload.updatedAt);

  let integrationsFilter = useMemo(
    (): DashboardInstanceIntegrationsListQuery => ({
      ...(searchDebounced.trim() ? { search: searchDebounced.trim() } : {}),
      ...(status ? { status } : {}),
      ...(providerId ? { providerId } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {})
    }),
    [createdAt, providerId, searchDebounced, status, updatedAt]
  );

  return {
    filters,
    searchDebounced,
    integrationsFilter
  };
};

export let IntegrationFilters = (p: {
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
          placeholder="Search integrations..."
          value={search}
          onInput={setSearch}
        />
      </SearchWrapper>

      <TableFilters
        filters={p.filters}
        filterState={[filterState, setFilterState]}
        fullWidth={false}
        wrap={false}
        defaultFilterId="status"
        resetCurrentFilterOnOpen
      />
    </Toolbar>
  );
};
