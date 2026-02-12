import { DashboardInstanceCustomServersListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomServers } from '@metorial/state';
import { Badge, Input, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useState } from 'react';
import { useDebounced } from '../../../../hooks/useDebounced';

export let CustomServersTable = (
  filter: DashboardInstanceCustomServersListQuery & { withSearch?: boolean }
) => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 300);

  let instance = useCurrentInstance();
  let customServers = useCustomServers(instance.data?.instanceId, {
    ...filter,
    search: filter.withSearch ? searchDebounced : undefined,
    order: 'desc'
  });

  return (
    <>
      {filter.withSearch && (
        <>
          <Input
            label="Search Custom Providers"
            hideLabel
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <Spacer height={15} />
        </>
      )}

      {renderWithPagination(customServers)(customServers => (
        <>
          <Table
            headers={[
              'Info',
              'Type',
              ...(filter.type == 'remote' ? ['Remote URL'] : []),
              'Created'
            ]}
            data={customServers.data.items.map(customServer => ({
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
                {
                  remote: <Badge color="purple">Remote</Badge>,
                  managed: <Badge color="blue">Managed</Badge>,
                  docker: <Badge color="orange">Docker</Badge>
                }[customServer.type] ?? customServer.type,
                ...(filter.type == 'remote'
                  ? [
                      <Text size="2" color="gray800">
                        {(customServer.serverVariant?.source as any)?.remote?.domain}
                      </Text>
                    ]
                  : []),
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

          {customServers.data.items.length == 0 && (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No custom providers found.
            </Text>
          )}
        </>
      ))}
    </>
  );
};
