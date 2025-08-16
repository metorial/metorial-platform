import { DashboardInstanceCustomServersListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomServers } from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let CustomServersTable = (filter: DashboardInstanceCustomServersListQuery) => {
  let instance = useCurrentInstance();
  let customServers = useCustomServers(instance.data?.id, {
    ...filter,
    order: 'desc'
  });

  return renderWithPagination(customServers)(customServers => (
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
              remote: <Badge color="purple">Remote</Badge>
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
          No custom servers found
        </Text>
      )}
    </>
  ));
};
