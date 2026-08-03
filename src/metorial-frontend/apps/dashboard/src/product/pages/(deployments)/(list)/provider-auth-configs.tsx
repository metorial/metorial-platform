import {
  DashboardInstanceProviderDeploymentsAuthConfigsListOutput,
  DashboardInstanceProviderDeploymentsAuthConfigsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteProviderAuthConfig,
  useProviderAuthConfigs,
  useProviders
} from '@metorial/state';
import { Badge, RenderDate, Text, confirm } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine } from '@remixicon/react';
import { useState } from 'react';
import { EmptyState } from '@metorial/empty-state';
import { Table as DashboardTable } from '@metorial/table';
import {
  FilterPayload,
  TableStateProvider,
  TableStateProviderResult,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue
} from '@metorial/table';
import { showCreateProviderAuthConfigFlow } from './providerCreationFlows';

type AuthConfigItem =
  DashboardInstanceProviderDeploymentsAuthConfigsListOutput['items'][number];

type AuthConfigRow = AuthConfigItem & {
  providerName?: string | null;
};

type AuthConfigFilters = Omit<
  DashboardInstanceProviderDeploymentsAuthConfigsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type ProviderAuthConfigsTableProps = {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
  filters?: AuthConfigFilters;
};

let formatType = (type: string | null | undefined) => {
  if (type === 'oauth_automated') return 'OAuth (Automated)';
  if (type === 'oauth_manual') return 'OAuth (Manual)';
  if (type === 'manual') return 'Manual';
  return '—';
};

let formatSource = (source: AuthConfigItem['source'] | null | undefined) => {
  if (source === 'manual') return 'Manual';
  if (source === 'setup_session') return 'Setup Session';
  if (source === 'system') return 'System';
  return '—';
};

let getStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceProviderDeploymentsAuthConfigsListQuery['status'] => {
  return getEnumListFilterValue(value, ['active', 'archived']);
};

let getAuthConfigStatusColor = (status: AuthConfigItem['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let providerAuthConfigsTableState: TableStateProvider<
  ProviderAuthConfigsTableProps,
  AuthConfigRow,
  TableStateProviderResult<AuthConfigRow>
> = (
  props: ProviderAuthConfigsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let authConfigs = useProviderAuthConfigs(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status: getStatusFilterValue(opts.filter.status) ?? props.filters?.status,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    providerId: getStringFilterValue(opts.filter.providerId) ?? props.filters?.providerId,
    providerDeploymentId:
      getStringFilterValue(opts.filter.providerDeploymentId) ??
      props.filters?.providerDeploymentId,
    providerAuthCredentialsId:
      getStringFilterValue(opts.filter.providerAuthCredentialsId) ??
      props.filters?.providerAuthCredentialsId,
    providerAuthMethodId:
      getStringFilterValue(opts.filter.providerAuthMethodId) ??
      props.filters?.providerAuthMethodId,
    search: opts.search ?? props.filters?.search,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt,
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt) ?? props.filters?.updatedAt
  });

  let providerIds = [
    ...new Set((authConfigs.data?.items ?? []).map(item => item.providerId).filter(Boolean))
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
    isLoading: authConfigs.isLoading || (shouldLoadProviders && providers.isLoading),
    error: authConfigs.error ?? (shouldLoadProviders ? providers.error : null),
    hasMoreAfter: authConfigs.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: authConfigs.data?.pagination.hasMoreBefore ?? false,
    items: (authConfigs.data?.items ?? []).map(item => ({
      ...item,
      providerName: providerNameMap.get(item.providerId) ?? null
    })),
    loadNext: authConfigs.next,
    loadPrevious: authConfigs.previous
  };
};

let useProviderAuthConfigsTableHookState = (
  _: ReturnType<typeof providerAuthConfigsTableState>,
  props: ProviderAuthConfigsTableProps
) => {
  let deleteAuthConfig = useDeleteProviderAuthConfig();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteAuthConfig,
    instanceId: props.instanceId,
    loadingIds,
    setLoadingIds
  };
};

