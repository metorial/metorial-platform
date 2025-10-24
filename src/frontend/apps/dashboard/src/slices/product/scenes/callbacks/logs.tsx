import { CodeBlock } from '@metorial/code';
import { DashboardInstanceCallbacksNotificationsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCallback,
  useCallbackNotification,
  useCallbackNotifications,
  useCurrentInstance
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Datalist,
  InputLabel,
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

export let CallbackLogsList = (p: { callbackId: string | undefined }) => {
  let instance = useCurrentInstance();
  let callback = useCallback(instance.data?.id, p.callbackId);

  return (
    <>
      <Title as="h2" size="5" weight="strong">
        Logs
      </Title>
      <Text size="2" weight="medium" color="gray600">
        When Metorial receives a callback, it will be forwarded to the destinations you have
        configured. These logs show the responses Metorial has received from your app.
      </Text>
      <Spacer height={20} />

      <Notifications callbackIds={callback.data?.id} details />

      <RouterPanel param="notification_id" width={1000}>
        {notificationId => (
          <>
            <Panel.Header>
              <Panel.Title>Notification Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <Notification notificationId={notificationId!} callbackId={callback.data?.id!} />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  );
};

export let Notifications = (
  props: DashboardInstanceCallbacksNotificationsListQuery & { details?: boolean }
) => {
  let instance = useCurrentInstance();
  let notifications = useCallbackNotifications(instance.data?.id, {
    order: 'desc',
    ...props
  });
  let [_, setSearchParams] = useSearchParams();

  return renderWithPagination(notifications)(notifications => (
    <>
      <Table
        headers={['Info', 'Server', 'Created']}
        data={notifications.data.items.map(notification => ({
          data: [
            {
              failed: <Badge color="red">Failed</Badge>,
              pending: <Badge color="gray">Pending</Badge>,
              succeeded: <Badge color="blue">Succeeded</Badge>,
              retrying: <Badge color="yellow">Retrying</Badge>
            }[notification.status],
            <Text size="2" weight="strong">
              {notification.id}
            </Text>,
            <RenderDate date={notification.createdAt} />
          ],
          onClick: () =>
            props.details &&
            setSearchParams(p => {
              p.set('notification_id', notification.id);
              return p;
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
  let callback = useCallback(instance.data?.id, callbackId);
  let notification = useCallbackNotification(instance.data?.id, notificationId);

  let formattedRequestBody = useMemo(() => {
    if (!notification.data) return '...';

    try {
      return JSON.stringify(
        JSON.parse(notification.data.attempts[0]?.webhookRequest?.requestBody ?? ''),
        null,
        2
      );
    } catch {
      return notification.data.attempts[0]?.webhookRequest?.requestBody ?? '...';
    }
  }, [notification.data]);

  let formattedResponseBody = useMemo(() => {
    if (!notification.data) return '...';

    try {
      return JSON.stringify(
        JSON.parse(notification.data.attempts[0]?.webhookRequest?.responseBody ?? ''),
        null,
        2
      );
    } catch {
      return notification.data.attempts[0]?.webhookRequest?.responseBody ?? '...';
    }
  }, [notification.data]);

  return renderWithLoader({ notification, callback })(({ notification, callback }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Type',
            content: {
              pending: <Badge color="gray">Pending</Badge>,
              succeeded: <Badge color="blue">Succeeded</Badge>,
              retrying: <Badge color="yellow">Retrying</Badge>,
              failed: <Badge color="red">Failed</Badge>
            }[notification.data.status]
          },
          {
            label: 'ID',
            content: <ID id={callback.data.id} />
          },
          {
            label: 'Created At',
            content: <RenderDate date={notification.data.createdAt} />
          }
        ]}
      />

      <Spacer height={15} />

      {notification.data.attempts.map(att => (
        <>
          <Box title={`Attempt ${att.index}`}>
            <Datalist
              items={[
                { label: 'Created', value: <RenderDate date={att.createdAt} /> },
                { label: 'Duration', value: (att.webhookRequest?.duration ?? 0) + ' ms' },
                { label: 'Status Code', value: att.webhookRequest?.responseStatus ?? 'N/A' },
                { label: 'URL', value: att.webhookRequest?.url ?? 'N/A' },
                { label: 'ID', value: <ID id={att.id} /> }
              ]}
            />

            <Spacer height={15} />

            <InputLabel>Request Body</InputLabel>
            <Spacer height={5} />
            <CodeBlock language="json" code={formattedRequestBody} />

            <Spacer height={10} />

            <InputLabel>Response Body</InputLabel>
            <Spacer height={5} />
            <CodeBlock language="json" code={formattedResponseBody} />
          </Box>

          <Spacer height={15} />
        </>
      ))}
    </>
  ));
};
