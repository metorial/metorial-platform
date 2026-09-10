import type {
  DashboardInstanceCallbackEventsListOutput,
  DashboardInstanceCallbackEventsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { callbacksLoader } from './callbacks';

export type CallbackEventPreview = DashboardInstanceCallbackEventsListOutput['items'][number];

export let callbackEventsLoader = createLoader({
  name: 'callbackEvents',
  parents: [callbacksLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceCallbackEventsListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.callbacks.events.list(instanceId, query);
    }),
  mutators: {}
});

export let useCallbackEvents = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCallbackEventsListQuery
) => {
  return usePaginator(pagination =>
    callbackEventsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );
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
) =>
  callbackEventLoader.use(
    instanceId && callbackEventId ? { instanceId, callbackEventId } : null
  );
