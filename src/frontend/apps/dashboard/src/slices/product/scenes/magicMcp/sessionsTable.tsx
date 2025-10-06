import {
  DashboardInstanceMagicMcpSessionsListQuery,
  MagicMcpSessionsGetOutput
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useMagicMcpSessions } from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let SessionConnectionStatusBadge = ({
  session
}: {
  session: MagicMcpSessionsGetOutput;
}) => {
  return (
    <Badge
      color={
        {
          connected: 'blue' as const,
          disconnected: 'gray' as const
        }[session.connectionStatus]
      }
    >
      {{
        connected: 'Connected',
        disconnected: 'Disconnected'
      }[session.connectionStatus] ?? session.connectionStatus}
    </Badge>
  );
};

export let MagicSessionsTable = (filter: DashboardInstanceMagicMcpSessionsListQuery) => {
  let instance = useCurrentInstance();
  let sessions = useMagicMcpSessions(instance.data?.id, {
    ...filter,
    order: filter.order ?? 'desc'
  });

  return renderWithPagination(sessions)(sessions => (
    <>
      <Table
        headers={['Status', 'Magic MCP Server', 'MCP Client', 'Connected At']}
        data={sessions.data.items.map(session => ({
          data: [
            <SessionConnectionStatusBadge session={session} />,
            <Text size="2" weight="strong">
              {session.magicMcpServer.name}
            </Text>,
            <Text size="2">
              {session.client?.info?.name ?? (
                <span style={{ color: theme.colors.gray600 }}>Unknown Client</span>
              )}
            </Text>,
            <RenderDate date={session.createdAt} />
          ],
          href: Paths.instance.magicMcp.session(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            session.id
          )
        }))}
      />

      {sessions.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No Magic MCP sessions found.
        </Text>
      )}
    </>
  ));
};
