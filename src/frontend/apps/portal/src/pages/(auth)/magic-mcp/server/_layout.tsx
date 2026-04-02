import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { useMagicMcpServer } from '../../../../state/consumer/magicMcpServer';
import { usePaths } from '../../../../state/portal/path';

export let MagicMcpServerLayout = () => {
  let paths = usePaths();
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
            label: 'Magic MCP servers',
            href: paths.magicMcpServers()
          },
          {
            label: server.data?.name,
            href: paths.magicMcpServer(server.data?.id ?? magicMcpServerId)
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
                to: paths.magicMcpServer(server.data.id)
              },
              {
                label: 'Sessions',
                to: paths.magicMcpServer(server.data.id, 'sessions')
              },
              {
                label: 'Settings',
                to: paths.magicMcpServerSettings(server.data.id)
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
