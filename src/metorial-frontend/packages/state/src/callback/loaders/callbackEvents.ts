import type { DashboardInstanceCallbacksEventsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let callbackEventsLoader = createLoader({
  name: 'callbackEvents',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCallbacksEventsListQuery) => {
    let { instanceId, ...query } = i;
    return withAuth(sdk => sdk.callbacks.events.list(instanceId, query));
  },
  mutators: {}
});

export let useCallbackEvents = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCallbacksEventsListQuery
) => {
  let data = usePaginator(
    pagination =>
      callbackEventsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null),
    JSON.stringify(query ?? {})
  );

  return data;
};

export let callbackEventLoader = createLoader({
  name: 'callbackEvent',
  parents: [callbackEventsLoader],
  fetch: (i: { instanceId: string; callbackEventId: string }) =>
    withAuth(sdk => sdk.callbacks.events.get(i.instanceId, i.callbackEventId)),
  mutators: {}
});

export let useCallbackEvent = (
  instanceId: string | null | undefined,
  callbackEventId: string | null | undefined
) => {
  let data = callbackEventLoader.use(
    instanceId && callbackEventId ? { instanceId, callbackEventId } : null
  );

  return {
    ...data
  };
};
