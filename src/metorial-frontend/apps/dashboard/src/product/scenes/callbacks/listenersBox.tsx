import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useAllEventDestinationListeners,
  useAllEventDestinations,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteEventDestinationListener
} from '@metorial/state';
import { Badge, Button, Callout, confirm, Flex, Spacer, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { Link } from 'react-router-dom';
import { showCreateEventDestinationModal } from './eventDestinationsTable';
import { showEventDestinationListenerModal } from './listenerEditor';

export let CallbackDeliveryBox = ({
  organizationId,
  instanceId,
  callbackIds,
  defaultCallbackId,
  title = 'Delivery',
  description = 'Where Metorial sends the events these callbacks produce.'
}: {
  organizationId: string;
  instanceId: string;
  callbackIds: string[];
  defaultCallbackId?: string;
  title?: string;
  description?: string;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let destinations = useAllEventDestinations(organizationId, { status: 'active' });
  let listeners = useAllEventDestinationListeners(callbackIds.length ? organizationId : null, {
    type: 'callback',
    callbackId: callbackIds
  });
  let deleteListener = useDeleteEventDestinationListener();

  return renderWithLoader({ destinations, listeners })(({ destinations, listeners }) => {
    let destinationsById = new Map(
      destinations.data.map(destination => [destination.id, destination] as const)
    );

    let rows = listeners.data.map(listener => {
      let destination = destinationsById.get(listener.eventDestinationId);

      return {
        data: [
          <Flex direction="column" gap={2} key="destination">
            <Text size="2" weight="strong">
              {destination?.name ?? listener.eventDestinationId}
            </Text>
            <Text size="1" color="gray600">
              {destination?.webhook?.url ?? 'Endpoint unavailable'}
            </Text>
          </Flex>,
          <Text size="2" key="triggers">
            {listener.triggers?.length ? listener.triggers.join(', ') : 'No triggers selected'}
          </Text>,
          <Flex gap={8} key="actions">
            <Button
              size="1"
              variant="outline"
              onClick={() =>
                showEventDestinationListenerModal({
                  organizationId,
                  instanceId,
                  eventDestinationId: listener.eventDestinationId,
                  listener,
                  onComplete: () => void listeners.refetch()
                })
              }
            >
              Edit
            </Button>
            <Button
              size="1"
              variant="outline"
              color="red"
              loading={deleteListener.isLoading}
              success={deleteListener.isSuccess}
              onClick={() =>
                confirm({
                  title: 'Remove Subscription?',
                  description: `${destination?.name ?? 'This destination'} will stop receiving these events.`,
                  confirmText: 'Remove',
                  onConfirm: async () => {
                    await deleteListener.mutate({
                      organizationId,
                      eventDestinationListenerId: listener.id
                    });
                    await listeners.refetch();
                  }
                })
              }
            >
              Remove
            </Button>
          </Flex>
        ]
      };
    });

    return (
      <Box
        title={title}
        description={description}
        rightActions={
          destinations.data.length ? (
            <Button
              size="2"
              disabled={!callbackIds.length}
              onClick={() =>
                showEventDestinationListenerModal({
                  organizationId,
                  instanceId,
                  defaultCallbackId,
                  onComplete: () => void listeners.refetch()
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
                  onCreate: () => void destinations.refetch()
                })
              }
            >
              Create Destination
            </Button>
          )
        }
      >
        {!destinations.data.length ? (
          <Callout color="orange">
            <span>
              You do not have an event destination yet. Create one to receive these events at
              your own endpoint.
            </span>
          </Callout>
        ) : !rows.length ? (
          <>
            <Callout color="orange">
              <span>
                Nothing subscribes to these callbacks yet, so their events are recorded but not
                delivered anywhere.
              </span>
            </Callout>
            <Spacer size={12} />
            <Text size="2" color="gray600">
              Manage all destinations on the{' '}
              <Link
                to={Paths.instance.eventDestinations(
                  organization.data,
                  project.data,
                  instance.data
                )}
              >
                Event Destinations
              </Link>{' '}
              page.
            </Text>
          </>
        ) : (
          <Table
            headers={['Destination', 'Triggers', '']}
            data={rows}
            padding={{ sides: '16px' }}
          />
        )}

        <deleteListener.RenderError />
      </Box>
    );
  });
};

export let EventDestinationListenersBox = ({
  organizationId,
  instanceId,
  eventDestinationId,
  onComplete
}: {
  organizationId: string;
  instanceId: string;
  eventDestinationId: string;
  onComplete?: () => void;
}) => {
  let listeners = useAllEventDestinationListeners(organizationId, { eventDestinationId });
  let deleteListener = useDeleteEventDestinationListener();

  return renderWithLoader({ listeners })(({ listeners }) => {
    let refresh = () => {
      void listeners.refetch();
      onComplete?.();
    };

    let rows = listeners.data.map(listener => ({
      data: [
        <Badge key="type" color={listener.type === 'callback' ? 'blue' : 'gray'}>
          {listener.type === 'callback' ? 'Callback' : 'Resource'}
        </Badge>,
        <Text size="2" key="subject">
          {listener.type === 'callback'
            ? listener.triggers?.join(', ') || 'No triggers selected'
            : listener.eventTypes?.join(', ') || 'No event types selected'}
        </Text>,
        <Text size="2" key="instance">
          {listener.instanceId}
        </Text>,
        <Flex gap={8} key="actions">
          <Button
            size="1"
            variant="outline"
            onClick={() =>
              showEventDestinationListenerModal({
                organizationId,
                instanceId: listener.instanceId,
                eventDestinationId,
                listener,
                onComplete: refresh
              })
            }
          >
            Edit
          </Button>
          <Button
            size="1"
            variant="outline"
            color="red"
            loading={deleteListener.isLoading}
            success={deleteListener.isSuccess}
            onClick={() =>
              confirm({
                title: 'Remove Subscription?',
                description:
                  'This destination will stop receiving the events this subscription covers.',
                confirmText: 'Remove',
                onConfirm: async () => {
                  await deleteListener.mutate({
                    organizationId,
                    eventDestinationListenerId: listener.id
                  });
                  refresh();
                }
              })
            }
          >
            Remove
          </Button>
        </Flex>
      ]
    }));

    return (
      <Box
        title="Subscriptions"
        description="Which events this destination receives. Without a subscription nothing is delivered."
        rightActions={
          <Button
            size="2"
            onClick={() =>
              showEventDestinationListenerModal({
                organizationId,
                instanceId,
                eventDestinationId,
                onComplete: refresh
              })
            }
          >
            Add Subscription
          </Button>
        }
      >
        {rows.length ? (
          <Table
            headers={['Type', 'Subscribed To', 'Instance', '']}
            data={rows}
            padding={{ sides: '16px' }}
          />
        ) : (
          <Callout color="orange">
            <span>
              No subscriptions yet — this destination will not receive anything until you add
              one.
            </span>
          </Callout>
        )}

        <deleteListener.RenderError />
      </Box>
    );
  });
};
