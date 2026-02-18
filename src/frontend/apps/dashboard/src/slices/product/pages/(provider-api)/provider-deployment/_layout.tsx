import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployment
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let ProviderDeploymentLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);

  let pathname = useLocation().pathname;

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
      />

      {renderWithLoader({ deployment })(({ deployment }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.providerDeployment(...deploymentPathParams)
              },
              {
                label: 'Configs',
                to: Paths.instance.providerDeployment(...deploymentPathParams, 'configs')
              },
              {
                label: 'Auth Configs',
                to: Paths.instance.providerDeployment(...deploymentPathParams, 'auth-configs')
              },
              {
                label: 'Settings',
                to: Paths.instance.providerDeployment(...deploymentPathParams, 'settings')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
