import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';

export let ProtoGuardLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="ProtoGuard"
        description="Configure prompt-injection filters and alert thresholds for this instance."
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Filters',
            to: Paths.instance.protoguard(organization.data, project.data, instance.data)
          },
          {
            label: 'Settings',
            to: Paths.instance.protoguard(
              organization.data,
              project.data,
              instance.data,
              'settings'
            )
          }
        ]}
      />

      <Outlet />
    </ContentLayout>
  );
};
