import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationPreview,
  IntegrationProvider,
  useAllCallbackInstances,
  useDeleteIntegrationProvider,
  useIntegrationInstanceProviders,
  useIntegrationProviders,
  useProviderListings
} from '@metorial/state';
import { Table as DashboardTable } from '@metorial/table';
import { Badge, Button, Flex, Menu, Spacer, Text, confirm } from '@metorial/ui';
import { ID, ProviderImage, Table } from '@metorial/ui-product';
import { RiMore2Line, RiSettings3Line } from '@remixicon/react';
import { Fragment, useMemo, useState } from 'react';
import { CallbackSyncBadge, CallbackSyncErrorCallout } from '../callbacks/shared';
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

type ProviderListingLookup = Record<string, { name: string; imageUrl: string }>;

export let IntegrationProvidersManager = (p: {
  instanceId: string;
  integration: IntegrationPreview;
  onComplete?: () => void;
}) => {
  let providers = useIntegrationProviders(p.instanceId, {
    integrationId: p.integration.id,
    order: 'desc'
  });
  let deleteProvider = useDeleteIntegrationProvider();

  let providerIds = useMemo(
    () => [...new Set((p.integration.providers ?? []).map(item => item.provider.id))],
    [p.integration.providers]
  );
  let listings = useProviderListings(
    p.instanceId,
    providerIds.length > 0 ? { id: providerIds, limit: 100 } : null
  );

  let removeProvider = (provider: IntegrationProvider) => {
    confirm({
      title: `Remove ${getProviderLabel(provider)}?`,
      description: `Remove the ${getProviderLabel(provider)} provider from this integration?`,
      confirmText: 'Remove',
      onConfirm: async () => {
        let [result, error] = await deleteProvider.mutate({
          instanceId: p.instanceId,
          integrationProviderId: provider.id
        });
        if (!result || error) return;

        await providers.refetch();
        p.onComplete?.();
      }
    });
  };

  return renderWithLoader({ listings })(() => {
    let listingLookup: ProviderListingLookup = {};

    for (let listing of listings.data?.items ?? []) {
      listingLookup[listing.provider.id] = {
        name: listing.name ?? listing.provider.name,
        imageUrl: listing.imageUrl
      };
    }

    return (
      <IntegrationProvidersTable
        providers={providers}
        integration={p.integration}
        listingLookup={listingLookup}
        onComplete={p.onComplete}
        removeProvider={removeProvider}
      />
    );
  });
};

let IntegrationProvidersTable = (p: {
  providers: ReturnType<typeof useIntegrationProviders>;
  integration: IntegrationPreview;
  listingLookup: ProviderListingLookup;
  onComplete?: () => void;
  removeProvider: (provider: IntegrationProvider) => void;
}) =>
  renderWithPagination(p.providers, { hidePaginationWhenUnavailable: true })(providers => (
    <>
      <Table
        headers={['Provider', 'Callbacks', '']}
        data={providers.data.items.map(provider => {
          let listing = p.listingLookup[provider.provider.id];
          let providerName = listing?.name ?? getProviderLabel(provider);
          let openConfigure = () =>
            showIntegrationProviderPanelFlow({
              integration: p.integration,
              integrationProvider: provider,
              onComplete: p.onComplete ?? (() => {})
            });

          return {
            onClick: openConfigure,
            data: [
              <Flex gap={10} style={{ alignItems: 'center' }}>
                <ProviderImage
                  imageUrl={listing?.imageUrl}
                  alt={providerName}
                  size={24}
                  radius={6}
                />
                <Text size="2" weight="strong">
                  {providerName}
                </Text>
              </Flex>,
              provider.callbacks.status !== 'enabled' ? (
                <Text size="2" color="gray600">
                  Off
                </Text>
              ) : !provider.callbacks.callback ? (
                <Badge color="orange">Registering</Badge>
              ) : (
                <CallbackSyncBadge sync={provider.callbacks.callback.sync} />
              ),
              <Flex style={{ width: '100%' }} justify="end">
                <Menu
                  items={[
                    { id: 'configure', label: 'Configure' },
                    { id: 'remove', label: 'Remove' }
                  ]}
                  onItemClick={id => {
                    if (id === 'configure') openConfigure();
                    if (id === 'remove') p.removeProvider(provider);
                  }}
                >
                  <Button
                    size="1"
                    variant="outline"
                    iconRight={<RiMore2Line />}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  />
                </Menu>
              </Flex>
            ]
          };
        })}
      />

      {providers.data.items.length === 0 ? (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No providers are attached to this integration yet.
        </Text>
      ) : null}
    </>
  ));

