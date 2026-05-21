import { renderWithLoader } from '@metorial/data-hooks';
import {
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationPreview,
  IntegrationProvider,
  useDeleteIntegrationProvider,
  useIntegrationInstanceProviders,
  useIntegrationProviders,
  useProviderListings
} from '@metorial/state';
import { Avatar, Badge, Flex, RenderDate, Text, confirm } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine, RiSettings3Line } from '@remixicon/react';
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

let getAuthLabel = (
  integrationProvider: IntegrationProvider,
  instanceProvider?: IntegrationInstanceProvider
) =>
  instanceProvider?.authConfig?.name ??
  instanceProvider?.authConfig?.id ??
  integrationProvider.authMethod?.name ??
  integrationProvider.authCredentials?.id ??
  'None';

let getProviderStatusColor = (status: IntegrationProvider['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

type ProviderListingLookup = Record<string, { name: string; imageUrl: string }>;

type IntegrationProvidersManagerProps = {
  instanceId: string;
  integration: IntegrationPreview;
  onComplete?: () => void;
  listingLookup?: ProviderListingLookup;
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
    onComplete: props.onComplete,
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
    state.onComplete?.();
  } finally {
    state.setLoadingIds(current => current.filter(id => id !== provider.id));
  }
};

let integrationProvidersTable = new DashboardTable<
  IntegrationProvidersManagerProps,
  IntegrationProvider
>('integration-providers', { hasPagination: false })
  .state(useIntegrationProvidersTableState)
  .hookState(useIntegrationProvidersTableHookState)
  .columns([
    {
      id: 'provider',
      isDefault: true,
      header: 'Provider',
      render: (provider: IntegrationProvider, props: IntegrationProvidersManagerProps) => {
        let listing = props.listingLookup?.[provider.provider.id];
        let providerName = listing?.name ?? getProviderLabel(provider);

        return (
          <Flex gap={10} style={{ alignItems: 'center' }}>
            <Avatar
              entity={{ name: providerName, photoUrl: listing?.imageUrl }}
              size={24}
              radius={6}
              noTooltip
              imageFit="contain"
            />
            <Text size="2" weight="strong">
              {providerName}
            </Text>
          </Flex>
        );
      }
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
      onComplete: props.onComplete ?? (() => {})
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
        title: `Remove ${getProviderLabel(provider)}?`,
        description: `Remove the ${getProviderLabel(provider)} provider from this integration?`,
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

export let IntegrationProvidersManager = (p: {
  instanceId: string;
  integration: IntegrationPreview;
  onComplete?: () => void;
}) => {
  let providerIds = useMemo(
    () => [...new Set((p.integration.providers ?? []).map(item => item.provider.id))],
    [p.integration.providers]
  );
  let listings = useProviderListings(
    p.instanceId,
    providerIds.length > 0 ? { id: providerIds, limit: 100 } : null
  );

  let renderTable = (listingLookup: ProviderListingLookup) =>
    integrationProvidersTable({
      instanceId: p.instanceId,
      integration: p.integration,
      onComplete: p.onComplete,
      listingLookup,
      emptyState: 'No providers are attached to this integration yet.'
    });

  if (providerIds.length === 0) {
    return renderTable({});
  }

  return renderWithLoader({ listings })(() => {
    let listingLookup: ProviderListingLookup = {};

    for (let listing of listings.data?.items ?? []) {
      listingLookup[listing.provider.id] = {
        name: listing.name ?? listing.provider.name,
        imageUrl: listing.imageUrl
      };
    }

    return renderTable(listingLookup);
  });
};

type InstanceProviderRow = {
  id: string;
  integrationProvider: IntegrationProvider;
  instanceProvider: IntegrationInstanceProvider | undefined;
  integrationInstanceStatus: IntegrationInstance['status'];
};

type IntegrationInstanceProvidersManagerProps = {
  instanceId: string;
  integration: IntegrationPreview;
  integrationInstance: IntegrationInstance;
  onComplete?: () => void;
  listingLookup?: ProviderListingLookup;
};

let isInstanceProviderConfigureDisabled = (row: InstanceProviderRow) => {
  if (
    row.integrationInstanceStatus === 'archived' ||
    row.integrationInstanceStatus === 'deleted'
  ) {
    return true;
  }

  if (
    row.integrationInstanceStatus === 'active' &&
    !row.instanceProvider?.config &&
    !row.instanceProvider?.authConfig
  ) {
    return true;
  }

  return false;
};

let openIntegrationInstanceProviderPanel = (
  row: InstanceProviderRow,
  state: ReturnType<typeof useIntegrationInstanceProvidersTableHookState>
) => {
  if (isInstanceProviderConfigureDisabled(row)) return;

  showIntegrationInstanceProviderPanelFlow({
    integration: state.integration,
    integrationInstance: state.integrationInstance,
    integrationProvider: row.integrationProvider,
    instanceProvider: row.instanceProvider,
    onComplete: state.onComplete ?? (() => {})
  });
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
      instanceProvider: instanceProviderByIntegrationProviderId.get(integrationProvider.id),
      integrationInstanceStatus: props.integrationInstance.status
    }));
  }, [integrationProviders, providerItems, props.integrationInstance.status]);

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
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    instanceId: props.instanceId,
    integration: props.integration,
    integrationInstance: props.integrationInstance,
    onComplete: props.onComplete,
    loadingIds,
    setLoadingIds
  };
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
      render: (row: InstanceProviderRow, props: IntegrationInstanceProvidersManagerProps) => {
        let listing = props.listingLookup?.[row.integrationProvider.provider.id];
        let providerName = listing?.name ?? getProviderLabel(row.integrationProvider);

        return (
          <Flex gap={10} style={{ alignItems: 'center' }}>
            <Avatar
              entity={{ name: providerName, photoUrl: listing?.imageUrl }}
              size={24}
              radius={6}
              noTooltip
              imageFit="contain"
            />
            <Text size="2" weight="strong">
              {providerName}
            </Text>
          </Flex>
        );
      }
    },
    {
      id: 'config',
      isDefault: true,
      header: 'Config',
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
        <Text size="2">{getAuthLabel(row.integrationProvider, row.instanceProvider)}</Text>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: (row: InstanceProviderRow) => {
        if (row.instanceProvider) {
          return <Badge color="green">Configured</Badge>;
        }

        if (row.integrationInstanceStatus === 'draft') {
          return <Badge color="orange">Pending</Badge>;
        }

        return <Badge color="gray">Inherited</Badge>;
      }
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
    if (isInstanceProviderConfigureDisabled(row)) return;

    showIntegrationInstanceProviderPanelFlow({
      integration: props.integration,
      integrationInstance: props.integrationInstance,
      integrationProvider: row.integrationProvider,
      instanceProvider: row.instanceProvider,
      onComplete: props.onComplete ?? (() => {})
    });
  }) as any)
  .actions({
    configure: async (rows, state) => {
      let row = rows[0];
      if (!row) return;

      openIntegrationInstanceProviderPanel(row, state);
    }
  })
  .rowActions([
    {
      id: 'configure',
      label: 'Configure',
      icon: <RiSettings3Line />,
      action: 'configure',
      disabled: isInstanceProviderConfigureDisabled
    }
  ])
  .build();

export let IntegrationInstanceProvidersManager = (p: {
  instanceId: string;
  integration: IntegrationPreview;
  integrationInstance: IntegrationInstance;
  onComplete?: () => void;
}) => {
  let providerIds = useMemo(
    () => [...new Set((p.integration.providers ?? []).map(item => item.provider.id))],
    [p.integration.providers]
  );
  let listings = useProviderListings(
    p.instanceId,
    providerIds.length > 0 ? { id: providerIds, limit: 100 } : null
  );

  let renderTable = (listingLookup: ProviderListingLookup) =>
    integrationInstanceProvidersTable({
      instanceId: p.instanceId,
      integration: p.integration,
      integrationInstance: p.integrationInstance,
      onComplete: p.onComplete,
      listingLookup,
      emptyState: 'This integration does not have any providers yet.'
    });

  if (providerIds.length === 0) {
    return renderTable({});
  }

  return renderWithLoader({ listings })(() => {
    let listingLookup: ProviderListingLookup = {};

    for (let listing of listings.data?.items ?? []) {
      listingLookup[listing.provider.id] = {
        name: listing.name ?? listing.provider.name,
        imageUrl: listing.imageUrl
      };
    }

    return renderTable(listingLookup);
  });
};
