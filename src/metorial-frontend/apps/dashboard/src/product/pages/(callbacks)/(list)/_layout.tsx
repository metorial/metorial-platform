import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';

export let CallbacksListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let flags = useDashboardFlags();

  let pathname = useLocation().pathname;
  let params = [organization.data, project.data, instance.data] as const;
  let webhooksEnabled = !!flags.data?.flags['webhooks-enabled'];

  return (
    <ContentLayout>
      <PageHeader
        title="Callbacks"
        description="Callbacks let your providers push events into Metorial. Each callback records the events it receives, and event destinations forward them to your own endpoints."
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Callbacks',
            to: Paths.instance.callbacks(...params)
          },
          ...(webhooksEnabled
            ? [
                {
                  label: 'Destinations',
                  to: Paths.instance.eventDestinations(...params)
                },
                {
                  label: 'Events',
                  to: Paths.instance.events(...params)
                }
              ]
            : [])
        ]}
      />

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};

export let CallbackLogsListLayout = () => {
  return (
    <ContentLayout>
      <PageHeader
        title="Callback Events"
        description="Inspect the provider events Metorial recorded from your callbacks."
      />

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};
