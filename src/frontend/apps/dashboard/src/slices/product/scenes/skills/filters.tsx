import type {
  DashboardInstanceSkillGroupsListQuery,
  DashboardInstanceSkillTemplatesListQuery,
  DashboardInstanceSkillsMarketplacesListQuery,
  DashboardInstanceSkillsPluginsListQuery,
  DashboardInstanceSkillsListQuery
} from '@metorial/dashboard-sdk';
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
import { useDebounced } from '../../../../hooks/useDebounced';
import {
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue
} from '../../../../lib/dataTableUtils';

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

let skillStatusValues = ['active', 'archived', 'deleted'] as const;
let skillTemplateOwnerValues = ['system', 'tenant'] as const;

let statusFilter: TableFilter<any> = {
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
};

let createdAtFilter: TableFilter<any> = {
  id: 'createdAt',
  fields: ['createdAt'],
  label: 'Created',
  description: 'Filter by created date',
  type: 'date'
};

let updatedAtFilter: TableFilter<any> = {
  id: 'updatedAt',
  fields: ['updatedAt'],
  label: 'Updated',
  description: 'Filter by updated date',
  type: 'date'
};

let useProviderOptions = () => {
  let instance = useCurrentInstance();
  let providerListings = useProviderListings(instance.data?.id, {
    orderByRank: true,
    limit: 100
  });

  return useMemo(
    () =>
      [
        ...new Map(
          (providerListings.data?.items ?? []).map(listing => [
            listing.provider.id,
            {
              id: listing.provider.id,
              label: listing.name ?? listing.provider.name ?? listing.provider.slug
            }
          ])
        ).values()
      ].sort((a, b) => a.label.localeCompare(b.label)),
    [providerListings.data?.items]
  );
};

let useBaseSkillFilterPayload = (p: { search: string; filterState: TableFilterState[] }) => {
  let searchDebounced = useDebounced(p.search, 500);
  let filterPayload = useMemo(() => getFilterPayload(p.filterState), [p.filterState]);
  let status = getEnumListFilterValue(filterPayload.status, skillStatusValues);
  let createdAt = getDateRangeFilterValue(filterPayload.createdAt);
  let updatedAt = getDateRangeFilterValue(filterPayload.updatedAt);

  return {
    searchDebounced,
    filterPayload,
    status,
    createdAt,
    updatedAt
  };
};

export let useSkillFilters = (p: { search: string; filterState: TableFilterState[] }) => {
  let providerOptions = useProviderOptions();
  let { searchDebounced, filterPayload, status, createdAt, updatedAt } =
    useBaseSkillFilterPayload(p);
  let providerId = getStringFilterValue(filterPayload.providerId);
  let integrationId = getStringFilterValue(filterPayload.integrationId);
  let skillGroupId = getStringFilterValue(filterPayload.skillGroupId);

  let filters: TableFilter<any>[] = useMemo(
    () => [
      statusFilter,
      {
        id: 'providerId',
        fields: ['providerId'],
        label: 'Provider',
        description: 'Filter by provider',
        type: 'select',
        options: providerOptions
      },
      {
        id: 'integrationId',
        fields: ['integrationId'],
        label: 'Integration ID',
        description: 'Filter by integration ID',
        type: 'string'
      },
      {
        id: 'skillGroupId',
        fields: ['skillGroupId'],
        label: 'Skill Group ID',
        description: 'Filter by skill group ID',
        type: 'string'
      },
      createdAtFilter,
      updatedAtFilter
    ],
    [providerOptions]
  );

  let skillsFilter = useMemo(
    (): DashboardInstanceSkillsListQuery => ({
      ...(searchDebounced.trim() ? { search: searchDebounced.trim() } : {}),
      ...(status ? { status } : {}),
      ...(providerId ? { providerId } : {}),
      ...(integrationId ? { integrationId } : {}),
      ...(skillGroupId ? { skillGroupId } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {})
    }),
    [createdAt, integrationId, providerId, searchDebounced, skillGroupId, status, updatedAt]
  );

  return {
    filters,
    searchDebounced,
    skillsFilter
  };
};

