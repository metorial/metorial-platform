import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCallbackById,
  useCallbackEvents,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags
} from '@metorial/state';
import { Badge, Button, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { CallbackDeliveryBox } from '../../../scenes/callbacks/listenersBox';
import {
  CallbackPendingCallout,
  CallbackSyncErrorCallout,
  getCallbackEventStatusColor
} from '../../../scenes/callbacks/shared';
import { CallbackWebhookRegistrationsBox } from '../../../scenes/callbacks/webhookRegistrationsBox';

export let CallbackOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let flags = useDashboardFlags();
  let { callbackId } = useParams();
  let callback = useCallbackById(instance.data?.id, callbackId);
  let callbackEvents = useCallbackEvents(instance.data?.id, {
    callbackId,
    limit: 10,
    order: 'desc'
  });

  return renderWithLoader({ callback, callbackEvents, instance, organization, project })(
    ({ callback, callbackEvents, instance, organization, project }) => (
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
            <CallbackDeliveryBox
              organizationId={organization.data.id}
              instanceId={instance.data.id}
              callbackIds={[callback.data.id]}
              defaultCallbackId={callback.data.id}
              description="Event destinations subscribed to this callback's triggers."
            />
            <Spacer height={20} />
          </>
        ) : null}

        <Box
          title="Recent Events"
          description="The latest provider events recorded for this callback."
          rightActions={
            callbackEvents.data.items.length ? (
              <Link
                to={Paths.instance.callback(
                  organization.data,
                  project.data,
                  instance.data,
                  callback.data.id,
                  'events'
                )}
              >
                <Button size="2" as="span" variant="outline">
                  View All Events
                </Button>
              </Link>
            ) : undefined
          }
        >
          {callbackEvents.data.items.length ? (
            <Table
              headers={['Trigger', 'Status', 'Occurred', 'ID']}
              data={callbackEvents.data.items.map(event => ({
                href: Paths.instance.callbackEvent(
                  organization.data,
                  project.data,
                  instance.data,
                  event.id
                ),
                data: [
                  <Text key="trigger" size="2" weight="strong">
                    {event.providerTriggerKey}
                  </Text>,
                  <Badge key="status" color={getCallbackEventStatusColor(event.status)}>
                    {event.status}
                  </Badge>,
                  <RenderDate key="occurred" date={event.occurredAt} />,
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
