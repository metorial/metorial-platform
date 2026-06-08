import type { DashboardInstanceCallbacksNotificationsListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCallback,
  useCallbackDestination,
  useCallbackDestinations,
  useCallbackNotifications,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import {
  Attributes,
  Button,
  Copy,
  Flex,
  Menu,
  Panel,
  RenderDate,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { RiAddLine, RiMore2Line } from '@remixicon/react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RouterPanel } from '../routerPanel';
import { showCallbackDestinationFormModal } from './destinationModal';
import { CallbackNotificationsTable, getNotificationStatusBadge } from './logs';

type CallbackNotificationListItem =
  DashboardInstanceCallbacksNotificationsListOutput['items'][number];

export let CallbackDestinationsList = (p: { callbackId: string | undefined }) => {
  let instance = useCurrentInstance();
  let callback = useCallback(instance.data?.id, p.callbackId);
  let destinations = useCallbackDestinations(
    instance.data?.id && p.callbackId ? instance.data.id : null,
    {
      callbackId: p.callbackId,
      order: 'desc'
    }
  );
  let notifications = useCallbackNotifications(instance.data?.id, p.callbackId, {
    order: 'desc'
  });
  let deleteMutator = destinations.useDeleteMutator();
  let updateCallback = callback.useUpdateMutator();
  let [_, setSearchParams] = useSearchParams();
  let [selectedDestinationIds, setSelectedDestinationIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedDestinationIds(
      callback.data?.destinations.map(destination => destination.id) ?? []
    );
  }, [callback.data?.id, callback.data?.updatedAt, callback.data?.destinations]);

  let destinationRows = useMemo(() => {
    let latestByDestination = new Map<string, CallbackNotificationListItem>();

    for (let notification of notifications.data?.items ?? []) {
      if (!latestByDestination.has(notification.destination.id)) {
        latestByDestination.set(notification.destination.id, notification);
      }
    }

    let destinationItems = (destinations.data?.items ?? []).map(destination => ({
      destination,
      latestNotification: latestByDestination.get(destination.id)
    }));

    return {
      items: destinationItems
    };
  }, [destinations.data?.items, notifications.data?.items]);

  let destinationSelectItems = (destinations.data?.items ?? []).map(destination => ({
    id: destination.id,
    label: destination.name
  }));
  let currentDestinationIds =
    callback.data?.destinations.map(destination => destination.id) ?? [];
  let hasPendingDestinationChanges =
    selectedDestinationIds.slice().sort().join('|') !==
    currentDestinationIds.slice().sort().join('|');

  return (
    <>
      {/* {renderWithLoader({ callback, destinations })(() => (
        <>
          <MultiSelect
            label="Attached Destinations"
            description="Only the selected destinations will receive notifications for this callback."
            placeholder="Select destinations"
            value={selectedDestinationIds}
            onChange={setSelectedDestinationIds}
            items={destinationSelectItems}
          />

          <Spacer height={10} />

          <Flex gap={10} justify="end">
            <Button
              variant="outline"
              onClick={() => setSelectedDestinationIds(currentDestinationIds)}
              disabled={!hasPendingDestinationChanges}
            >
              Reset
            </Button>
            <Button
              loading={updateCallback.isLoading}
              disabled={!hasPendingDestinationChanges}
              onClick={() =>
                updateCallback.mutate({
                  destinationIds: selectedDestinationIds
                })
              }
            >
              Save Destinations
            </Button>
          </Flex>

          <updateCallback.RenderError />

          <Spacer height={15} />
        </>
      ))} */}

      <Table
        headers={['Info', 'URL', 'Last Delivery', 'Updated', '']}
        data={destinationRows.items.map(({ destination, latestNotification }) => ({
          data: [
            <Flex gap={3} direction="column">
              <Text size="2" weight="strong">
                {destination.name}
              </Text>
              {destination.description && (
                <Text size="1" color="gray600" truncate>
                  {destination.description}
                </Text>
              )}
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
          No destinations are attached to this callback yet.
        </Text>
      )}

      <Spacer height={15} />

      <Button
        iconRight={<RiAddLine />}
        size="2"
        onClick={() =>
          instance.data &&
          showCallbackDestinationFormModal({
            instanceId: instance.data.id,
            onCreate: destination => {
              let nextDestinationIds = [
                ...new Set([...selectedDestinationIds, destination.id])
              ];
              setSelectedDestinationIds(nextDestinationIds);
              updateCallback.mutate({
                destinationIds: nextDestinationIds
              });

              destinations.refetch();
            }
          })
        }
      >
        Create Destination
      </Button>

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
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
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
            content: <Copy value={destination.data.url} />
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
          onNotificationClick={notificationId => {
            let path = Paths.instance.callback(
              organization.data,
              project.data,
              instance.data,
              callbackId,
              'logs'
            );
            let searchParams = new URLSearchParams({ notification_id: notificationId });
            navigate(`${path}?${searchParams.toString()}`);
          }}
        />
      </Box>
    </>
  ));
};