type InstanceProviderRow = {
  id: string;
  integrationProvider: IntegrationProvider;
  instanceProvider: IntegrationInstanceProvider | undefined;
  integrationInstanceStatus: IntegrationInstance['status'];
};

let isInstanceProviderPending = (row: InstanceProviderRow) =>
  !row.instanceProvider && row.integrationInstanceStatus === 'draft';

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
          <Flex gap={10} align="center">
            {isInstanceProviderPending(row) ? (
              <Badge size="1" color="orange">
                Pending
              </Badge>
            ) : null}
            <ProviderImage
              imageUrl={listing?.imageUrl}
              alt={providerName}
              size={24}
              radius={6}
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
  let integrationProviders = p.integration.providers ?? [];
  let providerIds = useMemo(
    () => [...new Set(integrationProviders.map(item => item.provider.id))],
    [p.integration.providers]
  );
  let listings = useProviderListings(
    p.instanceId,
    providerIds.length > 0 ? { id: providerIds, limit: 100 } : null
  );
  let hasCallbacks = integrationProviders.some(
    provider => provider.callbacks.status === 'enabled'
  );
  let callbackInstances = useAllCallbackInstances(hasCallbacks ? p.instanceId : null, {
    integrationInstanceId: p.integrationInstance.id
  });

  let renderContent = (listingLookup: ProviderListingLookup) => {
    let callbackInstanceByCallbackId = new Map(
      (callbackInstances.data ?? []).map(
        callbackInstance => [callbackInstance.callbackId, callbackInstance] as const
      )
    );
    let failedCallbacks = integrationProviders.flatMap(integrationProvider => {
      if (integrationProvider.callbacks.status !== 'enabled') return [];

      let callbackInstance = integrationProvider.callbacks.callbackId
        ? callbackInstanceByCallbackId.get(integrationProvider.callbacks.callbackId)
        : undefined;
      if (callbackInstance?.sync.status !== 'failed') return [];

      return [
        {
          id: integrationProvider.id,
          name:
            listingLookup[integrationProvider.provider.id]?.name ??
            getProviderLabel(integrationProvider),
          sync: callbackInstance.sync
        }
      ];
    });

    return (
      <>
        {failedCallbacks.map((failed, index) => (
          <Fragment key={failed.id}>
            {index > 0 ? <Spacer height={10} /> : null}
            <CallbackSyncErrorCallout sync={failed.sync} providerName={failed.name} />
          </Fragment>
        ))}
        {failedCallbacks.length > 0 ? <Spacer height={15} /> : null}
        {integrationInstanceProvidersTable({
          instanceId: p.instanceId,
          integration: p.integration,
          integrationInstance: p.integrationInstance,
          onComplete: p.onComplete,
          listingLookup,
          emptyState: 'This integration does not have any providers yet.'
        })}
      </>
    );
  };

  if (providerIds.length === 0 && !hasCallbacks) {
    return renderContent({});
  }

  return renderWithLoader({
    ...(providerIds.length > 0 ? { listings } : {}),
    ...(hasCallbacks ? { callbackInstances } : {})
  })(() => {
    let listingLookup: ProviderListingLookup = {};

    for (let listing of listings.data?.items ?? []) {
      listingLookup[listing.provider.id] = {
        name: listing.name ?? listing.provider.name,
        imageUrl: listing.imageUrl
      };
    }

    return renderContent(listingLookup);
  });
};
