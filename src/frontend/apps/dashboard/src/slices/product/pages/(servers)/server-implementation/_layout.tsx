import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useServerImplementation
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { showServerDeploymentFormModal } from '../../../scenes/server-deployments/modal';

export let ServerImplementationLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { serverImplementationId } = useParams();
  let implementation = useServerImplementation(instance.data?.id, serverImplementationId);

  let pathname = useLocation().pathname;

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    implementation.data?.id ?? serverImplementationId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={implementation.data?.name ?? implementation.data?.server.name ?? '...'}
        description={implementation.data?.description ?? undefined}
        pagination={[
          {
            label: 'Implementations',
            href: Paths.instance.serverImplementations(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: implementation.data?.server.name,
            href: Paths.instance.serverImplementation(
              organization.data,
              project.data,
              instance.data,
              implementation.data?.id ?? serverImplementationId
            )
          }
        ]}
        actions={
          <>
            <Link
              to={Paths.instance.server(
                organization.data,
                project.data,
                instance.data,
                implementation.data?.server.id
              )}
              className="btn btn-primary"
            >
              <Button as="span" size="2">
                View Server
              </Button>
            </Link>

            <Button
              as="span"
              size="2"
              onClick={() => {
                if (!implementation.data) return;

                showServerDeploymentFormModal({
                  type: 'create',
                  for: {
                    serverImplementationId: implementation.data.id,
                    serverId: implementation.data.server.id,
                    serverVariantId: implementation.data.serverVariant.id
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
            label: 'Configuration',
            to: Paths.instance.serverImplementation(...serverPathParams)
          },
          {
            label: 'Runs',
            to: Paths.instance.serverImplementation(...serverPathParams, 'runs')
          },
          {
            label: 'Errors',
            to: Paths.instance.serverImplementation(...serverPathParams, 'errors')
          },
          {
            label: 'Deployments',
            to: Paths.instance.serverImplementation(...serverPathParams, 'deployments')
          }
        ]}
      />

      {renderWithLoader({ implementation })(() => (
        <Outlet />
      ))}
    </ContentLayout>
  );
};
