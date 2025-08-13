import { DashboardInstanceCustomServersRemoteServersNotificationsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let remoteServerNotificationsLoader = createLoader({
  name: 'remoteServerNotifications',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      remoteServerId: string;
    } & DashboardInstanceCustomServersRemoteServersNotificationsListQuery
  ) =>
    withAuth(sdk =>
      sdk.customServers.remoteServers.notifications.list(i.instanceId, i.remoteServerId, i)
    ),
  mutators: {}
});

export let useCustomServersNotifications = (
  instanceId: string | null | undefined,
  remoteServerId: string | null | undefined,
  query?: DashboardInstanceCustomServersRemoteServersNotificationsListQuery
) => {
  let data = usePaginator(pagination =>
    remoteServerNotificationsLoader.use(
      instanceId && remoteServerId
        ? { instanceId, remoteServerId, ...pagination, ...query }
        : null
    )
  );

  return data;
};

export let remoteServerNotificationLoader = createLoader({
  name: 'remoteServerNotification',
  parents: [remoteServerNotificationsLoader],
  fetch: (i: {
    instanceId: string;
    remoteServerId: string;
    remoteServerNotificationId: string;
  }) =>
    withAuth(sdk =>
      sdk.customServers.remoteServers.notifications.get(
        i.instanceId,
        i.remoteServerId,
        i.remoteServerNotificationId
      )
    ),
  mutators: {}
});

export let useCustomServersNotification = (
  instanceId: string | null | undefined,
  remoteServerId: string | null | undefined,
  remoteServerNotificationId: string | null | undefined
) => {
  let data = remoteServerNotificationLoader.use(
    instanceId && remoteServerNotificationId && remoteServerId
      ? { instanceId, remoteServerId, remoteServerNotificationId }
      : null
  );

  return {
    ...data
  };
};
