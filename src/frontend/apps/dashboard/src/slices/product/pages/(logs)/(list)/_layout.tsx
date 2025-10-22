import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
import { Explainer } from '../../../../../components/explainer';

export let LogsListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="Logs"
        description="Check the logs of your sessions and MCP servers."
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Sessions',
            to: Paths.instance.sessions(organization.data, project.data, instance.data)
          },
          {
            label: 'Server Runs',
            to: Paths.instance.serverRuns(organization.data, project.data, instance.data)
          },
          {
            label: 'Errors',
            to: Paths.instance.serverErrors(organization.data, project.data, instance.data)
          }
        ]}
      />

      <Outlet />

      <Explainer
        title="Using the MCP Logs"
        description="Learn how to use the logs to understand what's happening in your MCP server."
        youtubeId="utz9yBfQ88k"
        id="logs"
      />
    </ContentLayout>
  );
};
