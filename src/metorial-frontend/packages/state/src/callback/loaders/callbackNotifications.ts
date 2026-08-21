import { DashboardInstanceCallbacksNotificationsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useEffect, useRef } from 'react';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

let CALLBACK_NOTIFICATION_POLL_INTERVAL_MS = 3000;

export let callbackNotificationsLoader = createLoader({
  name: 'callbackNotifications',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      callbackId: string;
    } & DashboardInstanceCallbacksNotificationsListQuery
  ) => withAuth(sdk => sdk.callbacks.notifications.list(i.instanceId, i.callbackId, i)),
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
  callbackNotificationId: string | null | undefined,
  options?: { pollInterval?: number | null }
) => {
  let data = callbackNotificationLoader.use(
    instanceId && callbackId && callbackNotificationId
      ? { instanceId, callbackId, callbackNotificationId }
      : null
  );
  let isWaiting = data.data?.status
    ? ['pending', 'retrying'].includes(data.data.status)
    : false;
  let refetchRef = useRef(data.refetch);
  refetchRef.current = data.refetch;

  useEffect(() => {
    let pollInterval =
      options?.pollInterval === undefined
        ? CALLBACK_NOTIFICATION_POLL_INTERVAL_MS
        : options.pollInterval;
    if (!isWaiting || pollInterval === null) return;

    let interval = window.setInterval(() => refetchRef.current(), pollInterval);
    return () => window.clearInterval(interval);
  }, [isWaiting, options?.pollInterval]);

  return data;
};
