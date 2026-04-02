import { ContentLayout, PageHeader } from '@metorial/layout';
import { Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
import { createMagicMcpTokenModal } from '../../../../scenes/magicMcp/tokensTable';
import { usePaths } from '../../../../state/portal/path';

export let MagicMcpListLayout = () => {
  let paths = usePaths();
  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      {pathname.endsWith('servers') && (
        <PageHeader title="Magic MCP Servers" description="Manage your Magic MCP servers." />
      )}

      {pathname.endsWith('sessions') && (
        <PageHeader
          title="Magic MCP Sessions"
          description="Review portal-side sessions opened against your Magic MCP servers."
        />
      )}

      {pathname.endsWith('tokens') && (
        <PageHeader
          title="Magic MCP Tokens"
          description="Magic MCP tokens allow secure access to your Magic MCP servers."
          actions={
            <Button size="2" onClick={() => createMagicMcpTokenModal()}>
              Create Magic MCP Token
            </Button>
          }
        />
      )}

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

      <Outlet />
    </ContentLayout>
  );
};
