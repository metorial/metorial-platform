import { DashboardInstanceCallbacksEventsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let callbackEventsLoader = createLoader({
  name: 'callbackEvents',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCallbacksEventsListQuery) =>
    withAuth(sdk => sdk.callbacks.events.list(i.instanceId, i)),
  mutators: {}
});

export let useCallbackEvents = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCallbacksEventsListQuery
) => {
  let data = usePaginator(pagination =>
    callbackEventsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let callbackEventLoader = createLoader({
  name: 'callbackEvent',
  parents: [callbackEventsLoader],
  fetch: (i: { instanceId: string; eventId: string }) =>
    withAuth(sdk => sdk.callbacks.events.get(i.instanceId, i.eventId)),
  mutators: {}
});

export let useCallbackEvent = (
  instanceId: string | null | undefined,
  eventId: string | null | undefined
) => {
  let data = callbackEventLoader.use(instanceId && eventId ? { instanceId, eventId } : null);

  return {
    ...data
  };
};
