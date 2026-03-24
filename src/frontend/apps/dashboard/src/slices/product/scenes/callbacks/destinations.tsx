import type { DashboardInstanceCallbacksNotificationsListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCallbackDestination,
  useCallbackDestinations,
  useCallbackNotifications,
  useCurrentInstance
} from '@metorial/state';
import {
  Attributes,
  Button,
  Callout,
  Dialog,
  Flex,
  Input,
  Menu,
  Panel,
  RenderDate,
  Spacer,
  Text,
  Title
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { RiAddLine, RiMore2Line } from '@remixicon/react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RouterPanel } from '../routerPanel';
import { showCallbackDestinationFormModal } from './destinationModal';
import { CallbackNotificationsTable, getNotificationStatusBadge } from './logs';

type CallbackNotificationListItem =
  DashboardInstanceCallbacksNotificationsListOutput['items'][number];

export let CallbackDestinationsList = (p: { callbackId: string | undefined }) => {
  let instance = useCurrentInstance();
  let destinations = useCallbackDestinations(instance.data?.id, { order: 'desc' });
  let notifications = useCallbackNotifications(instance.data?.id, p.callbackId, {
    order: 'desc'
  });
  let deleteMutator = destinations.useDeleteMutator();
  let [_, setSearchParams] = useSearchParams();

  let destinationRows = useMemo(() => {
    let latestByDestination = new Map<string, CallbackNotificationListItem>();

    for (let notification of notifications.data?.items ?? []) {
      if (!latestByDestination.has(notification.destination.id)) {
        latestByDestination.set(notification.destination.id, notification);
      }
    }

    let observedIds = new Set(latestByDestination.keys());
    let fallbackToAll = observedIds.size === 0;
    let destinationItems = fallbackToAll
      ? (destinations.data?.items ?? []).map(destination => ({
          destination,
          latestNotification: latestByDestination.get(destination.id)
        }))
      : Array.from(observedIds).map(id => {
          let destination =
            destinations.data?.items.find(item => item.id === id) ?? {
              object: 'callback.destination' as const,
              id,
              status: 'active' as const,
              name: latestByDestination.get(id)?.destination.name ?? id,
              description: latestByDestination.get(id)?.destination.description ?? null,
              metadata: null,
              url: latestByDestination.get(id)?.destination.webhook?.url ?? 'N/A',
              method: latestByDestination.get(id)?.destination.webhook?.method ?? 'POST',
              createdAt:
                latestByDestination.get(id)?.destination.createdAt ??
                latestByDestination.get(id)!.createdAt,
              updatedAt:
                latestByDestination.get(id)?.destination.updatedAt ??
                latestByDestination.get(id)!.updatedAt
            };

          return {
            destination,
            latestNotification: latestByDestination.get(id)
          };
        });

    return {
      fallbackToAll,
      items: destinationItems
    };
  }, [destinations.data?.items, notifications.data?.items]);

  return (
    <>
      <Flex gap="30px" justify="space-between" align="center">
        <div>
          <Title as="h2" size="5" weight="strong">
            Destinations
          </Title>
          <Text size="2" weight="medium" color="gray600">
            Destinations are the endpoints where Metorial delivers callback notifications.
          </Text>
        </div>

        <Button
          iconRight={<RiAddLine />}
          size="2"
          onClick={() =>
            instance.data &&
            showCallbackDestinationFormModal({
              instanceId: instance.data.id
            })
          }
        >
          Create Destination
        </Button>
      </Flex>

      <Spacer height={20} />

      {destinationRows.fallbackToAll && destinationRows.items.length > 0 && (
        <>
          <Callout color="gray">
            No deliveries have been observed for this callback yet, so this view is showing all
            destinations available in the instance.
          </Callout>
          <Spacer height={15} />
        </>
      )}

      <Table
        headers={['Info', 'URL', 'Last Delivery', 'Updated', '']}
        data={destinationRows.items.map(({ destination, latestNotification }) => ({
          data: [
            <Flex gap={3} direction="column">
              <Text size="2" weight="strong">
                {destination.name}
              </Text>
              <Text size="1" color="gray600" truncate>
                {destination.description || 'No description'}
              </Text>
            </Flex>,
            destination.url,
            latestNotification ? (
              getNotificationStatusBadge(latestNotification.status)
            ) : (
              <Text size="2" color="gray600">
                No deliveries yet
              </Text>
            ),
            <RenderDate date={destination.updatedAt} />,
            <div
              onClick={event => {
                event.stopPropagation();
                event.preventDefault();
              }}
            >
              <Menu
                items={[{ id: 'delete', label: 'Delete' }]}
                onItemClick={id => {
                  if (id == 'delete') {
                    deleteMutator.mutate({ callbackDestinationId: destination.id });
                  }
                }}
              >
                <Button variant="outline" size="1" iconLeft={<RiMore2Line />} />
              </Menu>
            </div>
          ],
          onClick: () =>
            setSearchParams(params => {
              params.set('destination_id', destination.id);
              return params;
            })
        }))}
      />

      {destinationRows.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No destinations found for this callback.
        </Text>
      )}

      <RouterPanel param="destination_id" width={1000}>
        {destinationId => (
          <>
            <Panel.Header>
              <Panel.Title>Destination Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <Destination destinationId={destinationId!} callbackId={p.callbackId!} />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  );
};

let Destination = ({
  destinationId,
  callbackId
}: {
  destinationId: string;
  callbackId: string;
}) => {
  let instance = useCurrentInstance();
  let destination = useCallbackDestination(instance.data?.id, destinationId);

  return renderWithLoader({ destination })(({ destination }) => (
    <>
      <Attributes
        itemWidth="260px"
        attributes={[
          {
            label: 'ID',
            content: <ID id={destination.data.id} />
          },
          {
            label: 'Status',
            content: destination.data.status
          },
          {
            label: 'URL',
            content: destination.data.url
          },
          {
            label: 'Method',
            content: destination.data.method
          },
          {
            label: 'Created At',
            content: <RenderDate date={destination.data.createdAt} />
          }
        ]}
      />

      <Spacer height={15} />

      <Box
        title="Recent Logs"
        description="Recent callback notifications sent to this destination for the current callback."
      >
        <CallbackNotificationsTable
          callbackId={callbackId}
          destinationId={destination.data.id}
        />
      </Box>
    </>
  ));
};
