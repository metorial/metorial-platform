import { DashboardInstanceMagicMcpServersProvidersListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import {
  useCreateMagicMcpServerProvider,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteMagicMcpServerProvider,
  useMagicMcpServer,
  useMagicMcpServerProviders,
  useMagicMcpTokens,
  useProviderDeployments,
  useProviderListings,
  useUpdateMagicMcpServerProvider
} from '@metorial/state';
import { Button, Callout, confirm, Flex, Menu, Spacer, Text, toast } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { RiMore2Line } from '@remixicon/react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  createMagicMcpTokenModal,
  showManageRestrictionsModal,
  TokenSecret,
  updateTokenModal,
  type TokenRow
} from '../../../scenes/magicMcp/tokensTable';
import { ResourceOwnerEntity } from '../../../components/resourceOwnerEntity';
import { useResourceOwnershipAccess } from '../../../lib/resourceOwnership';
import { MagicMcpServerConnectionBox } from './connection';
import { ToolFilterSummaryText } from '../../../lib/toolFilterSummary';
import { showAddProviderSidePanel } from '../../../scenes/sessionTemplates/providersManager';

type MagicMcpServerProviderRow =
  DashboardInstanceMagicMcpServersProvidersListOutput['items'][number];
type MagicMcpServer = NonNullable<ReturnType<typeof useMagicMcpServer>['data']>;

