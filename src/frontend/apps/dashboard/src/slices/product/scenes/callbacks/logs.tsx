import { CodeBlock } from '@metorial/code';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCallbackNotification,
  useCallbackNotifications,
  useCurrentInstance
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Callout,
  Datalist,
  Panel,
  RenderDate,
  Spacer,
  Text,
  Title
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RouterPanel } from '../routerPanel';

let formatJson = (value: unknown) => {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
};

export let getNotificationStatusBadge = (status?: string) => {
  let color: 'blue' | 'gray' | 'red' | 'orange' =
    status === 'delivered'
      ? 'blue'
      : status === 'failed'
        ? 'red'
        : status === 'retrying'
          ? 'orange'
          : 'gray';

  return <Badge color={color}>{status ?? 'unknown'}</Badge>;
};

export let CallbackLogsList = (p: { callbackId: string | undefined }) => {
  return (
    <>
      <Title as="h2" size="5" weight="strong">
        Logs
      </Title>
      <Text size="2" weight="medium" color="gray600">
        These logs show delivery attempts Metorial has made for this callback and the destination
        each notification targeted.
      </Text>
      <Spacer height={20} />

      <CallbackNotificationsTable callbackId={p.callbackId} details />

      <RouterPanel param="notification_id" width={1000}>
        {notificationId => (
          <>
            <Panel.Header>
              <Panel.Title>Notification Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <Notification notificationId={notificationId!} callbackId={p.callbackId!} />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  );
};

export let CallbackNotificationsTable = ({
  callbackId,
  destinationId,
  details
}: {
  callbackId: string | undefined;
  destinationId?: string;
  details?: boolean;
}) => {
  let instance = useCurrentInstance();
  let notifications = useCallbackNotifications(instance.data?.id, callbackId, {
    order: 'desc',
    ...(destinationId ? { destinationId } : {})
  });
  let [_, setSearchParams] = useSearchParams();

  return renderWithPagination(notifications)(notifications => (
    <>
      <Table
        headers={['Status', 'Event', 'Destination', 'Created']}
        data={notifications.data.items.map(notification => ({
          data: [
            getNotificationStatusBadge(notification.status),
            <Text size="2" weight="strong">
              {notification.event.type}
            </Text>,
            <Text size="2">
              {notification.destination.name || notification.destination.webhook?.url || 'N/A'}
            </Text>,
            <RenderDate date={notification.createdAt} />
          ],
          onClick: () =>
            details &&
            setSearchParams(params => {
              params.set('notification_id', notification.id);
              return params;
            })
        }))}
      />

      {notifications.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No notifications found for this callback.
        </Text>
      )}
    </>
  ));
};

let Notification = ({
  notificationId,
  callbackId
}: {
  notificationId: string;
  callbackId: string;
}) => {
  let instance = useCurrentInstance();
  let notification = useCallbackNotification(instance.data?.id, callbackId, notificationId);

  let eventRequest = useMemo(
    () => formatJson(notification.data?.event.request),
    [notification.data?.event.request]
  );
  let error = useMemo(() => formatJson(notification.data?.error), [notification.data?.error]);

  return renderWithLoader({ notification })(({ notification }) => (
    <>
      <Attributes
        itemWidth="300px"
        attributes={[
          {
            label: 'Status',
            content: getNotificationStatusBadge(notification.data.status)
          },
          {
            label: 'Attempt Count',
            content: notification.data.attemptCount
          },
          {
            label: 'Notification ID',
            content: <ID id={notification.data.id} />
          },
          {
            label: 'Event',
            content: notification.data.event.type
          },
          {
            label: 'Destination',
            content: notification.data.destination.name
          },
          {
            label: 'Last Attempt At',
            content: notification.data.lastAttemptAt ? (
              <RenderDate date={notification.data.lastAttemptAt} />
            ) : (
              'N/A'
            )
          },
          {
            label: 'Next Attempt At',
            content: notification.data.nextAttemptAt ? (
              <RenderDate date={notification.data.nextAttemptAt} />
            ) : (
              'N/A'
            )
          }
        ]}
      />

      <Spacer height={15} />

      <Box
        title="Destination"
        description="The destination selected for this notification delivery."
      >
        <Datalist
          items={[
            { label: 'Name', value: notification.data.destination.name },
            {
              label: 'URL',
              value: notification.data.destination.webhook?.url ?? 'N/A'
            },
            {
              label: 'Method',
              value: notification.data.destination.webhook?.method ?? 'N/A'
            },
            {
              label: 'Destination ID',
              value: <ID id={notification.data.destination.id} />
            }
          ]}
        />
      </Box>

      <Spacer height={15} />

      <Box
        title="Event Request"
        description="The event payload stored with the notification delivery."
      >
        <CodeBlock language="json" code={eventRequest} />
      </Box>

      {notification.data.error && (
        <>
          <Spacer height={15} />

          <Box title="Delivery Error" description="The most recent delivery error for this notification.">
            <CodeBlock language="json" code={error} />
          </Box>
        </>
      )}

      {notification.data.status === 'retrying' && (
        <>
          <Spacer height={15} />
          <Callout color="orange">
            This notification is scheduled to retry until delivery succeeds or the retry policy is
            exhausted.
          </Callout>
        </>
      )}
    </>
  ));
};
