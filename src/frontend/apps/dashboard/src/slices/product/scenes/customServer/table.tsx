import { DashboardInstanceCustomProvidersListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomServers } from '@metorial/state';
import { Badge, Input, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useState } from 'react';
import { useDebounced } from '../../../../hooks/useDebounced';

let statusColor = (status: string | null) => {
  switch (status) {
    case 'active':
      return 'green' as const;
    case 'deploying':
    case 'building':
      return 'blue' as const;
    case 'archived':
      return 'gray' as const;
    case 'error':
    case 'failed':
      return 'red' as const;
    default:
      return 'blue' as const;
  }
};

export let CustomServersTable = (
  filter: DashboardInstanceCustomProvidersListQuery & { withSearch?: boolean }
) => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 300);
  let normalizedSearch = searchDebounced.trim().toLowerCase();
  let { withSearch, ...query } = filter;

  let instance = useCurrentInstance();
  let customServers = useCustomServers(instance.data?.id, {
    ...query,
    order: 'desc'
  });

  return (
    <>
      {withSearch && (
        <>
          <Input
            label="Search Providers"
            hideLabel
            placeholder="Search providers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <Spacer height={15} />
        </>
      )}

      {renderWithPagination(customServers)(customServers => {
        let items = normalizedSearch
          ? customServers.data.items.filter(customServer => {
              let haystack = [
                customServer.name,
                customServer.description,
                customServer.provider?.name,
                customServer.provider?.slug,
                customServer.provider?.identifier
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

              return haystack.includes(normalizedSearch);
            })
          : customServers.data.items;

        return (
          <>
            <Table
              headers={[
                'Provider',
                'Status',
                'Version',
                'Created'
              ]}
              data={items.map(customServer => ({
                data: [
                  <Text size="2" weight="strong">
                    {customServer.name ?? (
                      <span style={{ color: theme.colors.gray600 }}>Untitled</span>
                    )}

                    {customServer.description && (
                      <Text size="2" color="gray600">
                        {customServer.description.slice(0, 60)}
                        {customServer.description.length > 60 ? '...' : ''}
                      </Text>
                    )}
                  </Text>,
                  <Badge color={statusColor(customServer.status)}>
                    {customServer.status ?? 'unknown'}
                  </Badge>,
                  <Text size="2" color="gray600">
                    {customServer.provider?.currentVersion?.version ?? '-'}
                  </Text>,
                  <RenderDate date={customServer.createdAt} />
                ],
                href: Paths.instance.customServer(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data,
                  customServer.id
                )
              }))}
            />

            {items.length == 0 && (
              <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
                {searchDebounced ? 'No providers match your search.' : 'No providers found.'}
              </Text>
            )}
          </>
        );
      })}
    </>
  );
};