let MagicMcpServerProvidersBox = (p: { instanceId: string; server: MagicMcpServer }) => {
  let providers = useMagicMcpServerProviders(p.instanceId, p.server.id, {
    status: ['active']
  });
  let deployments = useProviderDeployments(p.instanceId);
  let listings = useProviderListings(p.instanceId, { limit: 100 });
  let createProvider = useCreateMagicMcpServerProvider();
  let updateProvider = useUpdateMagicMcpServerProvider();
  let deleteProvider = useDeleteMagicMcpServerProvider();

  let listingLookup = useMemo(
    () =>
      Object.fromEntries(
        (listings.data?.items ?? []).map(listing => [
          listing.provider.id,
          { name: listing.name, imageUrl: listing.imageUrl }
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
  let linkedProviderIds = useMemo(
    () =>
      Array.from(new Set((providers.data?.items ?? []).map(provider => provider.provider.id))),
    [providers.data?.items]
  );

  let canAddProviders = p.server.providerManagementMode === 'manual';
  let addProviderDisabledReason =
    p.server.providerManagementMode === 'inherited_from_integration'
      ? 'Providers are inherited from the integration and cannot be changed here.'
      : p.server.providerManagementMode === 'inherited_from_provider_template'
        ? 'Providers are inherited from the provider template and cannot be changed here.'
        : undefined;

  let openProviderPanel = (row?: MagicMcpServerProviderRow) => {
    showAddProviderSidePanel({
      instanceId: p.instanceId,
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
        if (currentProviderId) {
          let [, error] = await updateProvider.mutate({
            instanceId: p.instanceId,
            magicMcpServerId: p.server.id,
            magicMcpServerProviderId: currentProviderId,
            providerDeploymentId: input.providerDeploymentId,
            providerConfigId: input.providerConfigId,
            providerAuthConfigId: input.providerAuthConfigId,
            toolFilters: input.toolFilters
          });

          return error ? { error } : { success: true };
        }

        let [, error] = await createProvider.mutate({
          instanceId: p.instanceId,
          magicMcpServerId: p.server.id,
          providerId: input.providerId,
          providerDeploymentId: input.providerDeploymentId!,
          providerConfigId: input.providerConfigId,
          providerAuthConfigId: input.providerAuthConfigId,
          toolFilters: input.toolFilters
        });

        return error ? { error } : { success: true };
      },
      onComplete: () => providers.refetch()
    });
  };

  let removeProvider = (row: MagicMcpServerProviderRow) => {
    confirm({
      title: 'Remove Provider',
      description: `Are you sure you want to remove ${row.provider.name} from this magic MCP server?`,
      onConfirm: async () => {
        let [result, error] = await deleteProvider.mutate({
          instanceId: p.instanceId,
          magicMcpServerId: p.server.id,
          magicMcpServerProviderId: row.id
        });
        if (!result || error) return;

        toast.success('Provider removed');
        void providers.refetch();
      }
    });
  };

  return (
    <Box
      title="Providers"
      description="Providers attached to this magic MCP server."
      rightActions={
        <Button
          size="1"
          disabled={!canAddProviders}
          title={addProviderDisabledReason}
          onClick={() => canAddProviders && openProviderPanel()}
        >
          Add Provider
        </Button>
      }
    >
      {renderWithLoader({ providers, deployments, listings })(() => (
        <MagicMcpServerProvidersTable
          instanceId={p.instanceId}
          providers={providers}
          listingLookup={listingLookup}
          openProviderPanel={openProviderPanel}
          removeProvider={removeProvider}
        />
      ))}
    </Box>
  );
};

let MagicMcpServerProvidersTable = (p: {
  instanceId: string;
  providers: ReturnType<typeof useMagicMcpServerProviders>;
  listingLookup: Record<string, { name: string; imageUrl: string }>;
  openProviderPanel: (row?: MagicMcpServerProviderRow) => void;
  removeProvider: (row: MagicMcpServerProviderRow) => void;
}) =>
  renderWithPagination(p.providers, { hidePaginationWhenUnavailable: true })(providers => (
    <>
      <Table
        headers={['Provider', 'Tools', '']}
        data={providers.data.items.map(provider => {
          let listing = p.listingLookup[provider.provider.id];
          let canEdit = provider.canUpdate;

          return {
            onClick: canEdit ? () => p.openProviderPanel(provider) : undefined,
            data: [
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Text size="2" weight="strong">
                  {listing?.name ?? provider.provider.name}
                </Text>
                <Text size="1" color="gray600">
                  {provider.provider.slug ?? provider.provider.id}
                </Text>
              </div>,
              <ToolFilterSummaryText
                instanceId={p.instanceId}
                providerId={provider.provider.id}
                toolFilter={provider.toolFilter}
              />,
              <Flex style={{ width: '100%' }} justify="end" onClick={e => e.stopPropagation()}>
                <Menu
                  items={[
                    ...(provider.canUpdate
                      ? [
                          {
                            id: 'edit',
                            label: 'Edit',
                            disabled: provider.providerManagementMode !== 'manual'
                          }
                        ]
                      : []),
                    ...(provider.canDelete
                      ? [
                          {
                            id: 'delete',
                            label: 'Delete',
                            disabled: provider.providerManagementMode !== 'manual'
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
          No providers configured for this magic MCP server.
        </Text>
      ) : null}
    </>
  ));

let MagicMcpServerTokensBox = (p: { instanceId: string; server: MagicMcpServer }) => {
  let tokens = useMagicMcpTokens(p.instanceId, {
    order: 'asc',
    status: ['active'],
    magicMcpServerId: p.server.id
  });
  let revokeMutator = tokens.revokeMutator();

  let deleteToken = async (tokenId: string) => {
    let [res] = await revokeMutator.mutate({ magicMcpTokenId: tokenId });
    if (res) toast.success('Magic MCP token deleted');
  };

  return (
    <Box
      title="Tokens"
      description="Tokens that can be used to connect to this Magic MCP server."
      rightActions={
        <Button size="1" onClick={() => createMagicMcpTokenModal()}>
          Create Token
        </Button>
      }
    >
      {renderWithPagination(tokens, { hidePaginationWhenUnavailable: true })(tokens => (
        <>
          <Table
            headers={['Name', 'Secret', '']}
            data={tokens.data.items.map((token: TokenRow) => ({
              data: [
                <div>
                  <Text size="2" weight="strong">
                    {token.name ?? 'Unnamed Token'}
                  </Text>
                  {token.description && (
                    <Text size="1" color="gray600">
                      {token.description}
                    </Text>
                  )}
                </div>,
                <TokenSecret token={token} />,
                <Flex style={{ width: '100%' }} justify="end">
                  <Menu
                    items={[
                      {
                        id: 'update',
                        label: 'Update Details',
                        disabled: token.status !== 'active'
                      },
                      {
                        id: 'restrictions',
                        label: 'Edit Restrictions',
                        disabled: token.status !== 'active'
                      },
                      {
                        id: 'delete',
                        label: 'Delete',
                        disabled: token.status !== 'active'
                      }
                    ]}
                    onItemClick={id => {
                      if (id === 'update') {
                        updateTokenModal({ tokenId: token.id, instanceId: p.instanceId });
                      }
                      if (id === 'restrictions') {
                        showManageRestrictionsModal({ token });
                      }
                      if (id === 'delete') {
                        confirm({
                          title: 'Delete Magic MCP token',
                          description: 'Are you sure you want to delete this Magic MCP token?',
                          confirmText: 'Delete',
                          onConfirm: async () => {
                            await deleteToken(token.id);
                          }
                        });
                      }
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
            }))}
          />

          {tokens.data.items.length === 0 ? (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No Magic MCP tokens found.
            </Text>
          ) : null}
        </>
      ))}
    </Box>
  );
};

export let MagicMcpServerOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { magicMcpServerId } = useParams();

  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let ownership = useResourceOwnershipAccess(server.data);
  let canConnect = ownership.canUse && !ownership.isLoading;

  return renderWithLoader({ server, organization, project, instance })(
    ({ server, organization, project, instance }) => {
      let consumerOwners = server.data.consumerOwners;

      return (
        <DetailsOverviewLayout>
          {!ownership.isLoading && !ownership.canUse && (
            <>
              <Callout color="orange">
                You do not have access to connect to this Magic MCP server or use it in other
                resources.
              </Callout>

              <Spacer height={20} />
            </>
          )}

          {server.data.access.owner && (
            <>
              <ResourceOwnerEntity resource={server.data} />
              <Spacer height={20} />
            </>
          )}

          <MagicMcpServerConnectionBox
            instanceId={instance.data.id}
            server={server.data}
            canConnect={canConnect}
          />
          {canConnect && <Spacer height={20} />}

          <MagicMcpServerProvidersBox instanceId={instance.data.id} server={server.data} />

          {canConnect && (
            <>
              <Spacer height={20} />

              <MagicMcpServerTokensBox instanceId={instance.data.id} server={server.data} />
            </>
          )}

          {consumerOwners.length > 0 && (
            <>
              <Spacer height={20} />

              <Box
                title="User Access"
                description="Accounts that have access this Magic MCP server."
              >
                <Table
                  headers={['Name', 'Email', 'Consumer ID']}
                  data={consumerOwners.map(consumerOwner => ({
                    data: [
                      consumerOwner.consumerProfileName || consumerOwner.consumerName,
                      consumerOwner.consumerProfileEmail || consumerOwner.consumerEmail,
                      <ID id={consumerOwner.consumerId} />
                    ]
                  }))}
                />
              </Box>
            </>
          )}
        </DetailsOverviewLayout>
      );
    }
  );
};
