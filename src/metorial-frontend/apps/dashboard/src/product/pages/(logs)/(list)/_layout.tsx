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

export let SessionLogsListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="Connection Logs"
        description="Inspect sessions, connections, tool calls, and errors captured during MCP traffic."
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Sessions',
            to: Paths.instance.providerSessions(organization.data, project.data, instance.data)
          },
          {
            label: 'Connections',
            to: Paths.instance.sessionConnections(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: 'Tool Calls',
            to: Paths.instance.toolCalls(organization.data, project.data, instance.data)
          },
          {
            label: 'Errors',
            to: Paths.instance.providerErrors(organization.data, project.data, instance.data)
          }
        ]}
      />

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};

export let AuthLogsListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="Auth Logs"
        description="Investigate authentication lifecycle events and auth failures across your providers."
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Auth Events',
            to: Paths.instance.providerAuthEvents(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: 'Auth Errors',
            to: Paths.instance.providerAuthErrors(
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
    </ContentLayout>
  );
};

/**
 * @deprecated Use {@link SessionLogsListLayout} for session logs or
 * {@link AuthLogsListLayout} for auth logs instead.
 */
export let LogsListLayout = SessionLogsListLayout;
