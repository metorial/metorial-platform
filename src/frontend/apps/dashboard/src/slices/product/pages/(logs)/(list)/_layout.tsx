import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';

export let LogsListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="Logs"
        description="Check the logs of your sessions and MCP providers."
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Sessions',
            to: Paths.instance.providerSessions(organization.data, project.data, instance.data)
          },
          {
            label: 'Provider Runs',
            to: Paths.instance.providerRuns(organization.data, project.data, instance.data)
          },
          {
            label: 'Errors',
            to: Paths.instance.providerErrors(organization.data, project.data, instance.data)
          }
        ]}
      />

      <Outlet />
    </ContentLayout>
  );
};
