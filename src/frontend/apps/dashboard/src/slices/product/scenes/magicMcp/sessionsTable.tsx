// Types removed in Provider API migration
type MagicMcpSessionData = {
  id: string;
  name: string | null;
  status: string | null;
  connectionStatus: string | null;
  magicMcpServer: { id: string; name: string | null } | null;
  client: { name: string | null; version: string | null } | null;
  sessionId: string | null;
  createdAt: Date;
};
type MagicMcpSessionsListQuery = Record<string, unknown>;

import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useMagicMcpSessions } from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let SessionConnectionStatusBadge = ({
  session
}: {
  session: MagicMcpSessionData;
}) => {
  return (
    <Badge
      color={
        ({
          connected: 'blue' as const,
          disconnected: 'gray' as const
        } as Record<string, 'blue' | 'gray'>)[session.connectionStatus ?? '']
      }
    >
      {({
        connected: 'Connected',
        disconnected: 'Disconnected'
      } as Record<string, string>)[session.connectionStatus ?? ''] ?? session.connectionStatus}
    </Badge>
  );
};

export let MagicSessionsTable = (filter: MagicMcpSessionsListQuery) => {
  let instance = useCurrentInstance();
  let sessions = useMagicMcpSessions(instance.data?.id, {
    ...filter,
    order: (filter as { order?: string }).order ?? 'desc'
  });

  return renderWithPagination(sessions)(sessions => (
    <>
      <Table
        headers={['Status', 'Magic MCP Server', 'MCP Client', 'Connected At']}
        data={sessions.data.items.map(session => ({
          data: [
            <SessionConnectionStatusBadge session={session} />,
            <Text size="2" weight="strong">
              {session.magicMcpServer?.name ?? 'Unknown Server'}
            </Text>,
            <Text size="2">
              {session.client?.name ?? (
                <span style={{ color: theme.colors.gray600 }}>Unknown Client</span>
              )}
            </Text>,
            <RenderDate date={session.createdAt} />
          ],
          href: Paths.instance.session(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            session.sessionId ?? session.id
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
