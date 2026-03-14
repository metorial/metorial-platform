import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfig,
  useProviderDeployment
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let ProviderAuthConfigLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerDeploymentId, providerAuthConfigId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let authConfig = useProviderAuthConfig(
    instance.data?.id,
    providerDeploymentId,
    providerAuthConfigId
  );

  let pathname = useLocation().pathname;

  let authConfigPathParams = [
    organization.data,
    project.data,
    instance.data,
    deployment.data?.id ?? providerDeploymentId,
    authConfig.data?.id ?? providerAuthConfigId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={authConfig.data?.name ?? '...'}
        description={authConfig.data?.description ?? undefined}
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
            label: deployment.data?.name ?? '...',
            href: Paths.instance.providerDeployment(
              organization.data,
              project.data,
              instance.data,
              deployment.data?.id ?? providerDeploymentId
            )
          },
          {
            label: 'Auth Configs',
            href: Paths.instance.providerDeployment(
              organization.data,
              project.data,
              instance.data,
              deployment.data?.id ?? providerDeploymentId,
              'auth-configs'
            )
          },
          {
            label: authConfig.data?.name ?? '...',
            href: Paths.instance.providerAuthConfig(...authConfigPathParams)
          }
        ]}
      />

      {renderWithLoader({ authConfig })(({ authConfig }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.providerAuthConfig(...authConfigPathParams)
              },
              {
                label: 'Settings',
                to: Paths.instance.providerAuthConfig(...authConfigPathParams, 'settings')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
