import { DashboardInstanceCallbacksListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let callbackEventsLoader = createLoader({
  name: 'callbackEvents',
  parents: [],
  fetch: (
    i: { instanceId: string; callbackId: string } & DashboardInstanceCallbacksListQuery
  ) => withAuth(sdk => sdk.callbacks.events.list(i.instanceId, i.callbackId, i)),
  mutators: {}
});

export let useCallbackEvents = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined,
  query?: DashboardInstanceCallbacksListQuery
) => {
  let data = usePaginator(pagination =>
    callbackEventsLoader.use(
      instanceId && callbackId ? { instanceId, callbackId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let callbackEventLoader = createLoader({
  name: 'callbackEvent',
  parents: [callbackEventsLoader],
  fetch: (i: { instanceId: string; callbackId: string; eventId: string }) =>
    withAuth(sdk => sdk.callbacks.events.get(i.instanceId, i.callbackId, i.eventId)),
  mutators: {}
});

export let useCallbackEvent = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined,
  eventId: string | null | undefined
) => {
  let data = callbackEventLoader.use(
    instanceId && callbackId && eventId ? { instanceId, callbackId, eventId } : null
  );

  return {
    ...data
  };
};
