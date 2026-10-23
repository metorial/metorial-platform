import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { DetailsLayout } from '@metorial/details-layout';
import { ID } from '@metorial/ui-product';
import { RiSettings3Line } from '@remixicon/react';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfig
} from '@metorial/state';
import { RenderDate } from '@metorial/ui';
import { Outlet, useParams } from 'react-router-dom';
import { ResourceOwnerInline } from '../../../components/resourceOwnerEntity';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let ProviderConfigLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { providerConfigId } = useParams();
  let config = useProviderConfig(instance.data?.id, providerConfigId);

  let configPathParams = [
    organization.data,
    project.data,
    instance.data,
    config.data?.id ?? providerConfigId
  ] as const;
  let overviewPath = Paths.instance.providerConfig(...configPathParams);
  let settingsPath = Paths.instance.providerConfig(...configPathParams, 'settings');

  return (
    <DetailsLayout
      entity={config.data}
      icon={<RiSettings3Line />}
      breadcrumbs={[
        {
          label: 'Configs',
          to: Paths.instance.providerConfigs(organization.data, project.data, instance.data)
        },
        {
          label: config.data?.name ?? '...',
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
        config.data
          ? [
              { label: 'ID', value: <ID id={config.data.id} /> },
              ...(config.data.ownerActor
                ? [{ label: 'Owner', value: <ResourceOwnerInline resource={config.data} /> }]
                : []),
              { label: 'Created', value: <RenderDate date={config.data.createdAt} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ config })(() => (
          <>
            <DeletedRecordCallout status={config.data?.status} />

            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
