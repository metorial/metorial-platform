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
import { useState } from 'react';
import { EmptyState } from '../../../../../components/emptyState';
import { Table as DashboardTable } from '../../../../../components/table';
import { FilterPayload } from '../../../../../components/table/filter';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../../components/table/type';
import {
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue
} from '../../../../../lib/dataTableUtils';
import { showCreateProviderConfigFlow } from './providerCreationFlows';

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

type ProviderConfigFilters = Omit<
  DashboardInstanceProviderDeploymentsConfigsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let getStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceProviderDeploymentsConfigsListQuery['status'] =>
  getEnumListFilterValue(value, ['active', 'archived']);

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
    order: 'desc',
    ...props.filters,
    status: getStatusFilterValue(opts.filter.status) ?? props.filters?.status,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    providerId: getStringFilterValue(opts.filter.providerId) ?? props.filters?.providerId,
    providerSpecificationId:
      getStringFilterValue(opts.filter.providerSpecificationId) ??
      props.filters?.providerSpecificationId,
    providerDeploymentId:
      getStringFilterValue(opts.filter.providerDeploymentId) ??
      props.filters?.providerDeploymentId,
    providerConfigVaultId:
      getStringFilterValue(opts.filter.providerConfigVaultId) ??
      props.filters?.providerConfigVaultId,
    search: opts.search ?? props.filters?.search,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt,
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt) ?? props.filters?.updatedAt
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

export let providerConfigsOverviewTable = new DashboardTable<
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
  .filters([
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
      label: 'Config ID',
      description: 'Filter by config ID',
      type: 'string'
    },
    {
      id: 'providerId',
      fields: ['providerId'],
      label: 'Provider ID',
      description: 'Filter by provider ID',
      type: 'string'
    },
    {
      id: 'providerSpecificationId',
      fields: ['providerSpecificationId'],
      label: 'Specification ID',
      description: 'Filter by specification ID',
      type: 'string'
    },
    {
      id: 'providerDeploymentId',
      fields: ['providerDeploymentId'],
      label: 'Deployment ID',
      description: 'Filter by deployment ID',
      type: 'string'
    },
    {
      id: 'providerConfigVaultId',
      fields: ['providerConfigVaultId'],
      label: 'Vault ID',
      description: 'Filter by vault ID',
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

export let ProviderConfigsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return renderWithLoader({ organization, project, instance })(() =>
    providerConfigsOverviewTable({
      instanceId: instance.data!.id,
      organization,
      project,
      instance,
      emptyState: () => (
        <EmptyState
          title="Create your first config"
          description="Configs let you save reusable provider settings for this instance."
          action={{
            label: 'Create Config',
            onClick: () => {
              if (instance.data?.id) {
                showCreateProviderConfigFlow(instance.data.id);
              }
            }
          }}
        />
      )
    })
  );
};
