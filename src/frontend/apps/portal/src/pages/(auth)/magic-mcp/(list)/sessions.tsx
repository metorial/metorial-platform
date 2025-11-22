import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { LinkTabs } from '@metorial/ui';
import { useLocation } from 'react-router-dom';
import { MagicMcpSessionsTable } from '../../../../scenes/magicMcp/sessionsTable';
import { usePaths } from '../../../../state/portal/path';

export let MagicMcpSessionsPage = () => {
  let pathname = useLocation().pathname;
  let Paths = usePaths();

  return (
    <ContentLayout>
      <PageHeader
        title="Magic MCP Connections"
        description="Revisit your Magic MCP session history."
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Deployments',
            to: Paths.magicMcpServers()
          },
          {
            label: 'Connections',
            to: Paths.magicMcpSessions()
          }
        ]}
      />

      {renderWithLoader({})(({}) => (
        <MagicMcpSessionsTable />
      ))}
    </ContentLayout>
  );
};
