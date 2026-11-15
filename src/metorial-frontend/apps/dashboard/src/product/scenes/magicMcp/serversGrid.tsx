import {
  DashboardInstanceMagicMcpServersListOutput,
  DashboardInstanceMagicMcpServersListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  f,
  lifecycleStatus,
  withDefaults,
  type DataListEnrichResult
} from '@metorial/data-list';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { useAllProviderListings, useMagicMcpServers } from '@metorial/state';
import { Avatar, Text } from '@metorial/ui';
import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { ResourceOwnerInline } from '../../components/resourceOwnerEntity';
import { useInstanceContext } from '../../lib/dataList';
import {
  ProviderAvatarStack,
  type ProviderAvatarStackEntry
} from '../../lib/providerAvatarStack';
import { entityFilters } from '../entityFilters';
import { showMagicMcpServerCreateFlow } from '../providerDeployments/magicMcpForm';

type Server = DashboardInstanceMagicMcpServersListOutput['items'][number];
type ServerWithProviders = Server & { providerAvatars: ProviderAvatarStackEntry[] };

let withProviderAvatars = (
  items: Server[],
  { ctx }: { ctx: { instanceId?: string } }
): DataListEnrichResult<ServerWithProviders> => {
  let providerIds = useMemo(
    () =>
      [
        ...new Set(
          items.flatMap(server =>
            (server.providers ?? []).map(provider => provider.provider.id)
          )
        )
      ].sort(),
    [items]
  );
  let listings = useAllProviderListings(ctx.instanceId, providerIds);

  let enriched = useMemo(() => {
    let lookup = new Map<string, { name?: string | null; imageUrl?: string | null }>();

    for (let listing of listings.data ?? []) {
      lookup.set(listing.provider.id, {
        name: listing.name ?? listing.provider.name,
        imageUrl: listing.imageUrl
      });
    }

    return items.map(server => ({
      ...server,
      providerAvatars: (server.providers ?? []).map(provider => {
        let listing = lookup.get(provider.provider.id);

        return {
          id: provider.id ?? provider.provider.id,
          name: listing?.name ?? provider.provider.name ?? provider.provider.slug,
          imageUrl: listing?.imageUrl
        };
      })
    }));
  }, [items, listings.data]);

  return { items: enriched, isLoading: listings.isLoading, error: listings.error };
};

let MagicMcpServersList = createDataList<DashboardInstanceMagicMcpServersListQuery>(
  'magic-mcp-servers'
)
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    status: f.status(lifecycleStatus),
    magicMcpGroupId: f.entity(entityFilters.magicMcpGroup(ctx.instanceId)),
    providerId: f.entity(entityFilters.provider(ctx.instanceId))
  }))
  .search('Search Magic MCP servers…')
  .paginated(({ props, ctx, filters, search, limit }) =>
    useMagicMcpServers(
      ctx.instanceId,
      withDefaults(
        {
          ownership: 'all' as const,
          order: props.order ?? ('desc' as const),
          status: props.status,
          magicMcpGroupId: props.magicMcpGroupId,
          providerId: props.providerId,
          consumerId: props.consumerId,
          consumerProfileId: props.consumerProfileId,
          integrationInstanceId: props.integrationInstanceId,
          owner: props.owner,
          search: props.search
        },
        { ...filters, search, limit }
      )
    )
  )
  .enrich(withProviderAvatars)
  .columns([
    col.name({ fallback: 'Unknown Server' }),
    col.status(lifecycleStatus),
    col.text({
      id: 'aliases',
      header: 'Aliases',
      get: row => row.endpoints.map(endpoint => endpoint.alias).join(', ')
    }),
    col.custom({
      id: 'owner',
      header: 'Owner',
      render: row => <ResourceOwnerInline resource={row} linked={false} />
    }),
    col.createdAt(),
    col.text({
      id: 'endpointCount',
      header: 'Endpoints',
      isDefault: false,
      get: row => row.endpoints.length
    }),
    col.text({
      id: 'urls',
      header: 'Endpoint URLs',
      isDefault: false,
      get: row => row.endpoints.map(endpoint => endpoint.url).join(', ')
    }),
    col.updatedAt(),
    col.id({ header: 'Server ID' })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.magicMcp.server(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .item(row => ({
    title: row.name ?? 'Unknown Server',
    description: row.description,
    icon:
      row.providerAvatars.length > 0 ? (
        <ProviderAvatarStack providers={row.providerAvatars} />
      ) : (
        <Avatar entity={{ name: row.name ?? 'Magic MCP Server' }} size={30} />
      ),
    footer: (
      <Text size="2">
        {row.endpoints.map(endpoint => endpoint.alias).find(Boolean) ?? row.id}
      </Text>
    )
  }))
  .layouts(['grid', 'table'], { default: 'grid', gridWidth: '300px' })
  .build();

let MagicMcpServersEmptyState = () => {
  let ctx = useInstanceContext();

  return (
    <EmptyState
      extra="Magic MCP"
      title="Create your first Magic MCP server"
      description="Magic MCP servers connect providers to agents and clients through managed MCP endpoints."
      action={{
        label: 'Create Magic MCP Server',
        onClick: () => {
          if (ctx.instanceId) showMagicMcpServerCreateFlow({ instanceId: ctx.instanceId });
        }
      }}
    />
  );
};

let emptyState = {
  initial: () => <MagicMcpServersEmptyState />,
  filtered: 'No Magic MCP servers match the current filters.',
  search: 'No Magic MCP servers found.'
};

export let MagicMcpServersGrid = (props: ComponentProps<typeof MagicMcpServersList>) => (
  <MagicMcpServersList emptyState={emptyState} {...props} />
);

export let MagicMcpServersTable = ({
  headerActions,
  ...props
}: Omit<ComponentProps<typeof MagicMcpServersList>, 'headerActions'> & {
  headerActions?: ReactNode;
}) => (
  <MagicMcpServersList
    listLayout="table"
    emptyState="No Magic MCP servers found."
    {...props}
    headerActions={headerActions ? () => headerActions : undefined}
  />
);
