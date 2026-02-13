import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useMagicMcpServer,
  useServerDeployment
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';

export let MagicMcpServerLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let defaultServerDeploymentId = server.data?.serverDeployments?.[0]?.id;
  let serverDeployment = useServerDeployment(instance.data?.id, defaultServerDeploymentId);

  let pathname = useLocation().pathname;

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    server.data?.id ?? magicMcpServerId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={server.data?.name ?? '...'}
        description={server.data?.description ?? undefined}
        pagination={[
          {
            label: 'Magic MCP Servers',
            href: Paths.instance.magicMcp.servers(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: server.data?.name,
            href: Paths.instance.magicMcp.server(
              organization.data,
              project.data,
              instance.data,
              server.data?.id ?? magicMcpServerId
            )
          }
        ]}
        actions={
          defaultServerDeploymentId ? (
            <Link
              to={Paths.instance.explorer(organization.data, project.data, instance.data, {
                server_deployment_id: defaultServerDeploymentId
              })}
            >
              <Button as="span" size="2">
                Open Explorer
              </Button>
            </Link>
          ) : null
        }
      />

      {renderWithLoader({ server })(({ server }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.magicMcp.server(...serverPathParams)
              },
              {
                label: 'Sessions',
                to: Paths.instance.magicMcp.server(...serverPathParams, 'sessions')
              },
              // {
              //   label: 'Runs',
              //   to: Paths.instance.magicMcp.server(...serverPathParams, 'runs')
              // },
              {
                label: 'Errors',
                to: Paths.instance.magicMcp.server(...serverPathParams, 'errors')
              },
              ...(serverDeployment.data?.oauthConnection
                ? [
                    {
                      label: 'OAuth Configuration',
                      to: Paths.instance.magicMcp.server(...serverPathParams, 'oauth')
                    }
                  ]
                : []),
              {
                label: 'Settings',
                to: Paths.instance.magicMcp.server(...serverPathParams, 'config')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
