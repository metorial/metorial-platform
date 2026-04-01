import { ContentLayout, PageHeader } from '@metorial/layout';
import { Button, LinkTabs } from '@metorial/ui';
import { useLocation } from 'react-router-dom';
import {
  createMagicMcpTokenModal,
  MagicMcpTokensTable
} from '../../../../scenes/magicMcp/tokensTable';
import { usePaths } from '../../../../state/portal/path';

export let MagicMcpTokensPage = () => {
  let pathname = useLocation().pathname;
  let paths = usePaths();

  return (
    <ContentLayout>
      <PageHeader
        title="Magic MCP Tokens"
        description="Magic MCP tokens allow secure access to your Magic MCP servers."
        actions={
          <Button size="2" onClick={() => createMagicMcpTokenModal()}>
            Create Magic MCP Token
          </Button>
        }
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

      <MagicMcpTokensTable />
    </ContentLayout>
  );
};
