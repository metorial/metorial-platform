import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
import { NetworkManagedPage } from '../_gate';

export let NetworkListLayout = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let location = useLocation();

  return (
    <ContentLayout>
      <PageHeader
        title="Network"
        description="Monitor network activity and manage firewalls for this instance."
      />

      <NetworkManagedPage>
        <LinkTabs
          current={location.pathname}
          links={[
            {
              label: 'Overview',
              to: Paths.instance.network(organization.data, project.data, instance.data)
            },
            {
              label: 'Firewalls',
              to: Paths.instance.networkFirewalls(
                organization.data,
                project.data,
                instance.data
              )
            },
            {
              label: 'Enclaves',
              to: Paths.instance.networkEnclaves(
                organization.data,
                project.data,
                instance.data
              )
            },
            {
              label: 'Settings',
              to: Paths.instance.networkSettings(
                organization.data,
                project.data,
                instance.data
              )
            }
          ]}
        />

        <PaginationSearchParamsProvider enabled={true}>
          <Outlet />
        </PaginationSearchParamsProvider>
      </NetworkManagedPage>
    </ContentLayout>
  );
};
