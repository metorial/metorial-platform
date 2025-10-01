import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useServer
} from '@metorial/state';
import { Badge, Button, LinkTabs } from '@metorial/ui';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { showServerDeploymentFormModal } from '../../../scenes/serverDeployments/modal';

export let ServerLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { serverId } = useParams();
  let server = useServer(instance.data?.id, serverId);

  let pathname = useLocation().pathname;

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    server.data?.id ?? serverId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={
          <span style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
            <div style={{ display: 'flex' }}>
              <Badge color="red">Test</Badge>
            </div>
            <span>{server.data?.name ?? '...'}</span>
          </span>
        }
        description={server.data?.description ?? undefined}
        pagination={[
          {
            label: 'Servers',
            href: Paths.instance.servers(organization.data, project.data, instance.data)
          },
          {
            label: server.data?.name,
            href: Paths.instance.server(
              organization.data,
              project.data,
              instance.data,
              server.data?.id ?? serverId
            )
          }
        ]}
        actions={
          <>
            <Link
              to={Paths.instance.explorer(organization.data, project.data, instance.data, {
                server_id: server.data?.id
              })}
            >
              <Button as="span" size="2" variant="outline">
                Open Explorer
              </Button>
            </Link>

            <Button
              size="2"
              disabled={!server.data?.variants.length}
              onClick={() => {
                if (!server.data) return;

                showServerDeploymentFormModal({
                  type: 'create',
                  for: {
                    serverId: server.data.id
                  }
                });
              }}
            >
              Deploy Server
            </Button>
          </>
        }
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Overview',
            to: Paths.instance.server(...serverPathParams)
          },
          {
            label: 'Readme',
            to: Paths.instance.server(...serverPathParams, 'readme')
          },
          {
            label: 'Deployments',
            to: Paths.instance.server(...serverPathParams, 'deployments')
          },
          {
            label: 'Implementations',
            to: Paths.instance.server(...serverPathParams, 'implementations')
          }
        ]}
      />

      {renderWithLoader({ server })(() => (
        <Outlet />
      ))}
    </ContentLayout>
  );
};
