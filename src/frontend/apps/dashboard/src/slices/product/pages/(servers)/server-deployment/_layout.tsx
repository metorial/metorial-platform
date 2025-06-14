import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useServerDeployment
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';

export let ServerDeploymentLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  let pathname = useLocation().pathname;

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    deployment.data?.id ?? serverDeploymentId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={deployment.data?.name ?? deployment.data?.server.name ?? '...'}
        description={deployment.data?.description ?? undefined}
        pagination={[
          {
            label: 'Deployments',
            href: Paths.instance.serverDeployments(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: deployment.data?.server.name,
            href: Paths.instance.serverDeployment(
              organization.data,
              project.data,
              instance.data,
              deployment.data?.id ?? serverDeploymentId
            )
          }
        ]}
        actions={
          <>
            <Link
              to={Paths.instance.serverImplementation(
                organization.data,
                project.data,
                instance.data,
                deployment.data?.serverImplementation.id
              )}
            >
              <Button as="span" size="2" variant="outline">
                View Implementation
              </Button>
            </Link>

            <Link
              to={Paths.instance.explorer(organization.data, project.data, instance.data, {
                server_deployment_id: deployment.data?.id
              })}
            >
              <Button as="span" size="2">
                Open Explorer
              </Button>
            </Link>

            {/* <Link
              to={Paths.instance.server(
                organization.data,
                project.data,
                instance.data,
                deployment.data?.server.id
              )}
            >
              <Button as="span" size="2">
                View Server
              </Button>
            </Link> */}
          </>
        }
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Overview',
            to: Paths.instance.serverDeployment(...serverPathParams)
          },
          {
            label: 'Configuration',
            to: Paths.instance.serverDeployment(...serverPathParams, 'config')
          },
          {
            label: 'Runs',
            to: Paths.instance.serverDeployment(...serverPathParams, 'runs')
          },
          {
            label: 'Errors',
            to: Paths.instance.serverDeployment(...serverPathParams, 'errors')
          }
        ]}
      />

      {renderWithLoader({ deployment })(() => (
        <Outlet />
      ))}
    </ContentLayout>
  );
};
