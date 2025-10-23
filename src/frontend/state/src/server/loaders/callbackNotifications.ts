import { DashboardInstanceCallbacksNotificationsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let callbackNotificationsLoader = createLoader({
  name: 'callbackNotifications',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCallbacksNotificationsListQuery) =>
    withAuth(sdk => sdk.callbacks.notifications.list(i.instanceId, i)),
  mutators: {}
});

export let useCallbackNotifications = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCallbacksNotificationsListQuery
) => {
  let data = usePaginator(pagination =>
    callbackNotificationsLoader.use(
      instanceId ? { instanceId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let callbackNotificationLoader = createLoader({
  name: 'callbackNotification',
  parents: [callbackNotificationsLoader],
  fetch: (i: { instanceId: string; notificationId: string }) =>
    withAuth(sdk => sdk.callbacks.notifications.get(i.instanceId, i.notificationId)),
  mutators: {}
});

export let useCallbackNotification = (
  instanceId: string | null | undefined,
  notificationId: string | null | undefined
) => {
  let data = callbackNotificationLoader.use(
    instanceId && notificationId ? { instanceId, notificationId } : null
  );

  return {
    ...data
  };
};
