import {
  DashboardInstanceCustomProvidersListOutput,
  DashboardInstanceCustomProvidersListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCustomProviders
} from '@metorial/state';
import { Avatar, Input, Spacer, Text, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  TableFilters,
  useFilterQuery,
  FilterPayload,
  TableFilter,
  TableFilterState,
  getFilterPayload,
  getConstrainedEnumListFilterValue,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue,
  normalizeArrayFilterValue
} from '@metorial/table';
import { useDebounced } from '@metorial/use-debounced';

type CustomProvider = DashboardInstanceCustomProvidersListOutput['items'][number];

let customProviderTypeOptions: {
  id: CustomProvider['type'];
  label: string;
}[] = [
  { id: 'function', label: 'Function' },
  { id: 'container', label: 'Container' },
  { id: 'remote', label: 'Remote' }
];

let getCustomProviderStatusColor = (status: CustomProvider['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let getTypeLabel = (type: CustomProvider['type']) => {
  if (type === 'function') return 'Function';
  if (type === 'container') return 'Container';
  return 'Remote';
};

let Toolbar = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
`;

let SearchWrapper = styled.div`
  flex: 1;
  min-width: 260px;
`;

let HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
`;

let HeaderBadges = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

let Details = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

let Detail = styled.div`
  background: ${theme.colors.gray300};
  min-height: 26px;
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  overflow-wrap: anywhere;
  min-width: 0;
  max-width: 100%;
`;

let getStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceCustomProvidersListQuery['status'] => {
  return getEnumListFilterValue(value, ['active', 'archived']);
};

let getTypeFilterValue = (
  value: FilterPayload | undefined,
  defaultValue: DashboardInstanceCustomProvidersListQuery['type']
): DashboardInstanceCustomProvidersListQuery['type'] => {
  return getConstrainedEnumListFilterValue(
    value,
    ['function', 'container', 'remote'],
    defaultValue
  );
};

let getDateFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceCustomProvidersListQuery['createdAt'] => {
  return getDateRangeFilterValue(value);
};

let getRepositoryLabel = (provider: CustomProvider) => {
  if (!provider.scmRepo?.url) return null;

  try {
    let url = new URL(provider.scmRepo.url);
    return url.pathname.replace(/^\/+/, '') || provider.scmRepo.url;
  } catch {
    return provider.scmRepo.url;
  }
};

let getCommonCustomProviderFilters = (): TableFilter<CustomProvider>[] => [
  {
    id: 'status',
    fields: ['status'],
    label: 'Status',
    description: 'Filter by status',
    type: 'select',
    options: [
      { id: 'active', label: 'Active' },
      { id: 'archived', label: 'Archived' }
    ]
  },
  {
    id: 'id',
    fields: ['id'],
    label: 'Custom Provider ID',
    description: 'Filter by custom provider ID',
    type: 'string'
  },
  {
    id: 'providerId',
    fields: ['providerId'],
    label: 'Published Provider ID',
    description: 'Filter by published provider ID',
    type: 'string'
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
];

let managedCustomProviderFilters: TableFilter<CustomProvider>[] = [
  {
    id: 'type',
    fields: ['type'],
    label: 'Type',
    description: 'Filter by type',
    type: 'select',
    options: customProviderTypeOptions.filter(
      option => option.id === 'function' || option.id === 'container'
    )
  },
  ...getCommonCustomProviderFilters()
];

let externalCustomProviderFilters: TableFilter<CustomProvider>[] =
  getCommonCustomProviderFilters();

let getProviderDetail = (provider: CustomProvider) => {
  if (provider.draft.remoteMcpServer?.url) {
    return {
      label: provider.draft.remoteMcpServer.url,
      secondary: provider.draft.remoteMcpServer.transport
    };
  }

  if (provider.draft.containerImage?.containerImage) {
    return {
      label: provider.draft.containerImage.containerImage,
      secondary: provider.draft.containerImage.containerRegistry
    };
  }

  let repositoryLabel = getRepositoryLabel(provider);
  if (repositoryLabel) {
    return {
      label: repositoryLabel,
      secondary: provider.scmRepo?.defaultBranch
    };
  }

  if (provider.provider?.slug) {
    return {
      label: provider.provider.slug,
      secondary: provider.provider.access
    };
  }

  return {
    label: undefined,
    secondary: undefined
  };
};

export let CustomProvidersGrid = ({
  withSearch: _withSearch,
  ...filters
}: DashboardInstanceCustomProvidersListQuery & { withSearch?: boolean }) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let filterPayload = useMemo(() => getFilterPayload(filterState), [filterState]);
  let typeFilters = normalizeArrayFilterValue(filters.type);
  let isExternalOnly = typeFilters?.length === 1 && typeFilters[0] === 'remote';
  let tableFilters = isExternalOnly
    ? externalCustomProviderFilters
    : managedCustomProviderFilters;
  let status = getStatusFilterValue(filterPayload.status) ?? filters.status;
  let type = getTypeFilterValue(filterPayload.type, filters.type);
  let id = getStringFilterValue(filterPayload.id) ?? filters.id;
  let providerId = getStringFilterValue(filterPayload.providerId) ?? filters.providerId;
  let createdAt = getDateFilterValue(filterPayload.createdAt) ?? filters.createdAt;
  let updatedAt = getDateFilterValue(filterPayload.updatedAt) ?? filters.updatedAt;
  let customProviders = useCustomProviders(instance.data?.id, {
    order: 'desc',
    ...filters,
    status,
    type,
    id,
    providerId,
    search: searchDebounced || filters.search,
    createdAt,
    updatedAt
  });
  let hasActiveFilters = !!(searchDebounced || filters.search || filterState.length > 0);

  useFilterQuery({
    filters: tableFilters,
    filterState: [filterState, setFilterState],
    searchState: [search, setSearch],
    debouncedSearch: searchDebounced
  });

  return (
    <>
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
          filters={tableFilters}
          filterState={[filterState, setFilterState]}
          fullWidth={false}
        />
      </Toolbar>

      <Spacer size={15} />

      {renderWithPagination(customProviders)(customProviders => (
        <>
          {customProviders.data.items.length > 0 && (
            <ItemGrid.Root width="300px">
              {customProviders.data.items.map(provider => {
                let detail = getProviderDetail(provider);
                let title = provider.name || provider.provider?.name || 'Untitled';

                return (
                  <ItemGrid.Item
                    key={provider.id}
                    href={Paths.instance.customProvider(
                      organization.data,
                      project.data,
                      instance.data,
                      provider.id
                    )}
                    entity={{ id: provider.id, hasUsage: true }}
                    title={title}
                    description={provider.description ?? provider.provider?.description}
                    height={230}
                    icon={
                      <Avatar
                        entity={{
                          name: title,
                          imageUrl: `https://avatar-cdn.metorial.com/${provider.id}`
                        }}
                        size={30}
                      />
                    }
                    bottom={
                      <Details>{detail.label && <Detail>{detail.label}</Detail>}</Details>
                    }
                  />
                );
              })}
            </ItemGrid.Root>
          )}

          {customProviders.data.items.length === 0 && (
            <Text size="2" color="gray600">
              {hasActiveFilters
                ? 'No providers match the current filters.'
                : 'No providers found.'}
            </Text>
          )}
        </>
      ))}
    </>
  );
};
