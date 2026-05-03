import {
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationPreview,
  IntegrationProvider,
  useDeleteIntegrationInstanceProvider,
  useDeleteIntegrationProvider,
  useIntegrationInstanceProviders,
  useIntegrationProviders
} from '@metorial/state';
import { Badge, RenderDate, Text, confirm } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine } from '@remixicon/react';
import { useMemo, useState } from 'react';
import { Table as DashboardTable } from '../../../../components/table';
import { FilterPayload } from '../../../../components/table/filter';
import { getEnumListFilterValue, getStringFilterValue } from '../../../../lib/dataTableUtils';
import {
  showIntegrationInstanceProviderPanelFlow,
  showIntegrationProviderPanelFlow
} from './providerPanelFlow';

let getProviderLabel = (provider?: { provider?: any }) =>
  provider?.provider?.name ?? provider?.provider?.slug ?? 'Provider';

let getConfigLabel = (config?: any | null) => config?.name ?? config?.id ?? 'None';

let getProviderStatusColor = (status: IntegrationProvider['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

type IntegrationProvidersManagerProps = {
  instanceId: string;
  integration: IntegrationPreview;
};

let getProviderStatusFilterValue = (value: FilterPayload | undefined) =>
  getEnumListFilterValue(value, ['active', 'archived', 'deleted']);

let useIntegrationProvidersTableState = (
  props: IntegrationProvidersManagerProps,
  opts: { filter: Record<string, FilterPayload>; search?: string }
) => {
  let providers = useIntegrationProviders(props.instanceId, {
    integrationId: props.integration.id,
    order: 'desc',
    status: getProviderStatusFilterValue(opts.filter.status),
    id: getStringFilterValue(opts.filter.id),
    providerId: getStringFilterValue(opts.filter.providerId),
    search: opts.search
  });

  return {
    isLoading: providers.isLoading,
    error: providers.error,
    hasMoreAfter: providers.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: providers.data?.pagination.hasMoreBefore ?? false,
    items: providers.data?.items ?? [],
    loadNext: providers.next,
    loadPrevious: providers.previous
  };
};

let useIntegrationProvidersTableHookState = (
  _: ReturnType<typeof useIntegrationProvidersTableState>,
  props: IntegrationProvidersManagerProps
) => {
  let deleteProvider = useDeleteIntegrationProvider();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteProvider,
    instanceId: props.instanceId,
    integration: props.integration,
    loadingIds,
    setLoadingIds
  };
};

let deleteIntegrationProviderImmediately = async (
  provider: IntegrationProvider,
  state: ReturnType<typeof useIntegrationProvidersTableHookState>
) => {
  state.setLoadingIds(current => [...new Set([...current, provider.id])]);

  try {
    await state.deleteProvider.mutate({
      instanceId: state.instanceId,
      integrationProviderId: provider.id
    });
  } finally {
    state.setLoadingIds(current => current.filter(id => id !== provider.id));
  }
};

let integrationProvidersTable = new DashboardTable<
  IntegrationProvidersManagerProps,
  IntegrationProvider
>('integration-providers')
  .state(useIntegrationProvidersTableState)
  .hookState(useIntegrationProvidersTableHookState)
  .columns([
    {
      id: 'provider',
      isDefault: true,
      header: 'Provider',
      render: (provider: IntegrationProvider) => (
        <Text size="2" weight="strong">
          {getProviderLabel(provider)}
        </Text>
      )
    },
    {
      id: 'config',
      isDefault: true,
      header: 'Config',
      render: (provider: IntegrationProvider) => (
        <Text size="2">{getConfigLabel(provider.config)}</Text>
      )
    },
    {
      id: 'auth',
      isDefault: true,
      header: 'Auth',
      render: (provider: IntegrationProvider) => (
        <Text size="2">
          {provider.authMethod?.name ?? provider.authCredentials?.id ?? 'None'}
        </Text>
      )
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: (provider: IntegrationProvider) => (
        <Badge color={getProviderStatusColor(provider.status)}>{provider.status}</Badge>
      )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: (provider: IntegrationProvider) => <RenderDate date={provider.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: (provider: IntegrationProvider) => <RenderDate date={provider.updatedAt} />
    },
    {
      id: 'id',
      isDefault: true,
      header: 'ID',
      render: (provider: IntegrationProvider) => <ID id={provider.id} />
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
        { id: 'archived', label: 'Archived' },
        { id: 'deleted', label: 'Deleted' }
      ]
    },
    {
      id: 'id',
      fields: ['id'],
      label: 'Provider ID',
      description: 'Filter by provider ID',
      type: 'string'
    },
    {
      id: 'providerId',
      fields: ['providerId'],
      label: 'Source Provider ID',
      description: 'Filter by source provider ID',
      type: 'string'
    }
  ])
  .search('Search integration providers...')
  .clickable(((provider: IntegrationProvider, props: IntegrationProvidersManagerProps) => {
    showIntegrationProviderPanelFlow({
      integration: props.integration,
      integrationProvider: provider,
      onComplete: () => {}
    });
  }) as any)
  .actions({
    deleteImmediate: async (providers, state) => {
      let provider = providers[0];
      if (!provider) return;

      await deleteIntegrationProviderImmediately(provider, state);
    },
    delete: async (providers, state) => {
      let provider = providers[0];
      if (!provider) return;

      confirm({
        title: 'Remove Provider',
        description: `Remove ${getProviderLabel(provider)} from this integration?`,
        confirmText: 'Remove',
        onConfirm: async () => {
          await deleteIntegrationProviderImmediately(provider, state);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'delete',
      label: 'Remove',
      icon: <RiDeleteBinLine />,
      action: 'delete'
    }
  ])
  .bulkActions([
    {
      id: 'delete-selected',
      label: 'Remove',
      icon: <RiDeleteBinLine />,
      action: 'deleteImmediate',
      bulkExecution: {
        mode: 'per-row',
        batchSize: 5
      }
    }
  ])
  .build();

export let IntegrationProvidersManager = (p: IntegrationProvidersManagerProps) => {
  return integrationProvidersTable({
    instanceId: p.instanceId,
    integration: p.integration,
    emptyState: 'No providers are attached to this integration yet.'
  });
};

type InstanceProviderRow = {
  id: string;
  integrationProvider: IntegrationProvider;
  instanceProvider: IntegrationInstanceProvider | undefined;
};

type IntegrationInstanceProvidersManagerProps = {
  instanceId: string;
  integration: IntegrationPreview;
  integrationInstance: IntegrationInstance;
};

let useIntegrationInstanceProvidersTableState = (
  props: IntegrationInstanceProvidersManagerProps
) => {
  let providers = useIntegrationInstanceProviders(props.instanceId, {
    integrationInstanceId: props.integrationInstance.id,
    status: ['active', 'archived']
  });

  let integrationProviders = props.integration.providers ?? [];
  let providerItems = providers.data?.items;

  let items = useMemo<InstanceProviderRow[]>(() => {
    let instanceProviderByIntegrationProviderId = new Map(
      (providerItems ?? []).map(
        (provider: IntegrationInstanceProvider) =>
          [provider.integrationProvider.id, provider] as const
      )
    );

    return integrationProviders.map(integrationProvider => ({
      id: integrationProvider.id,
      integrationProvider: integrationProvider as IntegrationProvider,
      instanceProvider: instanceProviderByIntegrationProviderId.get(integrationProvider.id)
    }));
  }, [integrationProviders, providerItems]);

  return {
    isLoading: providers.isLoading,
    error: providers.error,
    hasMoreAfter: false,
    hasMoreBefore: false,
    items,
    loadNext: () => {},
    loadPrevious: () => {}
  };
};

let useIntegrationInstanceProvidersTableHookState = (
  _: ReturnType<typeof useIntegrationInstanceProvidersTableState>,
  props: IntegrationInstanceProvidersManagerProps
) => {
  let deleteProvider = useDeleteIntegrationInstanceProvider();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteProvider,
    instanceId: props.instanceId,
    integration: props.integration,
    integrationInstance: props.integrationInstance,
    loadingIds,
    setLoadingIds
  };
};

let deleteIntegrationInstanceProviderImmediately = async (
  row: InstanceProviderRow,
  state: ReturnType<typeof useIntegrationInstanceProvidersTableHookState>
) => {
  let provider = row.instanceProvider;
  if (!provider) return;

  state.setLoadingIds(current => [...new Set([...current, row.id])]);

  try {
    await state.deleteProvider.mutate({
      instanceId: state.instanceId,
      integrationInstanceProviderId: provider.id
    });
  } finally {
    state.setLoadingIds(current => current.filter(id => id !== row.id));
  }
};

let integrationInstanceProvidersTable = new DashboardTable<
  IntegrationInstanceProvidersManagerProps,
  InstanceProviderRow
>('integration-instance-providers', { hasPagination: false, customizable: false })
  .state(useIntegrationInstanceProvidersTableState)
  .hookState(useIntegrationInstanceProvidersTableHookState)
  .columns([
    {
      id: 'provider',
      isDefault: true,
      header: 'Provider',
      render: (row: InstanceProviderRow) => (
        <Text size="2" weight="strong">
          {getProviderLabel(row.integrationProvider)}
        </Text>
      )
    },
    {
      id: 'config',
      isDefault: true,
      header: 'Instance Config',
      render: (row: InstanceProviderRow) => (
        <Text size="2">
          {getConfigLabel(row.instanceProvider?.config ?? row.integrationProvider.config)}
        </Text>
      )
    },
    {
      id: 'auth',
      isDefault: true,
      header: 'Auth',
      render: (row: InstanceProviderRow) => (
        <Text size="2">
          {row.instanceProvider?.authConfig?.id ??
            row.integrationProvider.authMethod?.name ??
            'None'}
        </Text>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: (row: InstanceProviderRow) =>
        row.instanceProvider ? (
          <Badge color="green">Configured</Badge>
        ) : (
          <Badge color="gray">Not set</Badge>
        )
    },
    {
      id: 'updatedAt',
      isDefault: true,
      header: 'Updated',
      render: (row: InstanceProviderRow) =>
        row.instanceProvider?.updatedAt ? (
          <RenderDate date={row.instanceProvider.updatedAt} />
        ) : (
          <Text size="2" color="gray600">
            Not set
          </Text>
        )
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Provider ID',
      render: (row: InstanceProviderRow) => <ID id={row.integrationProvider.id} />
    }
  ] as any)
  .clickable(((row: InstanceProviderRow, props: IntegrationInstanceProvidersManagerProps) => {
    showIntegrationInstanceProviderPanelFlow({
      integration: props.integration,
      integrationInstance: props.integrationInstance,
      integrationProvider: row.integrationProvider,
      instanceProvider: row.instanceProvider,
      onComplete: () => {}
    });
  }) as any)
  .actions({
    delete: async (rows, state) => {
      let row = rows[0];
      if (!row?.instanceProvider) return;

      confirm({
        title: 'Remove instance provider',
        description: `Remove ${getProviderLabel(
          row.integrationProvider
        )} from this integration instance?`,
        confirmText: 'Remove',
        onConfirm: async () => {
          await deleteIntegrationInstanceProviderImmediately(row, state);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'delete',
      label: 'Remove',
      icon: <RiDeleteBinLine />,
      disabled: row => !row.instanceProvider,
      action: 'delete'
    }
  ])
  .build();

export let IntegrationInstanceProvidersManager = (
  p: IntegrationInstanceProvidersManagerProps
) => {
  return integrationInstanceProvidersTable({
    instanceId: p.instanceId,
    integration: p.integration,
    integrationInstance: p.integrationInstance,
    emptyState: 'This integration does not have any providers yet.'
  });
};
