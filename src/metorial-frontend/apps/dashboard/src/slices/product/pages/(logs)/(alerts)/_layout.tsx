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

export let AlertsListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="Alerts"
        description="Review monitor alerts, schema-change detections, and ProtoGuard findings."
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Alerts',
            to: Paths.instance.alerts(organization.data, project.data, instance.data)
          },
          {
            label: 'Monitors',
            to: Paths.instance.monitors(organization.data, project.data, instance.data)
          }
        ]}
      />

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};
