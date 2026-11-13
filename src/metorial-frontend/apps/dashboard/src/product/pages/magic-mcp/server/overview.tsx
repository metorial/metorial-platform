import { DashboardInstanceMagicMcpServersProvidersListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { col, createDataList, defineAction, withDefaults } from '@metorial/data-list';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
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
import { Button, Callout, confirm, Spacer, Text, toast } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { RiDeleteBinLine, RiEditLine } from '@remixicon/react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  createMagicMcpTokenModal,
  magicTokenActions,
  TokenSecret,
  type TokenRow
} from '../../../scenes/magicMcp/tokensTable';
import { ResourceOwnerEntity } from '../../../components/resourceOwnerEntity';
import { useInstanceContext } from '../../../lib/dataList';
import { useResourceOwnershipAccess } from '../../../lib/resourceOwnership';
import { MagicMcpServerConnectionBox } from './connection';
import { UsageOverviewTiles } from '../../../scenes/instanceUsage';
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
        <MagicMcpServerProvidersList
          listVariant="embedded"
          instanceId={p.instanceId}
          magicMcpServerId={p.server.id}
          listingLookup={listingLookup}
          openProviderPanel={openProviderPanel}
          removeProvider={removeProvider}
          emptyState="No providers configured for this magic MCP server."
        />
      ))}
    </Box>
  );
};

type ProvidersTableProps = {
  instanceId: string;
  magicMcpServerId: string;
  listingLookup: Record<string, { name: string; imageUrl: string }>;
  openProviderPanel: (row?: MagicMcpServerProviderRow) => void;
  removeProvider: (row: MagicMcpServerProviderRow) => void;
};

let isProviderLocked = (row: MagicMcpServerProviderRow) =>
  row.providerManagementMode !== 'manual';

let MagicMcpServerProvidersList = createDataList<ProvidersTableProps>(
  'magic-mcp-server-providers',
  { customizable: false }
)
  .paginated(({ props, limit }) =>
    useMagicMcpServerProviders(
      props.instanceId,
      props.magicMcpServerId,
      withDefaults({ status: ['active' as const] }, { limit })
    )
  )
  .columns([
    col.custom({
      id: 'provider',
      header: 'Provider',
      render: (row, props) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Text size="2" weight="strong">
            {props.listingLookup[row.provider.id]?.name ?? row.provider.name}
          </Text>
          <Text size="1" color="gray600">
            {row.provider.slug ?? row.provider.id}
          </Text>
        </div>
      )
    }),
    col.custom({
      id: 'tools',
      header: 'Tools',
      render: (row, props) => (
        <ToolFilterSummaryText
          instanceId={props.instanceId}
          providerId={row.provider.id}
          toolFilter={row.toolFilter}
        />
      )
    })
  ])
  .clickable((row, props) => {
    if (row.canUpdate) props.openProviderPanel(row);
  })
  .itemActions([
    defineAction<MagicMcpServerProviderRow, ProvidersTableProps>({
      id: 'edit',
      label: 'Edit',
      icon: <RiEditLine />,
      hidden: row => !row.canUpdate,
      disabled: isProviderLocked,
      useRun:
        ({ props }) =>
        row => {
          props.openProviderPanel(row);
        }
    }),
    defineAction<MagicMcpServerProviderRow, ProvidersTableProps>({
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      destructive: true,
      hidden: row => !row.canDelete,
      disabled: isProviderLocked,
      useRun:
        ({ props }) =>
        row => {
          props.removeProvider(row);
        }
    })
  ])
  .build();

let MagicMcpServerTokensList = createDataList<{ magicMcpServerId: string }>(
  'magic-mcp-server-tokens',
  { customizable: false }
)
  .context(useInstanceContext)
  .paginated(({ props, ctx, limit }) =>
    useMagicMcpTokens(
      ctx.instanceId,
      withDefaults(
        {
          order: 'asc' as const,
          status: ['active' as const],
          magicMcpServerId: props.magicMcpServerId
        },
        { limit }
      )
    )
  )
  .columns([
    col.name<TokenRow>({ fallback: 'Unnamed Token' }),
    col.custom<TokenRow>({
      id: 'secret',
      header: 'Secret',
      render: row => <TokenSecret token={row} />
    })
  ])
  .itemActions(magicTokenActions)
  .build();

let MagicMcpServerUserAccessList = createDataList<{
  owners: MagicMcpServer['consumerOwners'];
}>('magic-mcp-server-user-access', { customizable: false })
  .items(({ props }) => ({
    items: props.owners.map(owner => ({ ...owner, id: owner.consumerId }))
  }))
  .columns([
    col.text({
      id: 'name',
      header: 'Name',
      get: row => row.consumerProfileName || row.consumerName
    }),
    col.text({
      id: 'email',
      header: 'Email',
      get: row => row.consumerProfileEmail || row.consumerEmail
    }),
    col.refId('consumerId', row => row.consumerId, { header: 'Consumer ID', isDefault: true })
  ])
  .build();

let MagicMcpServerTokensBox = (p: { instanceId: string; server: MagicMcpServer }) => (
  <Box
    title="Tokens"
    description="Tokens that can be used to connect to this Magic MCP server."
    rightActions={
      <Button size="1" onClick={() => createMagicMcpTokenModal()}>
        Create Token
      </Button>
    }
  >
    <MagicMcpServerTokensList
      listVariant="embedded"
      magicMcpServerId={p.server.id}
      emptyState="No Magic MCP tokens found."
    />
  </Box>
);

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
          <UsageOverviewTiles
            filter={{ magicMcpServerId: server.data.id }}
            tiles={['tool_calls', 'active_consumers', 'connection_time', 'errors']}
            href={Paths.instance.magicMcp.server(
              organization.data,
              project.data,
              instance.data,
              server.data.id,
              'usage'
            )}
          />

          <Spacer height={20} />

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
                <MagicMcpServerUserAccessList listVariant="embedded" owners={consumerOwners} />
              </Box>
            </>
          )}
        </DetailsOverviewLayout>
      );
    }
  );
};
