import { DashboardInstanceMagicMcpServersProvidersListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCreateMagicMcpServerProvider,
  useCurrentInstance,
  useDeleteMagicMcpServerProvider,
  useMagicMcpServer,
  useMagicMcpServerProviders,
  useProviderAuthConfigs,
  useProviderDeployments,
  useProviderListings,
  useUpdateMagicMcpServerProvider
} from '@metorial/state';
import { Button, confirm, Flex, Menu, Text, toast } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { RiMore2Line } from '@remixicon/react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { showAddProviderSidePanel } from '../../../scenes/sessionTemplates/providersManager';

type MagicMcpServerProviderRow =
  DashboardInstanceMagicMcpServersProvidersListOutput['items'][number];

let getToolFilterSummary = (toolFilter: MagicMcpServerProviderRow['toolFilter']) => {
  if (!toolFilter || toolFilter.type === 'allow_all') return 'All tools';

  let selectedToolKeys = toolFilter.filters
    .filter(filter => filter.type === 'tool_keys')
    .flatMap(filter => filter.keys ?? []);

  if (selectedToolKeys.length === 0) return 'No tools';
  if (selectedToolKeys.length === 1) return '1 selected';
  return `${selectedToolKeys.length} selected`;
};

let MagicMcpServerProvidersTable = (p: {
  server: NonNullable<ReturnType<typeof useMagicMcpServer>['data']>;
  providers: ReturnType<typeof useMagicMcpServerProviders>;
  listingLookup: Record<string, { name: string; imageUrl: string }>;
  deploymentLookup: Record<string, { name: string | null }>;
  authConfigLookup: Record<string, string | null>;
  openProviderPanel: (row?: MagicMcpServerProviderRow) => void;
  removeProvider: (row: MagicMcpServerProviderRow) => void;
}) =>
  renderWithPagination(p.providers)(providers => (
    <>
      <Table
        headers={['Provider', 'Config', 'Auth Config', 'Tools', '']}
        data={providers.data.items.map(provider => {
          let listing = p.listingLookup[provider.provider.id];
          let deployment =
            provider.deployment?.name ??
            (provider.deployment?.id
              ? p.deploymentLookup[provider.deployment.id]?.name
              : null);
          let authConfigName = provider.authConfig?.name
            ? provider.authConfig.name
            : provider.authConfig?.id
              ? p.authConfigLookup[provider.authConfig.id]
              : null;

          return {
            data: [
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Text size="2" weight="strong">
                  {listing?.name ?? provider.provider.name}
                </Text>
                <Text size="1" color="gray600">
                  {provider.provider.slug ?? provider.provider.id}
                </Text>
                {provider.providerManagementMode !== 'manual' ? (
                  <Text size="1" color="gray600">
                    {provider.providerManagementMode === 'inherited_from_integration'
                      ? 'Inherited from integration'
                      : 'Inherited from provider template'}
                  </Text>
                ) : null}
              </div>,
              provider.config ? (
                <Text size="2">{provider.config.name ?? provider.config.id}</Text>
              ) : (
                <Text size="2" color="gray600">
                  Default
                </Text>
              ),
              authConfigName ? (
                <Text size="2">{authConfigName}</Text>
              ) : (
                <Text size="2" color="gray600">
                  None
                </Text>
              ),
              <Text size="2">{getToolFilterSummary(provider.toolFilter)}</Text>,
              <Flex style={{ width: '100%' }} justify="end">
                <Menu
                  items={[
                    ...(provider.canUpdate
                      ? [
                          {
                            id: 'edit',
                            label: 'Edit'
                          }
                        ]
                      : []),
                    ...(provider.canDelete
                      ? [
                          {
                            id: 'delete',
                            label: 'Delete'
                          }
                        ]
                      : [])
                  ]}
                  onItemClick={id => {
                    if (id === 'edit') p.openProviderPanel(provider);
                    if (id === 'delete') p.removeProvider(provider);
                  }}
                >
                  <Button
                    size="1"
                    variant="outline"
                    iconRight={<RiMore2Line />}
                    onClick={e => e.preventDefault()}
                  />
                </Menu>
              </Flex>
            ]
          };
        })}
      />

      {providers.data.items.length === 0 ? (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No providers configured for this magic MCP server.
        </Text>
      ) : null}
    </>
  ));

