import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout } from '@metorial/layout/src/components/content';
import { PageHeader } from '@metorial/layout/src/components/header';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { useMagicMcpServer } from '../../../../state/consumer/magicMcpServer';
import { usePaths } from '../../../../state/portal/path';

export let MagicMcpServerLayout = () => {
  let Paths = usePaths();
  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(magicMcpServerId);

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title={server.data?.name ?? '...'}
        description={server.data?.description ?? undefined}
        pagination={[
          {
            label: 'Magic MCP Servers',
            href: Paths.magicMcpServers()
          },
          {
            label: server.data?.name,
            href: Paths.magicMcpServer(server.data?.id ?? magicMcpServerId)
          }
        ]}
      />

      {renderWithLoader({ server })(({ server }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.magicMcpServer(server.data.id)
              },
              {
                label: 'Sessions',
                to: Paths.magicMcpServer(server.data.id, 'sessions')
              },
              {
                label: 'Settings',
                to: Paths.magicMcpServer(server.data.id, 'config')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
