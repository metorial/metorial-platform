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

export let ProviderAuthConnectionLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerDeploymentId, providerAuthConfigId } = useParams();
  let deployment = useProviderDeployment(instance.data?.instanceId, providerDeploymentId);
  let authConfig = useProviderAuthConfig(
    instance.data?.instanceId,
    providerDeploymentId,
    providerAuthConfigId
  );

  let pathname = useLocation().pathname;

  let connectionPathParams = [
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
            label: 'Configurations',
            href: Paths.instance.providerDeployments(
              organization.data,
              project.data,
              instance.data,
              'auth-configs'
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
            label: authConfig.data?.name ?? '...',
            href: Paths.instance.providerAuthConnection(...connectionPathParams)
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
                to: Paths.instance.providerAuthConnection(...connectionPathParams)
              },
              {
                label: 'Settings',
                to: Paths.instance.providerAuthConnection(...connectionPathParams, 'settings')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