let deleteProviderAuthConfigImmediately = async (
  authConfig: AuthConfigRow,
  state: ReturnType<typeof useProviderAuthConfigsTableHookState>
) => {
  state.setLoadingIds((current: string[]) => [...new Set([...current, authConfig.id])]);

  try {
    await state.deleteAuthConfig.mutate({
      instanceId: state.instanceId,
      providerAuthConfigId: authConfig.id
    });
  } finally {
    state.setLoadingIds((current: string[]) => current.filter(id => id != authConfig.id));
  }
};

export let providerAuthConfigsFilterTable = new DashboardTable<
  ProviderAuthConfigsTableProps,
  AuthConfigRow
>('provider-auth-configs-overview')
  .state(providerAuthConfigsTableState)
  .hookState(useProviderAuthConfigsTableHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: row => (
        <Text size="2" weight="strong">
          {row.name || '—'}
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
      render: row => <Text size="2">{row.deployment?.name ?? '—'}</Text>
    },
    {
      id: 'authMethod',
      isDefault: true,
      header: 'Auth Method',
      render: row => <Text size="2">{row.authMethod?.name ?? row.authMethod?.key ?? '—'}</Text>
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
      id: 'type',
      isDefault: false,
      header: 'Type',
      render: row => <Text size="2">{formatType(row.type)}</Text>
    },
    {
      id: 'source',
      isDefault: false,
      header: 'Source',
      render: row => <Text size="2">{formatSource(row.source)}</Text>
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: row => <Badge color={getAuthConfigStatusColor(row.status)}>{row.status}</Badge>
    },
    {
      id: 'default',
      isDefault: false,
      header: 'Default',
      render: row =>
        row.isDefault ? <Badge color="blue">Default</Badge> : <Text size="2">No</Text>
    },
    {
      id: 'credentials',
      isDefault: false,
      header: 'Credentials',
      render: row =>
        row.credentials?.id ? (
          <ID id={row.credentials.id} />
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
      label: 'Auth Config ID',
      description: 'Filter by auth config ID',
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
      id: 'providerAuthCredentialsId',
      fields: ['providerAuthCredentialsId'],
      label: 'Credentials ID',
      description: 'Filter by credentials ID',
      type: 'string'
    },
    {
      id: 'providerAuthMethodId',
      fields: ['providerAuthMethodId'],
      label: 'Auth Method ID',
      description: 'Filter by auth method ID',
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
  .search('Search auth configs...')
  .link((row, props) =>
    Paths.instance.providerAuthConfig(
      props.organization.data,
      props.project.data,
      props.instance.data,
      row.id
    )
  )
  .actions({
    deleteImmediate: async (authConfigs, state) => {
      let authConfig = authConfigs[0];
      if (!authConfig) return;

      await deleteProviderAuthConfigImmediately(authConfig, state);
    },
    delete: async (authConfigs, state) => {
      let authConfig = authConfigs[0];
      if (!authConfig) return;

      confirm({
        title: 'Delete auth config',
        description: `Are you sure you want to delete ${authConfig.name ?? 'this auth config'}?`,
        confirmText: 'Delete',
        onConfirm: async () => {
          await deleteProviderAuthConfigImmediately(authConfig, state);
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

export let ProviderAuthConfigsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return renderWithLoader({ organization, project, instance })(() =>
    providerAuthConfigsFilterTable({
      instanceId: instance.data!.id,
      organization,
      project,
      instance,
      emptyState: () => (
        <EmptyState
          title="Create your first auth config"
          description="Auth configs connect providers to the authentication settings your instance should use."
          action={{
            label: 'Create Auth Config',
            onClick: () => {
              if (instance.data?.id) {
                showCreateProviderAuthConfigFlow(instance.data.id, {
                  scope: 'provider'
                });
              }
            }
          }}
        />
      )
    })
  );
};
