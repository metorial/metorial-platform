import { col, createDataList, defineAction } from '@metorial/data-list';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationPreview,
  IntegrationProvider,
  useAllCallbackInstances,
  useDeleteIntegrationProvider,
  useIntegrationInstanceProviders,
  useIntegrationProviders
} from '@metorial/state';
import { Badge, Flex, Spacer, Text } from '@metorial/ui';
import { ProviderImage } from '@metorial/ui-product';
import { RiDeleteBinLine, RiLinkM, RiSettings3Line } from '@remixicon/react';
import { Fragment, useMemo } from 'react';
import { CallbackSyncBadge, CallbackSyncErrorCallout } from '../callbacks/shared';
import { showAdminSetupLinkModal, supportsAdminSetup } from './adminSetupLinkModal';
import {
  getProviderDisplayName,
  getProviderLabel,
  type ProviderListingLookup,
  useIntegrationProviderListingLookup
} from './providerLabels';
import {
  showIntegrationInstanceProviderPanelFlow,
  showIntegrationProviderPanelFlow
} from './providerPanelFlow';

let getConfigLabel = (config?: any | null) => config?.name ?? config?.id;

let getAuthLabel = (
  integrationProvider: IntegrationProvider,
  instanceProvider?: IntegrationInstanceProvider
) =>
  instanceProvider?.authConfig?.name ??
  instanceProvider?.authConfig?.id ??
  integrationProvider.authMethod?.name ??
  integrationProvider.authCredentials?.id;

type IntegrationProvidersTableProps = {
  instanceId: string;
  integration: IntegrationPreview;
  listingLookup: ProviderListingLookup;
  onComplete?: () => void;
};

let openIntegrationProviderPanel = (
  provider: IntegrationProvider,
  props: IntegrationProvidersTableProps
) =>
  showIntegrationProviderPanelFlow({
    integration: props.integration,
    integrationProvider: provider,
    onComplete: props.onComplete ?? (() => {})
  });

