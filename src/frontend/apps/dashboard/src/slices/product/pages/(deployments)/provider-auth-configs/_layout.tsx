import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
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
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let ProviderAuthConfigLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerAuthConfigId } = useParams();
  let authConfig = useProviderAuthConfig(instance.data?.id, providerAuthConfigId);

  let location = useLocation();
  let pathname = location.pathname;
  let deploymentId = authConfig.data?.deployment?.id;

  let deployment = useProviderDeployment(instance.data?.id, deploymentId);

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
    deployment.data?.id ?? deploymentId
  ] as const;

  let overviewPath = Paths.instance.providerAuthConfig(...authConfigPathParams);
  let settingsPath = Paths.instance.providerAuthConfig(...authConfigPathParams, 'settings');

  let pagination = deploymentId
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
          href: Paths.instance.providerDeployment(...deploymentBreadcrumbParams)
        },
        {
          label: 'Auth Configs',
          href: Paths.instance.providerDeployment(
            ...deploymentBreadcrumbParams,
            'auth-configs'
          )
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

      <InitialLoadBoundary>
        {renderWithLoader({ authConfig })(() => (
          <>
            <DeletedRecordCallout status={authConfig.data?.status} />

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
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
