import { DashboardInstanceCustomServersEventsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let customServerEventsLoader = createLoader({
  name: 'customServerEvents',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      customServerId: string;
    } & DashboardInstanceCustomServersEventsListQuery
  ) => withAuth(sdk => sdk.customServers.events.list(i.instanceId, i.customServerId, i)),
  mutators: {}
});

export let useCustomServerEvents = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  query?: DashboardInstanceCustomServersEventsListQuery
) => {
  let data = usePaginator(pagination =>
    customServerEventsLoader.use(
      instanceId && customServerId
        ? { instanceId, customServerId, ...pagination, ...query }
        : null
    )
  );

  return data;
};

export let customServerEventLoader = createLoader({
  name: 'customServerEvent',
  parents: [customServerEventsLoader],
  fetch: (i: { instanceId: string; customServerId: string; customServerEventId: string }) =>
    withAuth(sdk =>
      sdk.customServers.events.get(i.instanceId, i.customServerId, i.customServerEventId)
    ),
  mutators: {}
});

export let useCustomServerEvent = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  customServerEventId: string | null | undefined
) => {
  let data = customServerEventLoader.use(
    instanceId && customServerEventId && customServerId
      ? { instanceId, customServerId, customServerEventId }
      : null
  );

  return {
    ...data
  };
};
