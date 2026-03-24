import {
  DashboardInstanceCallbacksEventsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let callbackEventsLoader = createLoader({
  name: 'callbackEvents',
  parents: [],
  fetch: (
    i: { instanceId: string; callbackId: string } & DashboardInstanceCallbacksEventsListQuery
  ) => withAuth(sdk => sdk.callbacks.events.list(i.instanceId, i.callbackId, i)),
  mutators: {}
});

export let useCallbackEvents = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined,
  query?: DashboardInstanceCallbacksEventsListQuery
) => {
  let data = usePaginator(
    pagination =>
      callbackEventsLoader.use(
        instanceId && callbackId ? { instanceId, callbackId, ...pagination, ...query } : null
      ),
    callbackId ?? null
  );

  return data;
};

export let callbackEventLoader = createLoader({
  name: 'callbackEvent',
  parents: [callbackEventsLoader],
  fetch: (i: { instanceId: string; callbackId: string; callbackEventId: string }) =>
    withAuth(sdk => sdk.callbacks.events.get(i.instanceId, i.callbackId, i.callbackEventId)),
  mutators: {}
});

export let useCallbackEvent = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined,
  callbackEventId: string | null | undefined
) => {
  let data = callbackEventLoader.use(
    instanceId && callbackId && callbackEventId
      ? { instanceId, callbackId, callbackEventId }
      : null
  );

  return {
    ...data
  };
};
