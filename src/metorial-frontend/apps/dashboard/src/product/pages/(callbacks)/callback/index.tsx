import { renderWithLoader } from '@metorial/data-hooks';
import { col, createDataList } from '@metorial/data-list';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  EventPreview,
  useCallbackById,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags,
  useEvents
} from '@metorial/state';
import { Button, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { useInstanceContext } from '../../../lib/dataList';
import { EventDeliveryBox } from '../../../scenes/callbacks/listenersBox';
import {
  CallbackPendingCallout,
  CallbackSyncErrorCallout
} from '../../../scenes/callbacks/shared';
import { CallbackWebhookRegistrationsBox } from '../../../scenes/callbacks/webhookRegistrationsBox';

let RecentEventsList = createDataList<{ events: EventPreview[] }>('callback-recent-events', {
  customizable: false
})
  .context(useInstanceContext)
  .items(({ props }) => ({ items: props.events }))
  .columns([
    col.text({
      id: 'eventType',
      header: 'Event',
      weight: 'strong',
      get: row => row.eventType
    }),
    col.createdAt({ header: 'Recorded' }),
    col.id()
  ])
  .link((row, _props, ctx) =>
    Paths.instance.event(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

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

        {!callback.data.authCredentialsIsManaged ? (
          <CallbackWebhookRegistrationsBox
            instanceId={instance.data.id}
            providerId={callback.data.provider.id}
          />
        ) : null}

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
            <RecentEventsList listVariant="embedded" events={events.data.items} />
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
