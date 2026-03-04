import {
  DashboardInstanceMagicMcpSessionsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, useMagicMcpSessions } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let MagicSessionsTable = (filter: DashboardInstanceMagicMcpSessionsListQuery) => {
  let instance = useCurrentInstance();
  let sessions = useMagicMcpSessions(instance.data?.id, {
    ...filter,
    order: filter.order ?? 'desc'
  });

  return renderWithPagination(sessions)(sessions => (
    <>
      <Table
        headers={['Magic MCP Server', 'Subspace Session ID', 'Template ID', 'Created']}
        data={sessions.data.items.map(session => ({
          data: [
            <Text size="2" weight="strong">
              {session.magicMcpServer.name ?? 'Unknown Server'}
            </Text>,
            <Text size="2">{session.subspaceSessionId}</Text>,
            <Text size="2">{session.subspaceSessionTemplateId}</Text>,
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