let IntegrationProvidersTable = createDataList<IntegrationProvidersTableProps>(
  'integration-providers',
  { customizable: false }
)
  .paginated(({ props }) =>
    useIntegrationProviders(props.instanceId, {
      integrationId: props.integration.id,
      order: 'desc'
    })
  )
  .columns([
    col.custom({
      id: 'provider',
      header: 'Provider',
      render: (provider, props) => {
        let listing = props.listingLookup[provider.provider.id];
        let providerName = listing?.name ?? getProviderLabel(provider);

        return (
          <Flex gap={10} align="center">
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
    }),
    col.custom({
      id: 'callbacks',
      header: 'Callbacks',
      render: provider =>
        provider.callbacks.status !== 'enabled' ? (
          <Text size="2" color="gray600">
            Off
          </Text>
        ) : !provider.callbacks.callback ? (
          <Badge color="orange">Registering</Badge>
        ) : (
          <CallbackSyncBadge sync={provider.callbacks.callback.sync} />
        )
    })
  ])
  .clickable(openIntegrationProviderPanel)
  .itemActions([
    defineAction({
      id: 'configure',
      label: 'Configure',
      icon: <RiSettings3Line />,
      useRun:
        ({ props }) =>
        async provider => {
          openIntegrationProviderPanel(provider, props);
        }
    }),
    defineAction({
      id: 'admin_setup_link',
      label: 'Create Admin Setup Link',
      icon: <RiLinkM />,
      hidden: provider => !supportsAdminSetup(provider),
      useRun:
        ({ props }) =>
        async provider => {
          showAdminSetupLinkModal({
            instanceId: props.instanceId,
            integrationProvider: provider,
            providerName:
              props.listingLookup[provider.provider.id]?.name ?? getProviderLabel(provider)
          });
        }
    }),
    defineAction({
      id: 'remove',
      label: 'Remove',
      icon: <RiDeleteBinLine />,
      destructive: true,
      confirm: {
        title: 'Remove Provider',
        confirmText: 'Remove',
        description: rows =>
          `Remove the ${getProviderLabel(rows[0]!)} provider from this integration?`
      },
      useRun: ({ props }) => {
        let deleteProvider = useDeleteIntegrationProvider();

        return async provider => {
          let [result, error] = await deleteProvider.mutate({
            instanceId: props.instanceId,
            integrationProviderId: provider.id
          });
          if (!result || error) throw error ?? new Error('Failed to remove provider');

          props.onComplete?.();
        };
      }
    })
  ])
  .build();

export let IntegrationProvidersManager = (p: {
  instanceId: string;
  integration: IntegrationPreview;
  onComplete?: () => void;
}) => {
  let { listings, lookup } = useIntegrationProviderListingLookup(
    p.instanceId,
    p.integration.providers
  );

  return renderWithLoader({
    ...(p.integration.providers.length > 0 ? { listings } : {})
  })(() => (
    <IntegrationProvidersTable
      instanceId={p.instanceId}
      integration={p.integration}
      listingLookup={lookup}
      onComplete={p.onComplete}
      hideToolbar
      listVariant="embedded"
      emptyState="No providers are attached to this integration yet."
    />
  ));
};

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
  listingLookup: ProviderListingLookup;
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
  props: IntegrationInstanceProvidersManagerProps
) => {
  if (isInstanceProviderConfigureDisabled(row)) return;

  showIntegrationInstanceProviderPanelFlow({
    integration: props.integration,
    integrationInstance: props.integrationInstance,
    integrationProvider: row.integrationProvider,
    instanceProvider: row.instanceProvider,
    onComplete: props.onComplete ?? (() => {})
  });
};

let IntegrationInstanceProvidersList =
  createDataList<IntegrationInstanceProvidersManagerProps>('integration-instance-providers', {
    customizable: false
  })
    .items(({ props }) => {
      let providers = useIntegrationInstanceProviders(props.instanceId, {
        integrationInstanceId: props.integrationInstance.id,
        status: ['active', 'archived']
      });

      let integrationProviders = props.integration.providers;
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
          instanceProvider: instanceProviderByIntegrationProviderId.get(
            integrationProvider.id
          ),
          integrationInstanceStatus: props.integrationInstance.status
        }));
      }, [integrationProviders, providerItems, props.integrationInstance.status]);

      return { items, isLoading: providers.isLoading, error: providers.error };
    })
    .columns([
      col.custom({
        id: 'provider',
        header: 'Provider',
        render: (row, props) => {
          let listing = props.listingLookup[row.integrationProvider.provider.id];
          let providerName = listing?.name ?? getProviderLabel(row.integrationProvider);

          return (
            <Flex gap={10} align="center">
              {isInstanceProviderPending(row) ? (
                <Badge size="2" color="orange">
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
      }),
      col.text({
        id: 'config',
        header: 'Config',
        get: row =>
          getConfigLabel(row.instanceProvider?.config ?? row.integrationProvider.config),
        fallback: 'None'
      }),
      col.text({
        id: 'auth',
        header: 'Auth',
        get: row => getAuthLabel(row.integrationProvider, row.instanceProvider),
        fallback: 'None'
      }),
      col.id({ header: 'Provider ID' })
    ])
    .clickable(openIntegrationInstanceProviderPanel)
    .itemActions([
      defineAction({
        id: 'configure',
        label: 'Configure',
        icon: <RiSettings3Line />,
        disabled: isInstanceProviderConfigureDisabled,
        useRun:
          ({ props }) =>
          async row => {
            openIntegrationInstanceProviderPanel(row, props);
          }
      })
    ])
    .build();

export let IntegrationInstanceProvidersManager = (p: {
  instanceId: string;
  integration: IntegrationPreview;
  integrationInstance: IntegrationInstance;
  onComplete?: () => void;
}) => {
  let integrationProviders = p.integration.providers;
  let { listings, lookup } = useIntegrationProviderListingLookup(
    p.instanceId,
    integrationProviders
  );
  let hasCallbacks = integrationProviders.some(
    provider => provider.callbacks.status === 'enabled'
  );
  let callbackInstances = useAllCallbackInstances(hasCallbacks ? p.instanceId : null, {
    integrationInstanceId: p.integrationInstance.id
  });

  let renderContent = () => {
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
          name: getProviderDisplayName(lookup, integrationProvider),
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
        <IntegrationInstanceProvidersList
          instanceId={p.instanceId}
          integration={p.integration}
          integrationInstance={p.integrationInstance}
          onComplete={p.onComplete}
          listingLookup={lookup}
          hideToolbar
          listVariant="embedded"
          emptyState="This integration does not have any providers yet."
        />
      </>
    );
  };

  if (integrationProviders.length === 0 && !hasCallbacks) {
    return renderContent();
  }

  return renderWithLoader({
    ...(integrationProviders.length > 0 ? { listings } : {}),
    ...(hasCallbacks ? { callbackInstances } : {})
  })(renderContent);
};
