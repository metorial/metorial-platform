import type { DashboardInstancePublicMcpServersListQuery } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  defineStatus,
  f,
  withDefaults,
  type DataListEnrichResult
} from '@metorial/data-list';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { useAllProviderListings, usePublicMcpServers } from '@metorial/state';
import { Avatar, Text } from '@metorial/ui';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { useInstanceContext } from '../../lib/dataList';
import { showCreatePublicMcpServerDialog } from './createDialog';
import { PublicMcpServerStatusBadge } from './shared';

let defaultStatus: ('active' | 'disabled' | 'archived')[] = ['active', 'disabled'];

let serverStatus = defineStatus({
  active: { label: 'Active', color: 'green' },
  disabled: { label: 'Disabled', color: 'orange' },
  archived: { label: 'Archived', color: 'gray' },
  deleted: { label: 'Deleted', color: 'gray' }
});

let BottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

type PublicMcpServersGridProps = {
  instanceId: string;
} & Omit<DashboardInstancePublicMcpServersListQuery, 'after' | 'before' | 'cursor' | 'limit'>;

let withListingImages =
  <Row extends { id: string; providerId: string }>() =>
  (
    items: Row[],
    { ctx }: { ctx: { instanceId?: string } }
  ): DataListEnrichResult<Row & { listingName?: string; listingImageUrl?: string | null }> => {
    let providerIds = useMemo(
      () => [...new Set(items.map(item => item.providerId))].sort(),
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

      return items.map(item => ({
        ...item,
        listingName: lookup.get(item.providerId)?.name ?? undefined,
        listingImageUrl: lookup.get(item.providerId)?.imageUrl
      }));
    }, [items, listings.data]);

    return { items: enriched, isLoading: listings.isLoading, error: listings.error };
  };

let PublicMcpServersList = createDataList<PublicMcpServersGridProps>('public-mcp-servers')
  .context(useInstanceContext)
  .filters(() => ({
    status: f.status(serverStatus, { only: ['active', 'disabled', 'archived'] })
  }))
  .search('Search public MCP servers…')
  .paginated(({ props, filters, search, limit }) =>
    usePublicMcpServers(
      props.instanceId,
      withDefaults(
        {
          order: props.order ?? ('desc' as const),
          id: props.id,
          providerDeploymentId: props.providerDeploymentId,
          createdAt: props.createdAt,
          updatedAt: props.updatedAt,
          search: props.search
        },
        { ...filters, status: filters.status ?? props.status ?? defaultStatus, search, limit }
      )
    )
  )
  .enrich(withListingImages())
  .columns([
    col.name({ description: false }),
    col.status(serverStatus),
    col.text({ id: 'slug', header: 'Slug', get: row => row.slug }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ header: 'Server ID' })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.publicMcp.server(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .item(row => ({
    title: row.name,
    icon: (
      <Avatar
        entity={{
          name: row.listingName ?? row.name,
          photoUrl: row.listingImageUrl ?? undefined
        }}
        size={30}
        noTooltip
        imageFit="contain"
      />
    ),
    footer: (
      <BottomRow>
        <Text size="1">{row.slug}</Text>

        {row.status !== 'active' && <PublicMcpServerStatusBadge status={row.status} />}
      </BottomRow>
    )
  }))
  .layouts(['grid', 'table'], { default: 'grid', gridWidth: '300px' })
  .build();

let PublicMcpServersEmptyState = ({ instanceId }: { instanceId: string }) => {
  let ctx = useInstanceContext();
  let navigate = useNavigate();

  return (
    <EmptyState
      extra="Public MCP"
      title="Create your first public MCP server"
      description="Publish an integration at a public URL. Any MCP client can connect, and each user signs in with their own account."
      action={{
        label: 'Create Public MCP Server',
        onClick: () =>
          showCreatePublicMcpServerDialog({
            instanceId,
            onCreate: server =>
              navigate(
                Paths.instance.publicMcp.server(
                  ctx.organization,
                  ctx.project,
                  ctx.instance,
                  server.id
                )
              )
          })
      }}
    />
  );
};

export let PublicMcpServersGrid = (
  props: PublicMcpServersGridProps &
    Omit<React.ComponentProps<typeof PublicMcpServersList>, keyof PublicMcpServersGridProps>
) => {
  let emptyState = useMemo(
    () => ({
      initial: () => <PublicMcpServersEmptyState instanceId={props.instanceId} />,
      filtered: 'No public MCP servers match the current filters.',
      search: 'No public MCP servers found.'
    }),
    [props.instanceId]
  );

  return <PublicMcpServersList emptyState={emptyState} {...props} />;
};
