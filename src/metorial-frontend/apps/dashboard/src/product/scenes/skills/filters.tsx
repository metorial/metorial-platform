import type {
  DashboardInstanceSkillsPluginsListQuery,
  DashboardInstanceSkillsTemplatesListQuery
} from '@metorial/dashboard-sdk';
import { useCurrentInstance } from '@metorial/state';
import { type Dispatch, type SetStateAction, useMemo } from 'react';
import {
  FilterToolbar,
  TableFilter,
  TableFilterState,
  getFilterPayload,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getListFilterValue,
  getStringFilterValue
} from '@metorial/table';
import { useDebounced } from '@metorial/use-debounced';
import { entityFilters } from '../entityFilters';

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

let useInstanceId = () => useCurrentInstance().data?.id;

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

export let useSkillTemplateFilters = (p: {
  search: string;
  filterState: TableFilterState[];
}) => {
  let instanceId = useInstanceId();
  let { searchDebounced, filterPayload, status, createdAt, updatedAt } =
    useBaseSkillFilterPayload(p);
  let owner = getEnumListFilterValue(filterPayload.owner, skillTemplateOwnerValues);
  let providerId = getListFilterValue(filterPayload.providerId);
  let integrationId = getListFilterValue(filterPayload.integrationId);

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
      entityFilters.provider(instanceId),
      entityFilters.integration(instanceId),
      createdAtFilter,
      updatedAtFilter
    ],
    [instanceId]
  );

  let skillTemplatesFilter = useMemo(
    (): DashboardInstanceSkillsTemplatesListQuery => ({
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

export let useSkillPluginFilters = (p: {
  search: string;
  filterState: TableFilterState[];
}) => {
  let instanceId = useInstanceId();
  let { searchDebounced, filterPayload, status, createdAt, updatedAt } =
    useBaseSkillFilterPayload(p);
  let category = getStringFilterValue(filterPayload.category);
  let skillMarketplaceId = getListFilterValue(filterPayload.skillMarketplaceId);

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
      entityFilters.skillMarketplace(instanceId),
      createdAtFilter,
      updatedAtFilter
    ],
    [instanceId]
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
}) => (
  <FilterToolbar
    searchState={p.searchState}
    filterState={p.filterState}
    filters={p.filters}
    placeholder={p.placeholder}
    style={{ marginBottom: 15 }}
  />
);
