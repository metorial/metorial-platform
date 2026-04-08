import {
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteProviderConfigVault,
  useProviderConfigVaults,
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
import { withFromDeployment } from '../fromDeployment';
import { showCreateProviderConfigVaultFlow } from './providerCreationFlows';

type ProviderConfigVault =
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput['items'][number];

type ProviderConfigVaultRow = ProviderConfigVault & {
  providerName?: string | null;
};

type ProviderConfigVaultFilters = Omit<
  DashboardInstanceProviderDeploymentsConfigVaultsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type ProviderConfigVaultsOverviewTableProps = {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
  filters?: ProviderConfigVaultFilters;
  fromDeploymentId?: string;
};

let getProviderConfigVaultStatusColor = (status: ProviderConfigVault['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let getStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceProviderDeploymentsConfigVaultsListQuery['status'] =>
  getEnumListFilterValue(value, ['active', 'archived']);

let providerConfigVaultsOverviewState: TableStateProvider<
  ProviderConfigVaultsOverviewTableProps,
  ProviderConfigVaultRow,
  TableStateProviderResult<ProviderConfigVaultRow>
> = (
  props: ProviderConfigVaultsOverviewTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let vaults = useProviderConfigVaults(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status: getStatusFilterValue(opts.filter.status) ?? props.filters?.status,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    providerId: getStringFilterValue(opts.filter.providerId) ?? props.filters?.providerId,
    providerDeploymentId:
      getStringFilterValue(opts.filter.providerDeploymentId) ??
      props.filters?.providerDeploymentId,
    providerConfigId:
      getStringFilterValue(opts.filter.providerConfigId) ?? props.filters?.providerConfigId,
    providerConfigVaultId:
      getStringFilterValue(opts.filter.providerConfigVaultId) ??
      props.filters?.providerConfigVaultId,
    search: opts.search ?? props.filters?.search,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt,
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt) ?? props.filters?.updatedAt
  });

  let providerIds = [
    ...new Set((vaults.data?.items ?? []).map(item => item.providerId).filter(Boolean))
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
    isLoading: vaults.isLoading || (shouldLoadProviders && providers.isLoading),
    error: vaults.error ?? (shouldLoadProviders ? providers.error : null),
    hasMoreAfter: vaults.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: vaults.data?.pagination.hasMoreBefore ?? false,
    items: (vaults.data?.items ?? []).map(item => ({
      ...item,
      providerName: providerNameMap.get(item.providerId) ?? null
    })),
    loadNext: vaults.next,
    loadPrevious: vaults.previous
  };
};

let useProviderConfigVaultsOverviewHookState = (
  _: ReturnType<typeof providerConfigVaultsOverviewState>,
  props: ProviderConfigVaultsOverviewTableProps
) => {
  let deleteVault = useDeleteProviderConfigVault();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteVault,
    instanceId: props.instanceId,
    loadingIds,
    setLoadingIds
  };
};

let deleteProviderConfigVaultImmediately = async (
  vault: ProviderConfigVaultRow,
  state: ReturnType<typeof useProviderConfigVaultsOverviewHookState>
) => {
  state.setLoadingIds((current: string[]) => [...new Set([...current, vault.id])]);

  try {
    await state.deleteVault.mutate({
      instanceId: state.instanceId,
      providerConfigVaultId: vault.id
    });
  } finally {
    state.setLoadingIds((current: string[]) => current.filter(id => id != vault.id));
  }
};

export let providerConfigVaultsOverviewTable = new DashboardTable<
  ProviderConfigVaultsOverviewTableProps,
  ProviderConfigVaultRow
>('provider-config-vaults-overview')
  .state(providerConfigVaultsOverviewState)
  .hookState(useProviderConfigVaultsOverviewHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: row => (
        <div>
          <Text size="2" weight="strong">
            {row.name}
          </Text>
          {row.description && (
            <Text size="1" color="gray600">
              {row.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'provider',
      isDefault: true,
      header: 'Provider',
      render: row => <Text size="2">{row.providerName ?? row.providerId ?? '—'}</Text>
    },
    {
      id: 'deployment',
      isDefault: true,
      header: 'Deployment',
      render: row => <Text size="2">{row.deployment?.name ?? '—'}</Text>
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: row => (
        <Badge color={getProviderConfigVaultStatusColor(row.status)}>{row.status}</Badge>
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
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: row => <RenderDate date={row.updatedAt} />
    },
    {
      id: 'providerId',
      isDefault: false,
      header: 'Provider ID',
      render: row => <ID id={row.providerId} />
    },
    {
      id: 'deploymentId',
      isDefault: false,
      header: 'Deployment ID',
      render: row =>
        row.deployment?.id ? (
          <ID id={row.deployment.id} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
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
      label: 'Vault ID',
      description: 'Filter by vault ID',
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
      id: 'providerDeploymentId',
      fields: ['providerDeploymentId'],
      label: 'Deployment ID',
      description: 'Filter by deployment ID',
      type: 'string'
    },
    {
      id: 'providerConfigId',
      fields: ['providerConfigId'],
      label: 'Config ID',
      description: 'Filter by config ID',
      type: 'string'
    },
    {
      id: 'providerConfigVaultId',
      fields: ['providerConfigVaultId'],
      label: 'Vault Ref ID',
      description: 'Filter by vault ref ID',
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
  .search('Search config vaults...')
  .link((row, props) =>
    withFromDeployment(
      Paths.instance.providerConfigVault(
        props.organization.data,
        props.project.data,
        props.instance.data,
        row.id
      ),
      props.fromDeploymentId
    )
  )
  .actions({
    deleteImmediate: async (vaults, state) => {
      let vault = vaults[0];
      if (!vault) return;

      await deleteProviderConfigVaultImmediately(vault, state);
    },
    delete: async (vaults, state) => {
      let vault = vaults[0];
      if (!vault) return;

      confirm({
        title: 'Delete config vault',
        description: `Are you sure you want to delete ${vault.name ?? 'this config vault'}?`,
        confirmText: 'Delete',
        onConfirm: async () => {
          await deleteProviderConfigVaultImmediately(vault, state);
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

export let ProviderConfigVaultsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return renderWithLoader({ organization, project, instance })(() =>
    providerConfigVaultsOverviewTable({
      instanceId: instance.data!.id,
      organization,
      project,
      instance,
      emptyState: () => (
        <EmptyState
          title="Create your first config vault"
          description="Vaults store reusable secret or shared provider values for this instance."
          action={{
            label: 'Create Config Vault',
            onClick: () => {
              if (instance.data?.id) {
                showCreateProviderConfigVaultFlow(instance.data.id);
              }
            }
          }}
        />
      )
    })
  );
};
