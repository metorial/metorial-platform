import {
  DashboardInstanceSessionsConnectionsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useAllSessionConnections,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

let ConnectionStatusBadge = ({ state }: { state: string }) => {
  return (
    <Badge
      color={
        {
          connected: 'blue' as const,
          disconnected: 'gray' as const
        }[state] ?? ('gray' as const)
      }
    >
      {{
        connected: 'Connected',
        disconnected: 'Disconnected'
      }[state] ?? state}
    </Badge>
  );
};

export let MagicConnectionsTable = (
  filter: Omit<DashboardInstanceSessionsConnectionsListQuery, 'sessionId'>
) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let connections = useAllSessionConnections(instance.data?.id, {
    ...filter,
    order: filter.order ?? 'desc'
  });

  return renderWithPagination(connections)(connections => (
    <>
      <Table
        headers={['Status', 'MCP Client', 'Transport', 'Connected At']}
        data={connections.data.items.map(connection => ({
          data: [
            <ConnectionStatusBadge state={connection.connectionState} />,
            <Text size="2" weight="strong">
              {connection.participant?.name ?? (
                <span style={{ color: theme.colors.gray600 }}>Unknown Client</span>
              )}
            </Text>,
            <Text size="2">{connection.transport}</Text>,
            <RenderDate date={connection.createdAt} />
          ],
          href: Paths.instance.magicMcp.connection(
            organization.data,
            project.data,
            instance.data,
            connection.id
          )
        }))}
      />

      {connections.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No Magic MCP connections found.
        </Text>
      )}
    </>
  ));
};