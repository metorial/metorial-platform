import {
  DashboardInstanceCallbacksNotificationsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let callbackNotificationsLoader = createLoader({
  name: 'callbackNotifications',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      callbackId: string;
    } & DashboardInstanceCallbacksNotificationsListQuery
  ) =>
    withAuth(sdk => sdk.callbacks.notifications.list(i.instanceId, i.callbackId, i)),
  mutators: {}
});

export let useCallbackNotifications = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined,
  query?: DashboardInstanceCallbacksNotificationsListQuery
) => {
  let data = usePaginator(
    pagination =>
      callbackNotificationsLoader.use(
        instanceId && callbackId ? { instanceId, callbackId, ...pagination, ...query } : null
      ),
    callbackId ?? null
  );

  return data;
};

export let callbackNotificationLoader = createLoader({
  name: 'callbackNotification',
  parents: [callbackNotificationsLoader],
  fetch: (i: { instanceId: string; callbackId: string; callbackNotificationId: string }) =>
    withAuth(sdk =>
      sdk.callbacks.notifications.get(i.instanceId, i.callbackId, i.callbackNotificationId)
    ),
  mutators: {}
});

export let useCallbackNotification = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined,
  callbackNotificationId: string | null | undefined
) => {
  let data = callbackNotificationLoader.use(
    instanceId && callbackId && callbackNotificationId
      ? { instanceId, callbackId, callbackNotificationId }
      : null
  );

  return {
    ...data
  };
};
