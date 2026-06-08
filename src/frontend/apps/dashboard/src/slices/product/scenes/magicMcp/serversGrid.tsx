import {
  DashboardInstanceMagicMcpServersListOutput,
  DashboardInstanceMagicMcpServersListQuery
} from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useAllProviderListings,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useMagicMcpServers,
  useProviderListings
} from '@metorial/state';
import { Avatar, Badge, Input, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { ID, ItemGrid } from '@metorial/ui-product';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { EmptyState } from '../../../../components/emptyState';
import { Table as DashboardTable } from '../../../../components/table';
import { TableFilters } from '../../../../components/table/components/filter';
import { useFilterQuery } from '../../../../components/table/components/query';
import {
  FilterPayload,
  TableFilter,
  TableFilterState,
  getFilterPayload
} from '../../../../components/table/filter';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../components/table/type';
import { useDebounced } from '../../../../hooks/useDebounced';
import {
  getEnumListFilterValue,
  getListFilterValue,
  getStringFilterValue
} from '../../../../lib/dataTableUtils';
import { showMagicMcpServerCreateFlow } from '../providerDeployments/magicMcpForm';

type Server = DashboardInstanceMagicMcpServersListOutput['items'][number];

let Toolbar = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
`;

let SearchWrapper = styled.div`
  flex: 1;
  min-width: 260px;
`;

let Alias = styled.div`
  background: ${theme.colors.gray300};
  min-height: 26px;
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  overflow-wrap: anywhere;
`;

let ProviderAvatarStack = styled.div`
  display: flex;
  align-items: center;
`;

let ProviderAvatarItem = styled.div<{ $index: number }>`
  position: relative;
  z-index: ${p => 10 - p.$index};
  margin-left: ${p => (p.$index === 0 ? '0' : '-8px')};
  border-radius: 999px;
  box-shadow: 0 0 0 2px ${theme.colors.background};
`;

type MagicMcpServersTableProps = DashboardInstanceMagicMcpServersListQuery & {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getServerStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceMagicMcpServersListQuery['status'] =>
  getEnumListFilterValue(value, ['active', 'archived', 'deleted']);

let getMagicMcpServerFilters = (
  providerOptions: { id: string; label: string }[]
): TableFilter<Server>[] => [
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
    id: 'magicMcpGroupId',
    fields: ['magicMcpGroupId'],
    label: 'Group ID',
    description: 'Filter by group ID',
    type: 'string'
  },
  {
    id: 'providerId',
    fields: ['providerId'],
    label: 'Provider',
    description: 'Filter by provider',
    type: 'select',
    options: providerOptions
  }
];

let magicServersState: TableStateProvider<
  MagicMcpServersTableProps,
  Server,
  TableStateProviderResult<Server>
> = (props, opts) => {
  let servers = useMagicMcpServers(props.instanceId, {
    order: props.order ?? 'desc',
    status: getServerStatusFilterValue(opts.filter.status) ?? props.status,
    magicMcpGroupId:
      getStringFilterValue(opts.filter.magicMcpGroupId) ?? props.magicMcpGroupId,
    providerId: getListFilterValue(opts.filter.providerId) ?? props.providerId,
    consumerId: props.consumerId,
    consumerProfileId: props.consumerProfileId,
    search: opts.search ?? props.search
  });

  return {
    isLoading: servers.isLoading,
    error: servers.error,
    hasMoreAfter: servers.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: servers.data?.pagination.hasMoreBefore ?? false,
    items: servers.data?.items ?? [],
    loadNext: servers.next,
    loadPrevious: servers.previous
  };
};

let magicServersTable = new DashboardTable<MagicMcpServersTableProps, Server>(
  'magic-mcp-servers'
)
  .state(magicServersState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: server => (
        <div>
          <Text size="2" weight="strong">
            {server.name ?? 'Unknown Server'}
          </Text>
          {server.description && (
            <Text size="1" color="gray600">
              {server.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: server => (
        <Badge
          color={
            { active: 'green', archived: 'orange', deleted: 'gray' }[server.status] as any
          }
        >
          {server.status}
        </Badge>
      )
    },
    {
      id: 'aliases',
      isDefault: true,
      header: 'Aliases',
      render: server => (
        <Text size="2">
          {server.endpoints.map(endpoint => endpoint.alias).join(', ') || '-'}
        </Text>
      )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: server => <RenderDate date={server.createdAt} />
    },
    {
      id: 'endpointCount',
      isDefault: false,
      header: 'Endpoints',
      render: server => <Text size="2">{server.endpoints.length}</Text>
    },
    {
      id: 'urls',
      isDefault: false,
      header: 'Endpoint URLs',
      render: server => (
        <Text size="2">
          {server.endpoints.map(endpoint => endpoint.url).join(', ') || '-'}
        </Text>
      )
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: server => <RenderDate date={server.updatedAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Server ID',
      render: server => <ID id={server.id} />
    }
  ])
  .filters(getMagicMcpServerFilters([]))
  .search('Search Magic MCP servers...')
  .link((server, props) =>
    Paths.instance.magicMcp.server(
      props.organization.data,
      props.project.data,
      props.instance.data,
      server.id
    )
  )
  .build();

export let MagicMcpServersTable = (
  filter: DashboardInstanceMagicMcpServersListQuery & {
    headerActions?: React.ReactNode;
  }
) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let location = useLocation();
  let selectedProviderIds = useMemo(() => {
    let ids = new Set<string>();
    let providerIdParam = new URLSearchParams(location.search).get('providerId');

    if (providerIdParam) {
      for (let id of providerIdParam.split(',')) {
        if (id.trim()) ids.add(id.trim());
      }
    }

    for (let id of Array.isArray(filter.providerId)
      ? filter.providerId
      : filter.providerId
        ? [filter.providerId]
        : []) {
      if (id.trim()) ids.add(id.trim());
    }

    return [...ids].sort();
  }, [filter.providerId, location.search]);
  let providerListings = useProviderListings(instance.data?.id, {
    orderByRank: true,
    limit: 100
  });
  let selectedProviderListings = useAllProviderListings(
    instance.data?.id,
    selectedProviderIds
  );
  let providerOptions = useMemo(
    () =>
      [
        ...new Map(
          [
            ...(providerListings.data?.items ?? []),
            ...(selectedProviderListings.data ?? [])
          ].map(listing => [
            listing.provider.id,
            {
              id: listing.provider.id,
              label: listing.name ?? listing.provider.name ?? listing.provider.slug
            }
          ])
        ).values()
      ].sort((a, b) => a.label.localeCompare(b.label)),
    [providerListings.data?.items, selectedProviderListings.data]
  );
  let filters = useMemo(() => getMagicMcpServerFilters(providerOptions), [providerOptions]);

  return magicServersTable({
    instanceId: instance.data!.id,
    organization,
    project,
    instance,
    ...filter,
    tableFilters: filters,
    emptyState: 'No Magic MCP servers found.',
    headerActions: filter.headerActions ? () => filter.headerActions : undefined
  });
};

export let MagicMcpServersGrid = (filter: DashboardInstanceMagicMcpServersListQuery = {}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let location = useLocation();
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let filterPayload = useMemo(() => getFilterPayload(filterState), [filterState]);
  let selectedProviderIds = useMemo(() => {
    let ids = new Set<string>();
    let providerIdParam = new URLSearchParams(location.search).get('providerId');

    if (providerIdParam) {
      for (let id of providerIdParam.split(',')) {
        if (id.trim()) ids.add(id.trim());
      }
    }

    let payloadProviderId = getListFilterValue(filterPayload.providerId);
    for (let id of Array.isArray(payloadProviderId)
      ? payloadProviderId
      : payloadProviderId
        ? [payloadProviderId]
        : []) {
      if (id.trim()) ids.add(id.trim());
    }

    for (let id of Array.isArray(filter.providerId)
      ? filter.providerId
      : filter.providerId
        ? [filter.providerId]
        : []) {
      if (id.trim()) ids.add(id.trim());
    }

    return [...ids].sort();
  }, [filter.providerId, filterPayload.providerId, location.search]);
  let providerListings = useProviderListings(instance.data?.id, {
    orderByRank: true,
    limit: 100
  });
  let selectedProviderListings = useAllProviderListings(
    instance.data?.id,
    selectedProviderIds
  );
  let providerOptions = useMemo(
    () =>
      [
        ...new Map(
          [
            ...(providerListings.data?.items ?? []),
            ...(selectedProviderListings.data ?? [])
          ].map(listing => [
            listing.provider.id,
            {
              id: listing.provider.id,
              label: listing.name ?? listing.provider.name ?? listing.provider.slug
            }
          ])
        ).values()
      ].sort((a, b) => a.label.localeCompare(b.label)),
    [providerListings.data?.items, selectedProviderListings.data]
  );
  let filters = useMemo(() => getMagicMcpServerFilters(providerOptions), [providerOptions]);
  let status = getServerStatusFilterValue(filterPayload.status) ?? filter.status;
  let magicMcpGroupId =
    getStringFilterValue(filterPayload.magicMcpGroupId) ?? filter.magicMcpGroupId;
  let providerId = getListFilterValue(filterPayload.providerId) ?? filter.providerId;
  let servers = useMagicMcpServers(instance.data?.id, {
    order: filter.order ?? 'desc',
    status,
    magicMcpGroupId,
    providerId,
    consumerId: filter.consumerId,
    consumerProfileId: filter.consumerProfileId,
    search: searchDebounced || filter.search
  });
  let providerIds = useMemo(
    () =>
      [
        ...new Set(
          (servers.data?.items ?? []).flatMap(server =>
            (server.providers ?? []).map(provider => provider.provider.id)
          )
        )
      ].sort(),
    [servers.data?.items]
  );
  let cardProviderListings = useAllProviderListings(instance.data?.id, providerIds);
  let hasActiveFilters = !!(
    searchDebounced ||
    filter.search ||
    status ||
    magicMcpGroupId ||
    providerId ||
    filter.consumerId ||
    filter.consumerProfileId
  );

  useFilterQuery({
    filters,
    filterState: [filterState, setFilterState],
    searchState: [search, setSearch],
    debouncedSearch: searchDebounced
  });

  let showCreateMagicMcpServerFlow = () => {
    if (!instance.data) return;
    showMagicMcpServerCreateFlow({ instanceId: instance.data.id });
  };

  return (
    <>
      <Toolbar>
        <SearchWrapper>
          <Input
            label="Search"
            hideLabel
            placeholder="Search Magic MCP servers..."
            value={search}
            onInput={setSearch}
          />
        </SearchWrapper>

        <TableFilters
          filters={filters}
          filterState={[filterState, setFilterState]}
          fullWidth={false}
        />
      </Toolbar>

      <Spacer size={15} />

      {renderWithPagination(servers)(servers =>
        renderWithLoader({ cardProviderListings })(({ cardProviderListings }) => {
          let listingLookup = new Map<
            string,
            { name: string | null | undefined; imageUrl: string | null | undefined }
          >();

          for (let listing of cardProviderListings.data) {
            let preview = {
              name: listing.name ?? listing.provider.name,
              imageUrl: listing.imageUrl
            };

            listingLookup.set(listing.id, preview);
            listingLookup.set(listing.provider.id, preview);
          }

          return (
            <>
              {servers.data.items.length > 0 && (
                <ItemGrid.Root width="300px">
                  {servers.data.items.map(server => {
                    let visibleProviders = (server.providers ?? []).slice(0, 5);
                    let aliases = server.endpoints
                      .map(endpoint => endpoint.alias)
                      .filter(Boolean);

                    return (
                      <Link
                        key={server.id}
                        to={Paths.instance.magicMcp.server(
                          organization.data,
                          project.data,
                          instance.data,
                          server.id
                        )}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <ItemGrid.Item
                          entity={{ id: server.id, hasUsage: true }}
                          title={server.name ?? 'Unknown Server'}
                          description={server.description}
                          height={220}
                          icon={
                            visibleProviders.length > 0 ? (
                              <ProviderAvatarStack>
                                {visibleProviders.map((provider, idx) => {
                                  let listing = listingLookup.get(provider.provider.id);
                                  let name =
                                    listing?.name ??
                                    provider.provider.name ??
                                    provider.provider.slug;

                                  return (
                                    <ProviderAvatarItem
                                      key={provider.id ?? provider.provider.id}
                                      $index={idx}
                                    >
                                      <Avatar
                                        entity={{
                                          name,
                                          photoUrl: listing?.imageUrl ?? undefined
                                        }}
                                        size={30}
                                        noTooltip
                                        imageFit="contain"
                                      />
                                    </ProviderAvatarItem>
                                  );
                                })}
                              </ProviderAvatarStack>
                            ) : (
                              <Avatar
                                entity={{ name: server.name ?? 'Magic MCP Server' }}
                                size={30}
                              />
                            )
                          }
                          bottom={
                            <div style={{ display: 'flex' }}>
                              <Alias>{aliases[0] ?? server.id}</Alias>
                            </div>
                          }
                        />
                      </Link>
                    );
                  })}
                </ItemGrid.Root>
              )}

              {servers.data.items.length === 0 && searchDebounced && (
                <Text size="2" color="gray600">
                  No Magic MCP servers found.
                </Text>
              )}

              {servers.data.items.length === 0 && !hasActiveFilters && (
                <EmptyState
                  extra="Magic MCP"
                  title="Create your first Magic MCP server"
                  description="Magic MCP servers connect providers to agents and clients through managed MCP endpoints."
                  action={{
                    label: 'Create Magic MCP Server',
                    onClick: showCreateMagicMcpServerFlow
                  }}
                />
              )}

              {servers.data.items.length === 0 && !searchDebounced && hasActiveFilters && (
                <Text size="2" color="gray600">
                  No Magic MCP servers match the current filters.
                </Text>
              )}
            </>
          );
        })
      )}
    </>
  );
};