export let useSkillTemplateFilters = (p: {
  search: string;
  filterState: TableFilterState[];
}) => {
  let providerOptions = useProviderOptions();
  let { searchDebounced, filterPayload, status, createdAt, updatedAt } =
    useBaseSkillFilterPayload(p);
  let owner = getEnumListFilterValue(filterPayload.owner, skillTemplateOwnerValues);
  let providerId = getStringFilterValue(filterPayload.providerId);
  let integrationId = getStringFilterValue(filterPayload.integrationId);

  let filters: TableFilter<any>[] = useMemo(
    () => [
      statusFilter,
      {
        id: 'owner',
        fields: ['owner'],
        label: 'Owner',
        description: 'Filter by owner',
        type: 'select',
        options: [
          { id: 'system', label: 'System' },
          { id: 'tenant', label: 'Tenant' }
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
        id: 'integrationId',
        fields: ['integrationId'],
        label: 'Integration ID',
        description: 'Filter by integration ID',
        type: 'string'
      },
      createdAtFilter,
      updatedAtFilter
    ],
    [providerOptions]
  );

  let skillTemplatesFilter = useMemo(
    (): DashboardInstanceSkillTemplatesListQuery => ({
      ...(searchDebounced.trim() ? { search: searchDebounced.trim() } : {}),
      ...(status ? { status } : {}),
      ...(owner ? { owner } : {}),
      ...(providerId ? { providerId } : {}),
      ...(integrationId ? { integrationId } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {})
    }),
    [createdAt, integrationId, owner, providerId, searchDebounced, status, updatedAt]
  );

  return {
    filters,
    searchDebounced,
    skillTemplatesFilter
  };
};

export let useSkillGroupFilters = (p: { search: string; filterState: TableFilterState[] }) => {
  let { searchDebounced, filterPayload, status, createdAt, updatedAt } =
    useBaseSkillFilterPayload(p);
  let skillId = getStringFilterValue(filterPayload.skillId);

  let filters: TableFilter<any>[] = useMemo(
    () => [
      statusFilter,
      {
        id: 'skillId',
        fields: ['skillId'],
        label: 'Skill ID',
        description: 'Filter by skill ID',
        type: 'string'
      },
      createdAtFilter,
      updatedAtFilter
    ],
    []
  );

  let skillGroupsFilter = useMemo(
    (): DashboardInstanceSkillGroupsListQuery => ({
      ...(searchDebounced.trim() ? { search: searchDebounced.trim() } : {}),
      ...(status ? { status } : {}),
      ...(skillId ? { skillId } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {})
    }),
    [createdAt, searchDebounced, skillId, status, updatedAt]
  );

  return {
    filters,
    searchDebounced,
    skillGroupsFilter
  };
};

export let useSkillMarketplaceFilters = (p: {
  search: string;
  filterState: TableFilterState[];
}) => {
  let { searchDebounced, filterPayload, status, createdAt, updatedAt } =
    useBaseSkillFilterPayload(p);

  let filters: TableFilter<any>[] = useMemo(
    () => [statusFilter, createdAtFilter, updatedAtFilter],
    []
  );

  let skillMarketplacesFilter = useMemo(
    (): DashboardInstanceSkillsMarketplacesListQuery => ({
      ...(searchDebounced.trim() ? { search: searchDebounced.trim() } : {}),
      ...(status ? { status } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {})
    }),
    [createdAt, searchDebounced, status, updatedAt]
  );

  return {
    filters,
    searchDebounced,
    skillMarketplacesFilter
  };
};

export let useSkillPluginFilters = (p: {
  search: string;
  filterState: TableFilterState[];
}) => {
  let { searchDebounced, filterPayload, status, createdAt, updatedAt } =
    useBaseSkillFilterPayload(p);
  let category = getStringFilterValue(filterPayload.category);
  let skillMarketplaceId = getStringFilterValue(filterPayload.skillMarketplaceId);

  let filters: TableFilter<any>[] = useMemo(
    () => [
      statusFilter,
      {
        id: 'category',
        fields: ['category'],
        label: 'Category',
        description: 'Filter by category',
        type: 'string'
      },
      {
        id: 'skillMarketplaceId',
        fields: ['skillMarketplaceId'],
        label: 'Marketplace ID',
        description: 'Filter by marketplace ID',
        type: 'string'
      },
      createdAtFilter,
      updatedAtFilter
    ],
    []
  );

  let skillPluginsFilter = useMemo(
    (): DashboardInstanceSkillsPluginsListQuery => ({
      ...(searchDebounced.trim() ? { search: searchDebounced.trim() } : {}),
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(skillMarketplaceId ? { skillMarketplaceId } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {})
    }),
    [category, createdAt, searchDebounced, skillMarketplaceId, status, updatedAt]
  );

  return {
    filters,
    searchDebounced,
    skillPluginsFilter
  };
};

export let SkillResourceFilters = (p: {
  searchState: [string, Dispatch<SetStateAction<string>>];
  filterState: [TableFilterState[], Dispatch<SetStateAction<TableFilterState[]>>];
  filters: TableFilter<any>[];
  placeholder: string;
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
          placeholder={p.placeholder}
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
