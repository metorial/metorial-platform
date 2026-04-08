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
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';
import { getFromDeployment, withFromDeployment } from '../fromDeployment';

export let ProviderConfigLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerConfigId } = useParams();
  let config = useProviderConfig(instance.data?.id, providerConfigId);

  let location = useLocation();
  let pathname = location.pathname;
  let fromDeployment = getFromDeployment(location.search, config.data?.deployment?.id);
  let deployment = useProviderDeployment(instance.data?.id, fromDeployment);

  let configPathParams = [
    organization.data,
    project.data,
    instance.data,
    config.data?.id ?? providerConfigId
  ] as const;
  let deploymentPathParams = [
    organization.data,
    project.data,
    instance.data,
    deployment.data?.id ?? fromDeployment
  ] as const;
  let overviewPath = withFromDeployment(
    Paths.instance.providerConfig(...configPathParams),
    fromDeployment
  );
  let settingsPath = withFromDeployment(
    Paths.instance.providerConfig(...configPathParams, 'settings'),
    fromDeployment
  );

  return (
    <ContentLayout>
      <PageHeader
        title={config.data?.name ?? '...'}
        description={config.data?.description ?? undefined}
        pagination={
          fromDeployment
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
                  href: withFromDeployment(
                    Paths.instance.providerDeployment(...deploymentPathParams),
                    fromDeployment
                  )
                },
                {
                  label: 'Configs',
                  href: withFromDeployment(
                    Paths.instance.providerDeployment(...deploymentPathParams, 'configs'),
                    fromDeployment
                  )
                },
                {
                  label: config.data?.name ?? '...',
                  href: overviewPath
                }
              ]
            : [
                {
                  label: 'Configs',
                  href: Paths.instance.providerConfigs(
                    organization.data,
                    project.data,
                    instance.data
                  )
                },
                {
                  label: config.data?.name ?? '...',
                  href: overviewPath
                }
              ]
        }
      />

      {renderWithLoader({ config })(() => (
        <>
          <DeletedRecordCallout status={config.data?.status} />

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
