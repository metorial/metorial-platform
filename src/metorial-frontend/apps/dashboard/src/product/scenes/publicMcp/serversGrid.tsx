import type { DashboardInstancePublicMcpServersListQuery } from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import {
  useAllProviderListings,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  usePublicMcpServers
} from '@metorial/state';
import {
  getEnumListFilterValue,
  getFilterPayload,
  TableFilter,
  TableFilters,
  TableFilterState,
  useFilterQuery
} from '@metorial/table';
import { Avatar, Input, Spacer, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useDebounced } from '@metorial/use-debounced';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { showCreatePublicMcpServerDialog } from './createDialog';
import { PublicMcpServerStatusBadge } from './shared';

let statusValues = ['active', 'disabled', 'archived'] as const;
let defaultStatus: (typeof statusValues)[number][] = ['active', 'disabled'];

let filters: TableFilter<any>[] = [
  {
    id: 'status',
    fields: ['status'],
    label: 'Status',
    description: 'Filter by status',
    type: 'select',
    options: [
      { id: 'active', label: 'Active' },
      { id: 'disabled', label: 'Disabled' },
      { id: 'archived', label: 'Archived' }
    ]
  }
];

let Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  flex-wrap: nowrap;
`;

let SearchWrapper = styled.div`
  flex: 1 1 auto;
  min-width: 220px;
`;

let BottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

export let PublicMcpServersGrid = (
  p: {
    instanceId: string;
  } & Omit<DashboardInstancePublicMcpServersListQuery, 'after' | 'before' | 'cursor' | 'limit'>
) => {
  let { instanceId, ...query } = p;
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);

  useFilterQuery({
    filters,
    filterState: [filterState, setFilterState],
    searchState: [search, setSearch],
    debouncedSearch: searchDebounced
  });

  let filterPayload = useMemo(() => getFilterPayload(filterState), [filterState]);
  let selectedStatus = getEnumListFilterValue(filterPayload.status, statusValues);
  let status = selectedStatus ?? query.status ?? defaultStatus;
  let searchQuery = searchDebounced.trim() || query.search;

  let servers = usePublicMcpServers(instanceId, {
    order: 'desc',
    ...query,
    status,
    search: searchQuery
  });

  let providerIds = useMemo(
    () => [...new Set((servers.data?.items ?? []).map(server => server.providerId))].sort(),
    [servers.data?.items]
  );
  let providerListings = useAllProviderListings(instanceId, providerIds);

  let showCreateServerDialog = () => {
    showCreatePublicMcpServerDialog({
      instanceId,
      onCreate: server =>
        navigate(
          Paths.instance.publicMcp.server(
            organization.data,
            project.data,
            instance.data,
            server.id
          )
        )
    });
  };

  return (
    <>
      <Toolbar>
        <SearchWrapper>
          <Input
            label="Search"
            hideLabel
            size="2"
            placeholder="Search public MCP servers..."
            value={search}
            onInput={setSearch}
          />
        </SearchWrapper>

        <TableFilters
          filters={filters}
          filterState={[filterState, setFilterState]}
          fullWidth={false}
          wrap={false}
          defaultFilterId="status"
          resetCurrentFilterOnOpen
        />
      </Toolbar>

      <Spacer size={15} />

      {renderWithPagination(servers)(servers =>
        renderWithLoader({ providerListings })(({ providerListings }) => {
          let listingLookup = new Map<
            string,
            { name: string | null | undefined; imageUrl: string | null | undefined }
          >();

          for (let listing of providerListings.data) {
            let preview = {
              name: listing.name ?? listing.provider.name,
              imageUrl: listing.imageUrl
            };

            listingLookup.set(listing.id, preview);
            listingLookup.set(listing.provider.id, preview);
          }

          if (servers.data.items.length === 0) {
            if (searchQuery) {
              return (
                <Text size="2" color="gray600">
                  No public MCP servers found.
                </Text>
              );
            }

            if (selectedStatus) {
              return (
                <Text size="2" color="gray600">
                  No public MCP servers match the current filters.
                </Text>
              );
            }

            return (
              <EmptyState
                extra="Public MCP"
                title="Create your first public MCP server"
                description="Publish an integration at a public URL. Any MCP client can connect, and each user signs in with their own account."
                action={{
                  label: 'Create Public MCP Server',
                  onClick: showCreateServerDialog
                }}
              />
            );
          }

          return (
            <ItemGrid.Root width="300px">
              {servers.data.items.map(server => {
                let listing = listingLookup.get(server.providerId);

                return (
                  <ItemGrid.Item
                    key={server.id}
                    href={Paths.instance.publicMcp.server(
                      organization.data,
                      project.data,
                      instance.data,
                      server.id
                    )}
                    entity={{ id: server.id }}
                    title={server.name}
                    variant="v2"
                    height={220}
                    icon={
                      <Avatar
                        entity={{
                          name: listing?.name ?? server.name,
                          photoUrl: listing?.imageUrl ?? undefined
                        }}
                        size={30}
                        noTooltip
                        imageFit="contain"
                      />
                    }
                    bottom={
                      <BottomRow>
                        <Text size="1">{server.slug}</Text>

                        {server.status !== 'active' && (
                          <PublicMcpServerStatusBadge status={server.status} />
                        )}
                      </BottomRow>
                    }
                  />
                );
              })}
            </ItemGrid.Root>
          );
        })
      )}
    </>
  );
};
