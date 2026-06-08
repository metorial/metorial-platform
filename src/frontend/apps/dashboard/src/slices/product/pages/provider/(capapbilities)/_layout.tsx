import { Paths } from '@metorial/frontend-config';
import { SimpleSidebarLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Select } from '@metorial/ui';
import { Outlet, useParams } from 'react-router-dom';
import { useProviderVersionContext } from '../_layout';

export let ProviderCapabilitiesLayout = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let { providerId } = useParams();
  let { selectedVersionId, setSelectedVersionId, currentVersionId, allVersions } =
    useProviderVersionContext();

  let providerPathParams = [
    organization.data,
    project.data,
    instance.data,
    providerId
  ] as const;

  return (
    <SimpleSidebarLayout
      groups={[
        {
          items: [
            {
              title: 'Tools',
              to: Paths.instance.provider(...providerPathParams, 'capabilities')
            },
            {
              title: 'Triggers',
              to: Paths.instance.provider(...providerPathParams, 'capabilities', 'triggers')
            },
            {
              title: 'Auth Methods',
              to: Paths.instance.provider(
                ...providerPathParams,
                'capabilities',
                'auth-methods'
              )
            }
          ]
        }
      ]}
      extraTop={
        allVersions.length > 0 ? (
          <Select
            label="Version"
            hideLabel
            items={allVersions.map(version => ({
              id: version.id,
              label: version.id === currentVersionId ? 'Current Version' : version.version
            }))}
            value={selectedVersionId}
            onChange={setSelectedVersionId}
          />
        ) : undefined
      }
    >
      <Outlet />
    </SimpleSidebarLayout>
  );
};
