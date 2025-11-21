import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { Button, LinkTabs } from '@metorial/ui';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
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
        actions={
          <>
            <Link
              to={Paths.explorer({
                server_deployment_id: server.data?.serverDeployments[0]?.id
              })}
            >
              <Button as="span" size="2">
                Open Explorer
              </Button>
            </Link>
          </>
        }
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
