import { PaginationSearchParamsProvider, renderWithLoader } from '@metorial/data-hooks';
import { ComingSoon, Upgrade } from '@metorial/empty-state';
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

export let WEBHOOK_TAB_LABELS = ['Events', 'Logs'] as const;

export let WebhooksLayout = () => {
  let flags = useDashboardFlags();
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let pathname = useLocation().pathname;
  let params = [organization.data, project.data, instance.data] as const;

  return (
    <ContentLayout>
      <PageHeader
        title="Webhooks"
        description="Inspect inbound callback events and outgoing webhook deliveries across this instance."
      />

      {renderWithLoader({ flags })(({ flags }) =>
        !flags.data.flags['callbacks-enabled'] ? (
          <ComingSoon
            title="Metorial Webhooks"
            description="Webhooks let your deployed providers notify your application about interesting events."
          />
        ) : !flags.data.flags['paid-callbacks'] ? (
          <Upgrade
            title="Metorial Webhooks"
            description="Upgrade to inspect callback events and webhook delivery logs."
          />
        ) : (
          <>
            <LinkTabs
              current={pathname}
              links={[
                {
                  label: WEBHOOK_TAB_LABELS[0],
                  to: Paths.instance.webhooks(...params, 'events')
                },
                {
                  label: WEBHOOK_TAB_LABELS[1],
                  to: Paths.instance.webhooks(...params, 'logs')
                }
              ]}
            />
            <PaginationSearchParamsProvider enabled={true}>
              <Outlet />
            </PaginationSearchParamsProvider>
          </>
        )
      )}
    </ContentLayout>
  );
};