export let MagicMcpServerProvidersPage = () => {
  let instance = useCurrentInstance();
  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let providers = useMagicMcpServerProviders(instance.data?.id, magicMcpServerId, {
    status: ['active']
  });
  let deployments = useProviderDeployments(instance.data?.id);
  let authConfigs = useProviderAuthConfigs(instance.data?.id);
  let listings = useProviderListings(instance.data?.id, { limit: 100 });
  let createProvider = useCreateMagicMcpServerProvider();
  let updateProvider = useUpdateMagicMcpServerProvider();
  let deleteProvider = useDeleteMagicMcpServerProvider();

  let listingLookup = useMemo(
    () =>
      Object.fromEntries(
        (listings.data?.items ?? []).map(listing => [
          listing.provider.id,
          {
            name: listing.name,
            imageUrl: listing.imageUrl
          }
        ])
      ),
    [listings.data?.items]
  );
  let deploymentLookup = useMemo(
    () =>
      Object.fromEntries(
        (deployments.data?.items ?? []).map(deployment => [deployment.id, deployment])
      ),
    [deployments.data?.items]
  );
  let authConfigLookup = useMemo(
    () =>
      Object.fromEntries(
        (authConfigs.data?.items ?? []).map(config => [config.id, config.name])
      ),
    [authConfigs.data?.items]
  );
  let linkedProviderIds = useMemo(
    () =>
      Array.from(new Set((providers.data?.items ?? []).map(provider => provider.provider.id))),
    [providers.data?.items]
  );

  let openProviderPanel = (row?: MagicMcpServerProviderRow) => {
    if (!instance.data || !magicMcpServerId) return;

    showAddProviderSidePanel({
      instanceId: instance.data.id,
      excludeProviderIds: row
        ? linkedProviderIds.filter(providerId => providerId !== row.provider.id)
        : linkedProviderIds,
      providerId: row?.provider.id,
      hideProviderStep: !!row,
      sessionTemplateProviderId: row?.id,
      initialDeploymentId: row?.deployment?.id,
      initialConfigId: row?.config?.id ?? undefined,
      initialAuthConfigId: row?.authConfig?.id ?? undefined,
      initialToolFilter: row?.toolFilter ?? null,
      title: row ? 'Edit Provider' : 'Add Provider',
      description: row
        ? 'Update the configuration for this magic MCP server provider.'
        : 'Select a provider and configure how it should be attached to this magic MCP server.',
      action: row ? 'Save Changes' : 'Add Provider',
      onSubmitProvider: async (input, currentProviderId) => {
        if (!instance.data || !magicMcpServerId) return { success: false };

        if (currentProviderId) {
          let [, error] = await updateProvider.mutate({
            instanceId: instance.data.id,
            magicMcpServerId,
            magicMcpServerProviderId: currentProviderId,
            providerDeploymentId: input.providerDeploymentId,
            providerConfigId: input.providerConfigId,
            providerAuthConfigId: input.providerAuthConfigId,
            toolFilters: input.toolFilters
          });

          return error ? { error } : { success: true };
        }

        let [, error] = await createProvider.mutate({
          instanceId: instance.data.id,
          magicMcpServerId,
          providerId: input.providerId,
          providerDeploymentId: input.providerDeploymentId!,
          providerConfigId: input.providerConfigId,
          providerAuthConfigId: input.providerAuthConfigId,
          toolFilters: input.toolFilters
        });

        return error ? { error } : { success: true };
      },
      onComplete: () => {
        void providers.refetch();
        void server.refetch();
      }
    });
  };

  let removeProvider = (row: MagicMcpServerProviderRow) => {
    if (!instance.data || !magicMcpServerId) return;

    confirm({
      title: 'Remove Provider',
      description: `Are you sure you want to remove ${row.provider.name} from this magic MCP server?`,
      onConfirm: async () => {
        let [result, error] = await deleteProvider.mutate({
          instanceId: instance.data.id,
          magicMcpServerId,
          magicMcpServerProviderId: row.id
        });
        if (!result || error) return;

        toast.success('Provider removed');
        void providers.refetch();
        void server.refetch();
      }
    });
  };

  return renderWithLoader({ server, providers, deployments, authConfigs, listings })(
    ({ server }) => (
      <MagicMcpServerProvidersTable
        server={server.data}
        providers={providers}
        listingLookup={listingLookup}
        deploymentLookup={deploymentLookup}
        authConfigLookup={authConfigLookup}
        openProviderPanel={openProviderPanel}
        removeProvider={removeProvider}
      />
    )
  );
};
