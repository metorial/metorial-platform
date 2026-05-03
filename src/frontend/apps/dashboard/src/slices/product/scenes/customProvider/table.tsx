import {
  DashboardInstanceCustomProvidersListOutput,
  DashboardInstanceCustomProvidersListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCustomProviders
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '../../../../components/table';
import { FilterPayload, TableFilter } from '../../../../components/table/filter';
import {
  TableColumn,
  TableStateProvider,
  TableStateProviderResult
} from '../../../../components/table/type';
import {
  getConstrainedEnumListFilterValue,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue,
  normalizeArrayFilterValue
} from '../../../../lib/dataTableUtils';

type CustomProvider = DashboardInstanceCustomProvidersListOutput['items'][number];

type CustomProviderFilters = Omit<
  DashboardInstanceCustomProvidersListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type CustomProvidersTableProps = {
  instanceId: string;
  filters?: CustomProviderFilters;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

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

let customProviderTableColumns: TableColumn<CustomProvider, CustomProvidersTableProps>[] = [
  {
    id: 'provider',
    isDefault: true,
    header: 'Provider',
    render: (provider: CustomProvider) => (
      <div>
        <Text size="2" weight="strong">
          {provider.name || 'Untitled'}
        </Text>
        {provider.description && (
          <Text size="1" color="gray600">
            {provider.description}
          </Text>
        )}
      </div>
    )
  },
  {
    id: 'status',
    isDefault: true,
    header: 'Status',
    render: (provider: CustomProvider) => (
      <Badge color={getCustomProviderStatusColor(provider.status)}>{provider.status}</Badge>
    )
  },
  {
    id: 'version',
    isDefault: true,
    header: 'Version',
    render: (provider: CustomProvider) => (
      <Text
        size="2"
        color={provider.provider?.currentVersion?.version ? undefined : 'gray600'}
      >
        {provider.provider?.currentVersion?.version ?? '-'}
      </Text>
    )
  },
  {
    id: 'createdAt',
    isDefault: true,
    header: 'Created',
    render: (provider: CustomProvider) => <RenderDate date={provider.createdAt} />
  },
  {
    id: 'type',
    isDefault: false,
    header: 'Type',
    render: (provider: CustomProvider) => <Text size="2">{getTypeLabel(provider.type)}</Text>
  },
  {
    id: 'publishedProvider',
    isDefault: false,
    header: 'Published Provider',
    render: (provider: CustomProvider) =>
      provider.provider ? (
        <div>
          <Text size="2">{provider.provider.name}</Text>
          <Text size="1" color="gray600">
            {provider.provider.slug}
          </Text>
        </div>
      ) : (
        <Text size="2" color="gray600">
          Not published
        </Text>
      )
  },
  {
    id: 'identifier',
    isDefault: false,
    header: 'Identifier',
    render: (provider: CustomProvider) =>
      provider.provider?.identifier ? (
        <Text size="2">{provider.provider.identifier}</Text>
      ) : (
        <Text size="2" color="gray600">
          -
        </Text>
      )
  },
  {
    id: 'providerAccess',
    isDefault: false,
    header: 'Access',
    render: (provider: CustomProvider) =>
      provider.provider?.access ? (
        <Badge color={provider.provider.access === 'public' ? 'blue' : 'gray'}>
          {provider.provider.access}
        </Badge>
      ) : (
        <Text size="2" color="gray600">
          -
        </Text>
      )
  },
  {
    id: 'repository',
    isDefault: false,
    header: 'Repository',
    render: (provider: CustomProvider) => {
      let repositoryLabel = getRepositoryLabel(provider);

      return repositoryLabel ? (
        <div>
          <Text size="2">{repositoryLabel}</Text>
          <Text size="1" color="gray600">
            {provider.scmRepo?.provider.type} / {provider.scmRepo?.defaultBranch}
          </Text>
        </div>
      ) : (
        <Text size="2" color="gray600">
          -
        </Text>
      );
    }
  },
  {
    id: 'remoteUrl',
    isDefault: false,
    header: 'Remote URL',
    render: (provider: CustomProvider) =>
      provider.draft.remoteMcpServer?.url ? (
        <Text size="2">{provider.draft.remoteMcpServer.url}</Text>
      ) : (
        <Text size="2" color="gray600">
          -
        </Text>
      )
  },
  {
    id: 'containerImage',
    isDefault: false,
    header: 'Container Image',
    render: (provider: CustomProvider) =>
      provider.draft.containerImage?.containerImage ? (
        <Text size="2">{provider.draft.containerImage.containerImage}</Text>
      ) : (
        <Text size="2" color="gray600">
          -
        </Text>
      )
  },
  {
    id: 'transport',
    isDefault: false,
    header: 'Transport',
    render: (provider: CustomProvider) =>
      provider.draft.remoteMcpServer?.transport ? (
        <Text size="2">{provider.draft.remoteMcpServer.transport}</Text>
      ) : (
        <Text size="2" color="gray600">
          -
        </Text>
      )
  },
  {
    id: 'updatedAt',
    isDefault: false,
    header: 'Updated',
    render: (provider: CustomProvider) => <RenderDate date={provider.updatedAt} />
  },
  {
    id: 'id',
    isDefault: false,
    header: 'Custom Provider ID',
    render: (provider: CustomProvider) => <ID id={provider.id} />
  },
  {
    id: 'providerId',
    isDefault: false,
    header: 'Published Provider ID',
    render: (provider: CustomProvider) =>
      provider.provider?.id ? (
        <ID id={provider.provider.id} />
      ) : (
        <Text size="2" color="gray600">
          -
        </Text>
      )
  }
];

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

let useCustomProvidersTableState: TableStateProvider<
  CustomProvidersTableProps,
  CustomProvider,
  TableStateProviderResult<CustomProvider>
> = (
  props: CustomProvidersTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
): TableStateProviderResult<CustomProvider> => {
  let customProviders = useCustomProviders(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status: getStatusFilterValue(opts.filter.status) ?? props.filters?.status,
    type: getTypeFilterValue(opts.filter.type, props.filters?.type),
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    providerId: getStringFilterValue(opts.filter.providerId) ?? props.filters?.providerId,
    search: opts.search ?? props.filters?.search,
    createdAt: getDateFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt,
    updatedAt: getDateFilterValue(opts.filter.updatedAt) ?? props.filters?.updatedAt
  });

  return {
    isLoading: customProviders.isLoading,
    error: customProviders.error,
    hasMoreAfter: customProviders.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: customProviders.data?.pagination.hasMoreBefore ?? false,
    items: customProviders.data?.items ?? [],
    loadNext: customProviders.next,
    loadPrevious: customProviders.previous
  };
};

let createCustomProvidersTable = (name: string, filters: TableFilter<CustomProvider>[]) =>
  new DashboardTable<CustomProvidersTableProps, CustomProvider>(name)
    .state(useCustomProvidersTableState)
    .columns(customProviderTableColumns)
    .filters(filters)
    .search('Search providers...')
    .link((provider, props) =>
      Paths.instance.customProvider(
        props.organization.data,
        props.project.data,
        props.instance.data,
        provider.id
      )
    )
    .build();

let managedCustomProvidersTable = createCustomProvidersTable(
  'custom-providers-managed',
  managedCustomProviderFilters
);

let externalCustomProvidersTable = createCustomProvidersTable(
  'custom-providers-external',
  externalCustomProviderFilters
);

export let CustomProvidersTable = ({
  withSearch: _withSearch,
  ...filters
}: DashboardInstanceCustomProvidersListQuery & { withSearch?: boolean }) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let typeFilters = normalizeArrayFilterValue(filters.type);
  let isExternalOnly = typeFilters?.length === 1 && typeFilters[0] === 'remote';
  let table = isExternalOnly ? externalCustomProvidersTable : managedCustomProvidersTable;

  return table({
    instanceId: instance.data?.id ?? '',
    filters,
    instance,
    organization,
    project,
    emptyState: 'No providers found.'
  });
};
