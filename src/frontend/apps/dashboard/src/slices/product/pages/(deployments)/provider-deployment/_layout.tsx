import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployment
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let ProviderDeploymentLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);

  let location = useLocation();
  let pathname = location.pathname;
  let search = location.search;

  let deploymentPathParams = [
    organization.data,
    project.data,
    instance.data,
    deployment.data?.id ?? providerDeploymentId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={deployment.data?.name ?? '...'}
        description={deployment.data?.description ?? undefined}
        pagination={[
          {
            label: 'Deployments',
            href: Paths.instance.providerDeployments(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: deployment.data?.name,
            href: Paths.instance.providerDeployment(
              organization.data,
              project.data,
              instance.data,
              deployment.data?.id ?? providerDeploymentId
            )
          }
        ]}
        actions={
          <>
            <Link
              to={Paths.instance.provider(
                organization.data,
                project.data,
                instance.data,
                deployment.data?.providerId
              )}
            >
              <Button as="span" size="2" variant="outline">
                View Provider
              </Button>
            </Link>

            <Link
              to={Paths.instance.explorer(organization.data, project.data, instance.data, {
                provider_deployment_id: deployment.data?.id ?? providerDeploymentId
              })}
            >
              <Button as="span" size="2">
                Open Explorer
              </Button>
            </Link>
          </>
        }
      />

      {renderWithLoader({ deployment })(({ deployment }) => (
        <>
          <DeletedRecordCallout status={deployment.data?.status} />

          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: `${Paths.instance.providerDeployment(...deploymentPathParams)}${search}`
              },
              {
                label: 'Auth Configs',
                to: `${Paths.instance.providerDeployment(...deploymentPathParams, 'auth-configs')}${search}`
              },
              {
                label: 'Auth Credentials',
                to: `${Paths.instance.providerDeployment(...deploymentPathParams, 'auth-credentials')}${search}`
              },
              {
                label: 'Auth Methods',
                to: `${Paths.instance.providerDeployment(...deploymentPathParams, 'auth-methods')}${search}`
              },
              {
                label: 'Configs',
                to: `${Paths.instance.providerDeployment(...deploymentPathParams, 'configs')}${search}`
              },
              {
                label: 'Vaults',
                to: `${Paths.instance.providerDeployment(...deploymentPathParams, 'config-vaults')}${search}`
              },
              {
                label: 'Settings',
                to: `${Paths.instance.providerDeployment(...deploymentPathParams, 'settings')}${search}`
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
