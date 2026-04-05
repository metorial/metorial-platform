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

  let { providerAuthConfigId } = useParams();
  let authConfig = useProviderAuthConfig(instance.data?.id, providerAuthConfigId);

  let location = useLocation();
  let pathname = location.pathname;
  let locationSearch = location.search;
  let fromDeployment =
    new URLSearchParams(locationSearch).get('fromDeployment') ||
    authConfig.data?.deployment?.id;
  let deploymentSearch = fromDeployment
    ? `?fromDeployment=${encodeURIComponent(fromDeployment)}`
    : '';

  let deployment = useProviderDeployment(instance.data?.id, fromDeployment);

  let authConfigPathParams = [
    organization.data,
    project.data,
    instance.data,
    authConfig.data?.id ?? providerAuthConfigId
  ] as const;

  let deploymentBreadcrumbParams = [
    organization.data,
    project.data,
    instance.data,
    deployment.data?.id ?? fromDeployment
  ] as const;

  let overviewPath = `${Paths.instance.providerAuthConfig(...authConfigPathParams)}${deploymentSearch}`;
  let settingsPath = `${Paths.instance.providerAuthConfig(...authConfigPathParams, 'settings')}${deploymentSearch}`;

  let pagination = fromDeployment
    ? [
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
          href:
            `${Paths.instance.providerDeployment(...deploymentBreadcrumbParams)}` +
            deploymentSearch
        },
        {
          label: 'Auth Configs',
          href:
            `${Paths.instance.providerDeployment(...deploymentBreadcrumbParams, 'auth-configs')}` +
            deploymentSearch
        },
        {
          label: authConfig.data?.name ?? '...',
          href: overviewPath
        }
      ]
    : [
        {
          label: 'Auth Configs',
          href: Paths.instance.providerAuthConfigs(
            organization.data,
            project.data,
            instance.data
          )
        },
        {
          label: authConfig.data?.name ?? '...',
          href: overviewPath
        }
      ];

  return (
    <ContentLayout>
      <PageHeader
        title={authConfig.data?.name ?? '...'}
        description={authConfig.data?.description ?? undefined}
        pagination={pagination}
      />

      {renderWithLoader({ authConfig })(() => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: overviewPath
              },
              {
                label: 'Settings',
                to: settingsPath
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
