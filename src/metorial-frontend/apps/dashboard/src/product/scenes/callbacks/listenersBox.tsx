import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useAllEventDestinationListeners,
  useAllEventDestinations,
  useBoot,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Badge, Button, Callout, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { showCreateEventDestinationModal } from './eventDestinationsTable';
import { ListenerSummary, showEventDestinationListenerModal } from './listenerEditor';

export type EventDeliveryTarget =
  | { type: 'callback'; callbackId: string }
  | { type: 'chat'; chatConnectionId: string };

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
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
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

      let rowData = subscribedDestinations.data.map(destination => ({
        href: Paths.instance.eventDestination(
          organization.data,
          project.data,
          instance.data,
          destination.id
        ),
        data: [
          <Text size="2" weight="strong">
            {destination.name}
          </Text>,

          destination.webhook?.url ?? 'Endpoint unavailable'
        ]
      }));

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
          ) : !rowData.length ? (
            <>
              <Text size="2" color="gray600">
                There are no event destinations subscribed to this target yet. Add one to start
                receiving events.
              </Text>
            </>
          ) : (
            <Table headers={['Destination', 'URL']} data={rowData} />
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

  let boot = useBoot();
  let instanceMap = useMemo(
    () => new Map(boot.data?.instances.map(i => [i.id, i]) ?? []),
    [boot.data]
  );

  return renderWithLoader({ listeners })(({ listeners }) => {
    let rows = listeners.data.map(listener => ({
      data: [
        <Badge
          key="type"
          color={
            listener.type === 'callback'
              ? 'blue'
              : listener.type === 'chat'
                ? 'purple'
                : 'gray'
          }
        >
          {listener.type === 'callback'
            ? 'Callback'
            : listener.type === 'chat'
              ? 'Chat'
              : 'System'}
        </Badge>,
        <ListenerSummary key="subject" listener={listener} />,
        <Text size="2" key="instance">
          {instanceMap.get(listener.instanceId)
            ? `${instanceMap.get(listener.instanceId)?.project.name} - ${instanceMap.get(listener.instanceId)?.name}`
            : listener.instanceId}
        </Text>
      ]
    }));

    return (
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
        {rows.length ? (
          <Table headers={['Type', 'Subscribed To', 'Instance']} data={rows} />
        ) : (
          <Callout color="orange">
            <span>
              No subscriptions yet — this destination will not receive anything until you add
              one.
            </span>
          </Callout>
        )}
      </Box>
    );
  });
};
