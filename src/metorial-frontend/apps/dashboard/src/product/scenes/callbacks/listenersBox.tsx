import { renderWithLoader } from '@metorial/data-hooks';
import { col, createDataList } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import {
  EventDestinationListenerPreview,
  EventDestinationPreview,
  useAllEventDestinationListeners,
  useAllEventDestinations,
  useBoot,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Badge, Button, Callout, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInstanceContext } from '../../lib/dataList';
import { showCreateEventDestinationModal } from './eventDestinationsTable';
import { ListenerSummary, showEventDestinationListenerModal } from './listenerEditor';

export type EventDeliveryTarget =
  { type: 'callback'; callbackId: string } | { type: 'chat'; chatConnectionId: string };

let SubscribedDestinationsList = createDataList<{ destinations: EventDestinationPreview[] }>(
  'event-delivery-destinations',
  { customizable: false }
)
  .context(useInstanceContext)
  .items(({ props }) => ({ items: props.destinations }))
  .columns([
    col.name({ header: 'Destination', description: false }),
    col.text({
      id: 'url',
      header: 'URL',
      get: row => row.webhook?.url,
      fallback: 'Endpoint unavailable'
    })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.eventDestination(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

let useListenersContext = () => {
  let ctx = useInstanceContext();
  let boot = useBoot();
  let instanceMap = useMemo(
    () => new Map(boot.data?.instances.map(i => [i.id, i]) ?? []),
    [boot.data]
  );

  return { ...ctx, instanceMap };
};

let listenerTypes = {
  callback: { label: 'Callback', color: 'blue' },
  chat: { label: 'Chat', color: 'purple' },
  system: { label: 'System', color: 'gray' }
} as const;

let ListenersList = createDataList<{ listeners: EventDestinationListenerPreview[] }>(
  'event-destination-listeners',
  { customizable: false }
)
  .context(useListenersContext)
  .items(({ props }) => ({ items: props.listeners }))
  .columns([
    col.custom({
      id: 'type',
      header: 'Type',
      render: row => {
        let type =
          listenerTypes[row.type as keyof typeof listenerTypes] ?? listenerTypes.system;
        return <Badge color={type.color}>{type.label}</Badge>;
      }
    }),
    col.custom({
      id: 'subject',
      header: 'Subscribed To',
      render: row => <ListenerSummary listener={row} />
    }),
    col.custom({
      id: 'instance',
      header: 'Instance',
      render: (row, _props, ctx) => {
        let instance = ctx.instanceMap.get(row.instanceId);

        return (
          <Text size="2">
            {instance ? `${instance.project.name} - ${instance.name}` : row.instanceId}
          </Text>
        );
      }
    })
  ])
  .build();

export let EventDeliveryBox = ({
  organizationId,
  instanceId,
  target,
  title = 'Delivery',
  description = 'Where Metorial sends these events.'
}: {
  organizationId: string;
  instanceId: string;
  target: EventDeliveryTarget;
  title?: string;
  description?: string;
}) => {
  let allDestinations = useAllEventDestinations(organizationId, { status: 'active' });
  let subscribedDestinations = useAllEventDestinations(organizationId, {
    status: 'active',
    ...(target.type === 'callback'
      ? { callbackId: target.callbackId }
      : { chatConnectionId: target.chatConnectionId })
  });
  return renderWithLoader({ allDestinations, subscribedDestinations })(
    ({ allDestinations, subscribedDestinations }) => {
      let refetch = () =>
        Promise.all([allDestinations.refetch(), subscribedDestinations.refetch()]);

      return (
        <Box
          title={title}
          description={description}
          rightActions={
            allDestinations.data.length ? (
              <Button
                size="2"
                onClick={() =>
                  showEventDestinationListenerModal({
                    organizationId,
                    instanceId,
                    fixedTarget:
                      target.type === 'callback'
                        ? { type: 'callback', targetId: target.callbackId }
                        : { type: 'chat', targetId: target.chatConnectionId },
                    excludeEventDestinationIds: subscribedDestinations.data.map(d => d.id),
                    onComplete: refetch
                  })
                }
              >
                Add Subscription
              </Button>
            ) : (
              <Button
                size="2"
                onClick={() =>
                  showCreateEventDestinationModal({
                    organizationId,
                    onCreate: () => void allDestinations.refetch()
                  })
                }
              >
                Create Destination
              </Button>
            )
          }
        >
          {!allDestinations.data.length ? (
            <Callout color="orange">
              <span>
                You do not have an event destination yet. Create one to receive these events at
                your own endpoint.
              </span>
            </Callout>
          ) : !subscribedDestinations.data.length ? (
            <Text size="2" color="gray600">
              There are no event destinations subscribed to this target yet. Add one to start
              receiving events.
            </Text>
          ) : (
            <SubscribedDestinationsList
              listVariant="embedded"
              destinations={subscribedDestinations.data}
            />
          )}
        </Box>
      );
    }
  );
};

export let EventDestinationListenersBox = ({
  organizationId,
  eventDestinationId
}: {
  organizationId: string;
  instanceId: string;
  eventDestinationId: string;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let listeners = useAllEventDestinationListeners(organizationId, { eventDestinationId });

  return renderWithLoader({ listeners })(({ listeners }) => (
    <Box
      title="Listeners"
      description="Configure which events this destination receives."
      rightActions={
        <Link
          to={Paths.instance.eventDestinationListeners(
            organization.data,
            project.data,
            instance.data,
            eventDestinationId
          )}
        >
          <Button size="2" as="span" variant="outline">
            Edit Listeners
          </Button>
        </Link>
      }
    >
      {listeners.data.length ? (
        <ListenersList listVariant="embedded" listeners={listeners.data} />
      ) : (
        <Callout color="orange">
          <span>
            No subscriptions yet — this destination will not receive anything until you add
            one.
          </span>
        </Callout>
      )}
    </Box>
  ));
};
