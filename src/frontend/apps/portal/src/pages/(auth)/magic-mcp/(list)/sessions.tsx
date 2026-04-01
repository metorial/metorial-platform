import { ContentLayout, PageHeader } from '@metorial/layout';
import { LinkTabs } from '@metorial/ui';
import { useLocation } from 'react-router-dom';
import { MagicMcpSessionsTable } from '../../../../scenes/magicMcp/sessionsTable';
import { usePaths } from '../../../../state/portal/path';

export let MagicMcpSessionsPage = () => {
  let pathname = useLocation().pathname;
  let paths = usePaths();

  return (
    <ContentLayout>
      <PageHeader
        title="Magic MCP Sessions"
        description="Review portal-side sessions opened against your Magic MCP servers."
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Servers',
            to: paths.magicMcpServers()
          },
          {
            label: 'Sessions',
            to: paths.magicMcpSessions()
          },
          {
            label: 'Tokens',
            to: paths.magicMcpTokens()
          }
        ]}
      />

      <MagicMcpSessionsTable />
    </ContentLayout>
  );
};
