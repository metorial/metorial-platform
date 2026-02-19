import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfig,
  useProviderDeployment
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let ProviderConfigLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerDeploymentId, providerConfigId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let config = useProviderConfig(instance.data?.id, providerDeploymentId, providerConfigId);

  let pathname = useLocation().pathname;

  let configPathParams = [
    organization.data,
    project.data,
    instance.data,
    deployment.data?.id ?? providerDeploymentId,
    config.data?.id ?? providerConfigId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={config.data?.name ?? '...'}
        description={config.data?.description ?? undefined}
        pagination={[
          {
            label: 'Configurations',
            href: Paths.instance.providerDeployments(
              organization.data,
              project.data,
              instance.data,
              'configs'
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
            label: config.data?.name ?? '...',
            href: Paths.instance.providerConfig(...configPathParams)
          }
        ]}
      />

      {renderWithLoader({ config })(({ config }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.providerConfig(...configPathParams)
              },
              {
                label: 'Settings',
                to: Paths.instance.providerConfig(...configPathParams, 'settings')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
