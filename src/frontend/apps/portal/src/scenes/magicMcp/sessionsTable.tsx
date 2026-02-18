import {
  MagicMcpSessionsGetOutput,
  MagicMcpSessionsListQuery
} from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMagicMcpSessions } from '../../state/consumer/magicMcpSession';
import { usePaths } from '../../state/portal/path';

export let MagicMcpSessionConnectionStatusBadge = ({
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

export let MagicMcpSessionsTable = (filter: MagicMcpSessionsListQuery) => {
  let Paths = usePaths();
  let sessions = useMagicMcpSessions({
    ...filter,
    order: filter.order ?? 'desc'
  });

  return renderWithPagination(sessions)(sessions => (
    <>
      <Table
        headers={['Status', 'Magic MCP Server', 'MCP Client', 'Connected At']}
        data={sessions.data.items.map(session => ({
          data: [
            <MagicMcpSessionConnectionStatusBadge session={session} />,
            <Text size="2" weight="strong">
              {session.magicMcpServer.name ?? 'Unknown Server'}
            </Text>,
            <Text size="2">
              {session.client?.info?.name ?? (
                <span style={{ color: theme.colors.gray600 }}>Unknown Client</span>
              )}
            </Text>,
            <RenderDate date={session.createdAt} />
          ]
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
