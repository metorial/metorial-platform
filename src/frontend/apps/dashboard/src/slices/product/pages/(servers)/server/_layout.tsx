import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useServer
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { showServerDeploymentFormModal } from '../../../scenes/server-deployments/modal';

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
        title={server.data?.name ?? '...'}
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
            <Button
              as="span"
              size="2"
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
              Create Deployment
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
