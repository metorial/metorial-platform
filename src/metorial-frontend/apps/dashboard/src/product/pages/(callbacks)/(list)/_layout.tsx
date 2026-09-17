import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { showEventDestinationSetupModal } from '../../../scenes/callbacks/eventDestinationSetup';

export let CallbacksListLayout = () => {
  return (
    <ContentLayout>
      <PageHeader
        title="Callbacks"
        description="Callbacks let your providers push events into Metorial. Each callback records the events it receives."
      />

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};

export let WebhooksListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();
  let pathname = useLocation().pathname;
  let params = [organization.data, project.data, instance.data] as const;

  return (
    <ContentLayout>
      <PageHeader
        title="Webhooks & Events"
        description="Events that occurred in Metorial through Callbacks, Chat, or other sources."
        actions={
          <Button
            size="2"
            onClick={() =>
              organization.data &&
              instance.data &&
              showEventDestinationSetupModal({
                organizationId: organization.data.id,
                instanceId: instance.data.id,
                onComplete: destinationId =>
                  navigate(Paths.instance.eventDestination(...params, destinationId))
              })
            }
          >
            Create Webhook
          </Button>
        }
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Webhooks',
            to: Paths.instance.eventDestinations(...params)
          },
          {
            label: 'Events',
            to: Paths.instance.events(...params)
          }
        ]}
      />

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};
