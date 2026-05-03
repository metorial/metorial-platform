import { renderWithPagination } from '@metorial/data-hooks';
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
import { Button, Flex, Menu, RenderDate, Text, confirm } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { RiMore2Line } from '@remixicon/react';
import {
  showIntegrationInstanceProviderPanelFlow,
  showIntegrationProviderPanelFlow
} from './providerPanelFlow';

let getProviderLabel = (provider?: { provider?: any }) =>
  provider?.provider?.name ?? provider?.provider?.slug ?? 'Provider';

let getConfigLabel = (config?: any | null) => config?.name ?? config?.id ?? 'None';

export let IntegrationProvidersManager = (p: {
  instanceId: string;
  integration: IntegrationPreview;
}) => {
  let providers = useIntegrationProviders(p.instanceId, {
    integrationId: p.integration.id
  });
  let deleteProvider = useDeleteIntegrationProvider();

  return renderWithPagination(providers)(providers => (
    <>
      <Table
        headers={['Provider', 'Config', 'Auth', 'Created', '']}
        data={providers.data.items.map((provider: IntegrationProvider) => ({
          data: [
            <Flex direction="column" gap={2}>
              <Text size="2" weight="strong">
                {getProviderLabel(provider)}
              </Text>
              <ID id={provider.id} />
            </Flex>,
            <Text size="2">{getConfigLabel(provider.config)}</Text>,
            <Text size="2">
              {provider.authMethod?.name ?? provider.authCredentials?.id ?? 'None'}
            </Text>,
            provider.createdAt ? <RenderDate date={provider.createdAt} /> : null,
            <div
              onClick={event => {
                event.stopPropagation();
                event.preventDefault();
              }}
            >
              <Menu
                items={[
                  { id: 'edit', label: 'Edit' },
                  { id: 'delete', label: 'Delete' }
                ]}
                onItemClick={id => {
                  if (id === 'edit') {
                    showIntegrationProviderPanelFlow({
                      integration: p.integration,
                      integrationProvider: provider,
                      onComplete: () => providers.refetch()
                    });
                  }

                  if (id === 'delete') {
                    confirm({
                      title: 'Remove provider',
                      description: `Remove ${getProviderLabel(provider)} from this integration?`,
                      confirmText: 'Remove',
                      onConfirm: async () => {
                        await deleteProvider.mutate({
                          instanceId: p.instanceId,
                          integrationProviderId: provider.id
                        });
                        providers.refetch();
                      }
                    });
                  }
                }}
              >
                <Button variant="outline" size="1" iconLeft={<RiMore2Line />} />
              </Menu>
            </div>
          ]
        }))}
      />

      {providers.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No providers are attached to this integration yet.
        </Text>
      )}
    </>
  ));
};

export let IntegrationInstanceProvidersManager = (p: {
  instanceId: string;
  integration: IntegrationPreview;
  integrationInstance: IntegrationInstance;
}) => {
  let providers = useIntegrationInstanceProviders(p.instanceId, {
    integrationInstanceId: p.integrationInstance.id,
    status: ['active', 'archived']
  });
  let deleteProvider = useDeleteIntegrationInstanceProvider();
  let integrationProviders = p.integration.providers ?? [];

  return renderWithPagination(providers)(providers => {
    let instanceProviderByIntegrationProviderId = new Map(
      providers.data.items.map((provider: IntegrationInstanceProvider) => [
        provider.integrationProvider.id,
        provider
      ])
    );
    let rows = integrationProviders.map(integrationProvider => {
      let instanceProvider = instanceProviderByIntegrationProviderId.get(
        integrationProvider.id
      );
      return { integrationProvider, instanceProvider };
    });

    return (
      <>
        <Table
          headers={['Provider', 'Instance Config', 'Auth', 'Updated', '']}
          data={rows.map(({ integrationProvider, instanceProvider }) => ({
            data: [
              <Flex direction="column" gap={2}>
                <Text size="2" weight="strong">
                  {getProviderLabel(integrationProvider)}
                </Text>
                <ID id={integrationProvider.id} />
              </Flex>,
              <Text size="2">
                {getConfigLabel(instanceProvider?.config ?? integrationProvider.config)}
              </Text>,
              <Text size="2">
                {instanceProvider?.authConfig?.id ??
                  integrationProvider.authMethod?.name ??
                  'None'}
              </Text>,
              instanceProvider?.updatedAt ? (
                <RenderDate date={instanceProvider.updatedAt} />
              ) : (
                <Text size="2" color="gray600">
                  Not set
                </Text>
              ),
              <div
                onClick={event => {
                  event.stopPropagation();
                  event.preventDefault();
                }}
              >
                <Menu
                  items={[
                    { id: 'edit', label: instanceProvider ? 'Edit' : 'Set up' },
                    ...(instanceProvider ? [{ id: 'delete', label: 'Delete' }] : [])
                  ]}
                  onItemClick={id => {
                    if (id === 'edit') {
                      showIntegrationInstanceProviderPanelFlow({
                        integration: p.integration,
                        integrationInstance: p.integrationInstance,
                        integrationProvider,
                        instanceProvider,
                        onComplete: () => providers.refetch()
                      });
                    }

                    if (id === 'delete' && instanceProvider) {
                      confirm({
                        title: 'Remove instance provider',
                        description: `Remove ${getProviderLabel(
                          integrationProvider
                        )} from this integration instance?`,
                        confirmText: 'Remove',
                        onConfirm: async () => {
                          await deleteProvider.mutate({
                            instanceId: p.instanceId,
                            integrationInstanceProviderId: instanceProvider.id
                          });
                          providers.refetch();
                        }
                      });
                    }
                  }}
                >
                  <Button variant="outline" size="1" iconLeft={<RiMore2Line />} />
                </Menu>
              </div>
            ]
          }))}
        />

        {rows.length === 0 && (
          <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
            This integration does not have any providers yet.
          </Text>
        )}
      </>
    );
  });
};
