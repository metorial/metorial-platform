import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCallbackById,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags,
  useEvents
} from '@metorial/state';
import { Button, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { EventDeliveryBox } from '../../../scenes/callbacks/listenersBox';
import {
  CallbackPendingCallout,
  CallbackSyncErrorCallout
} from '../../../scenes/callbacks/shared';
import { CallbackWebhookRegistrationsBox } from '../../../scenes/callbacks/webhookRegistrationsBox';

export let CallbackOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let flags = useDashboardFlags();
  let { callbackId } = useParams();
  let callback = useCallbackById(instance.data?.id, callbackId);
  let events = useEvents(organization.data?.id, {
    instanceId: instance.data?.id,
    callbackId,
    limit: 10,
    order: 'desc'
  });

  return renderWithLoader({ callback, events, instance, organization, project })(
    ({ callback, events, instance, organization, project }) => (
      <DetailsOverviewLayout>
        <CallbackSyncErrorCallout sync={callback.data.sync} />
        <CallbackPendingCallout sync={callback.data.sync} />
        {callback.data.sync.status !== 'synced' ? <Spacer height={20} /> : null}

        <CallbackWebhookRegistrationsBox
          instanceId={instance.data.id}
          providerId={callback.data.provider.id}
        />

        {flags.data?.flags['webhooks-enabled'] ? (
          <>
            <EventDeliveryBox
              organizationId={organization.data.id}
              instanceId={instance.data.id}
              target={{ type: 'callback', callbackId: callback.data.id }}
              description="Event destinations subscribed to this callback's triggers."
            />
            <Spacer height={20} />
          </>
        ) : null}

        <Box
          title="Recent Events"
          rightActions={
            events.data.items.length ? (
              <Link
                to={`${Paths.instance.events(organization.data, project.data, instance.data, { callbackId: callback.data.id })}`}
              >
                <Button size="2" as="span" variant="outline">
                  View All Events
                </Button>
              </Link>
            ) : undefined
          }
        >
          {events.data.items.length ? (
            <Table
              headers={['Event', 'Recorded', 'ID']}
              data={events.data.items.map(event => ({
                href: Paths.instance.event(
                  organization.data,
                  project.data,
                  instance.data,
                  event.id
                ),
                data: [
                  <Text key="trigger" size="2" weight="strong">
                    {event.eventType}
                  </Text>,
                  <RenderDate key="recorded" date={event.createdAt} />,
                  <ID key="id" id={event.id} />
                ]
              }))}
            />
          ) : (
            <Text size="2" color="gray600">
              No events recorded for this callback yet.
            </Text>
          )}
        </Box>
      </DetailsOverviewLayout>
    )
  );
};
