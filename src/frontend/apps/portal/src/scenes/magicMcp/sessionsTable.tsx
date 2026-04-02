import { renderWithPagination } from '@metorial/data-hooks';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import {
  MagicMcpSessionsListQuery,
  useMagicMcpSessions
} from '../../state/consumer/magicMcpSession';
import { usePaths } from '../../state/portal/path';

export let MagicMcpSessionsTable = (filter: MagicMcpSessionsListQuery = {}) => {
  let paths = usePaths();
  let sessions = useMagicMcpSessions({
    ...filter,
    order: filter.order ?? 'desc'
  });

  return renderWithPagination(sessions)(sessions => (
    <>
      <Table
        headers={['Session ID', 'Server', 'Session Template', 'Connected At']}
        data={sessions.data.items.map(session => ({
          data: [
            <Text size="2" weight="strong">
              {session.subspaceSessionId}
            </Text>,

            <div>
              <Text size="2" weight="strong">
                {session.magicMcpServer.name ?? 'Unknown Server'}
              </Text>
              <Text size="1" color="gray600">
                {session.magicMcpServer.id}
              </Text>
            </div>,

            session.subspaceSessionTemplateId ? (
              <ID id={session.subspaceSessionTemplateId} />
            ) : (
              <Badge color="gray">Unknown Template</Badge>
            ),
            <RenderDate date={session.createdAt} />
          ],
          href: paths.magicMcpServerSessions(session.magicMcpServer.id)
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
