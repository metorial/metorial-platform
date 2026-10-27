import {
  DashboardInstanceProviderDeploymentsConfigsListOutput,
  DashboardInstanceProviderDeploymentsConfigsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteProviderConfig,
  useProviderConfigs,
  useProviders
} from '@metorial/state';
import { Badge, RenderDate, Text, confirm } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine } from '@remixicon/react';
import { type ReactNode, useMemo, useState } from 'react';
import { Table as DashboardTable } from '@metorial/table';
import {
  FilterPayload,
  TableFilter,
  TableStateProvider,
  TableStateProviderResult,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getListFilterValue
} from '@metorial/table';
import { entityFilters } from '../entityFilters';

type ProviderConfig = DashboardInstanceProviderDeploymentsConfigsListOutput['items'][number];

type ProviderConfigRow = ProviderConfig & {
  providerName?: string | null;
  providerDeploymentId?: string;
  providerDeploymentName?: string | null;
};

let getProviderConfigStatusColor = (status: ProviderConfig['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

export type ProviderConfigFilters = Omit<
  DashboardInstanceProviderDeploymentsConfigsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let getStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceProviderDeploymentsConfigsListQuery['status'] =>
  getEnumListFilterValue(value, ['active', 'archived']);

export let useProviderConfigFilters = (instanceId: string | null | undefined) =>
  useMemo<TableFilter<ProviderConfigRow>[]>(
    () => [
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
      entityFilters.provider(instanceId),
      entityFilters.providerSpecification(instanceId),
      entityFilters.providerDeployment(instanceId),
      entityFilters.providerConfigVault(instanceId),
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

export let getProviderConfigFilterQuery = (
  filter: Record<string, FilterPayload>,
  filters?: ProviderConfigFilters
) => ({
  status: getStatusFilterValue(filter.status) ?? filters?.status,
  providerId: getListFilterValue(filter.providerId) ?? filters?.providerId,
  providerSpecificationId:
    getListFilterValue(filter.providerSpecificationId) ?? filters?.providerSpecificationId,
  providerDeploymentId:
    getListFilterValue(filter.providerDeploymentId) ?? filters?.providerDeploymentId,
  providerConfigVaultId:
    getListFilterValue(filter.providerConfigVaultId) ?? filters?.providerConfigVaultId,
  createdAt: getDateRangeFilterValue(filter.createdAt) ?? filters?.createdAt,
  updatedAt: getDateRangeFilterValue(filter.updatedAt) ?? filters?.updatedAt
});

type ProviderConfigsOverviewTableProps = {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
  filters?: ProviderConfigFilters;
};

let providerConfigsOverviewTableState: TableStateProvider<
  ProviderConfigsOverviewTableProps,
  ProviderConfigRow,
  TableStateProviderResult<ProviderConfigRow>
> = (
  props: ProviderConfigsOverviewTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let configs = useProviderConfigs(props.instanceId, {
    ownership: 'all',
    order: 'desc',
    ...props.filters,
    ...getProviderConfigFilterQuery(opts.filter, props.filters),
    search: opts.search ?? props.filters?.search
  });

  let providerIds = [
    ...new Set(
      (configs.data?.items ?? [])
        .map(
          item =>
            item.deployment?.providerId ??
            item.fromVault?.deployment?.providerId ??
            item.providerId
        )
        .filter(Boolean)
    )
  ];
  let shouldLoadProviders = providerIds.length > 0;
  let providers = useProviders(
    props.instanceId,
    shouldLoadProviders ? { id: providerIds } : null
  );

  let providerNameMap = new Map<string, string>();
  for (let provider of providers.data?.items ?? []) {
    if (provider.id && provider.name) providerNameMap.set(provider.id, provider.name);
  }

  return {
    isLoading: configs.isLoading || (shouldLoadProviders && providers.isLoading),
    error: configs.error ?? (shouldLoadProviders ? providers.error : null),
    hasMoreAfter: configs.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: configs.data?.pagination.hasMoreBefore ?? false,
    items: (configs.data?.items ?? []).map(config => ({
      ...config,
      providerName:
        providerNameMap.get(
          config.deployment?.providerId ??
            config.fromVault?.deployment?.providerId ??
            config.providerId
        ) ?? null,
      providerDeploymentId: config.deployment?.id ?? config.fromVault?.deployment?.id,
      providerDeploymentName: config.deployment?.name ?? config.fromVault?.deployment?.name
    })),
    loadNext: configs.next,
    loadPrevious: configs.previous
  };
};

let useProviderConfigsOverviewTableHookState = (
  _: ReturnType<typeof providerConfigsOverviewTableState>,
  props: ProviderConfigsOverviewTableProps
) => {
  let deleteConfig = useDeleteProviderConfig();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteConfig,
    instanceId: props.instanceId,
    loadingIds,
    setLoadingIds
  };
};

let deleteProviderConfigImmediately = async (
  config: ProviderConfigRow,
  state: ReturnType<typeof useProviderConfigsOverviewTableHookState>
) => {
  state.setLoadingIds((current: string[]) => [...new Set([...current, config.id])]);

  try {
    await state.deleteConfig.mutate({
      instanceId: state.instanceId,
      providerConfigId: config.id
    });
  } finally {
    state.setLoadingIds((current: string[]) => current.filter(id => id != config.id));
  }
};

let providerConfigsOverviewTable = new DashboardTable<
  ProviderConfigsOverviewTableProps,
  ProviderConfigRow
>('provider-configs-overview')
  .state(providerConfigsOverviewTableState)
  .hookState(useProviderConfigsOverviewTableHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Config Name',
      render: row => (
        <Text size="2" weight="strong">
          {row.name ?? 'Unnamed'}
        </Text>
      )
    },
    {
      id: 'provider',
      isDefault: true,
      header: 'Provider',
      render: row => <Text size="2">{row.providerName ?? row.providerId}</Text>
    },
    {
      id: 'deployment',
      isDefault: true,
      header: 'Deployment',
      render: row =>
        row.providerDeploymentName ? (
          <Text size="2">{row.providerDeploymentName}</Text>
        ) : (
          <Text size="2" color="gray600">
            Provider-level
          </Text>
        )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: row => <RenderDate date={row.createdAt} />
    },
    {
      id: 'id',
      isDefault: true,
      header: 'ID',
      render: row => <ID id={row.id} />
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: row => (
        <Badge color={getProviderConfigStatusColor(row.status)}>{row.status}</Badge>
      )
    },
    {
      id: 'default',
      isDefault: false,
      header: 'Default',
      render: row =>
        row.isDefault ? (
          <Badge color="blue">Default</Badge>
        ) : (
          <Text size="2" color="gray600">
            No
          </Text>
        )
    },
    {
      id: 'vault',
      isDefault: false,
      header: 'Vault',
      render: row =>
        row.fromVault?.id ? (
          <ID id={row.fromVault.id} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'specificationId',
      isDefault: false,
      header: 'Specification ID',
      render: row => <ID id={row.specificationId} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: row => <RenderDate date={row.updatedAt} />
    }
  ])
  .search('Search configs...')
  .link((row, props) =>
    Paths.instance.providerConfig(
      props.organization.data,
      props.project.data,
      props.instance.data,
      row.id
    )
  )
  .actions({
    deleteImmediate: async (configs, state) => {
      let config = configs[0];
      if (!config) return;

      await deleteProviderConfigImmediately(config, state);
    },
    delete: async (configs, state) => {
      let config = configs[0];
      if (!config) return;

      confirm({
        title: 'Delete config',
        description: `Are you sure you want to delete ${config.name ?? 'this config'}?`,
        confirmText: 'Delete',
        onConfirm: async () => {
          await deleteProviderConfigImmediately(config, state);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: row => row.status !== 'active',
      action: 'delete'
    }
  ])
  .bulkActions([
    {
      id: 'delete-selected',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: row => row.status !== 'active',
      action: 'deleteImmediate',
      bulkExecution: {
        mode: 'per-row',
        batchSize: 10
      }
    }
  ])
  .build();

export let ProviderConfigsOverviewTable = ({
  instanceId,
  filters,
  emptyState,
  headerActions
}: {
  instanceId: string;
  filters?: ProviderConfigFilters;
  emptyState?: (() => ReactNode) | string;
  headerActions?: () => ReactNode;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let tableFilters = useProviderConfigFilters(instanceId);

  return renderWithLoader({ organization, project, instance })(() =>
    providerConfigsOverviewTable({
      instanceId,
      organization,
      project,
      instance,
      filters,
      tableFilters,
      emptyState,
      headerActions
    })
  );
};
