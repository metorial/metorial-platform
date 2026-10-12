import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { DetailsLayout } from '@metorial/details-layout';
import { ID } from '@metorial/ui-product';
import { RiSettings3Line } from '@remixicon/react';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfig
} from '@metorial/state';
import { RenderDate } from '@metorial/ui';
import { Outlet, useParams } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let ProviderAuthConfigLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerAuthConfigId } = useParams();
  let authConfig = useProviderAuthConfig(instance.data?.id, providerAuthConfigId);

  let authConfigPathParams = [
    organization.data,
    project.data,
    instance.data,
    authConfig.data?.id ?? providerAuthConfigId
  ] as const;

  let overviewPath = Paths.instance.providerAuthConfig(...authConfigPathParams);
  let settingsPath = Paths.instance.providerAuthConfig(...authConfigPathParams, 'settings');

  return (
    <DetailsLayout
      entity={authConfig.data}
      icon={<RiSettings3Line />}
      breadcrumbs={[
        {
          label: 'Auth Configs',
          to: Paths.instance.providerAuthConfigs(
            organization.data,
            project.data,
            instance.data
          )
        },
        {
          label: authConfig.data?.name ?? '...',
          to: overviewPath
        }
      ]}
      tabs={[
        {
          label: 'Overview',
          to: overviewPath
        },
        {
          label: 'Settings',
          to: settingsPath
        }
      ]}
      attributes={
        authConfig.data
          ? [
              { label: 'ID', value: <ID id={authConfig.data.id} /> },
              { label: 'Created', value: <RenderDate date={authConfig.data.createdAt} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ authConfig })(() => (
          <>
            <DeletedRecordCallout status={authConfig.data?.status} />

            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
