import type { DashboardInstanceIntegrationsListQuery } from '@metorial/dashboard-sdk';
import { useCurrentInstance } from '@metorial/state';
import { Input } from '@metorial/ui';
import { type Dispatch, type SetStateAction, useMemo } from 'react';
import styled from 'styled-components';
import {
  TableFilters,
  TableFilter,
  TableFilterState,
  getFilterPayload,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getListFilterValue
} from '@metorial/table';
import { useDebounced } from '@metorial/use-debounced';
import { entityFilters } from '../entityFilters';

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
  let instanceId = instance.data?.id;
  let searchDebounced = useDebounced(p.search, 500);

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
      entityFilters.provider(instanceId),
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
    [instanceId]
  );

  let filterPayload = useMemo(() => getFilterPayload(p.filterState), [p.filterState]);
  let hasStatusFilter = p.filterState.some(filter => filter.id === 'status');
  let selectedStatus = getEnumListFilterValue(filterPayload.status, integrationStatusValues);
  let status = hasStatusFilter ? selectedStatus : (selectedStatus ?? ['active']);
  let providerId = getListFilterValue(filterPayload.providerId);
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
