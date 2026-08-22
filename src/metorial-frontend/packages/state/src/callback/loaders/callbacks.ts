import type { DashboardInstanceCallbacksListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { callbackInstancesLoader } from './callbackInstances';

export let callbacksLoader = createLoader({
  name: 'callbacks',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCallbacksListQuery) =>
    withAuth(sdk => sdk.callbacks.list(i.instanceId, i)),
  mutators: {}
});

export type SendCallbackTestEventInput = {
  instanceId: string;
  callbackId: string;
  callbackInstanceId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export let useSendCallbackTestEvent = callbacksLoader.createExternalMutator(
  (i: SendCallbackTestEventInput) =>
    withAuth(sdk =>
      sdk.callbacks.instances.sendTestEvent(i.instanceId, i.callbackId, i.callbackInstanceId, {
        eventType: i.eventType,
        payload: i.payload
      })
    )
);

export let useCallbacks = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCallbacksListQuery
) => {
  let data = usePaginator(pagination =>
    callbacksLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let allCallbacksLoader = createLoader({
  name: 'allCallbacks',
  parents: [callbacksLoader],
  fetch: (i: { instanceId: string }) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.callbacks.list(i.instanceId, {
          ...cursor,
          status: ['active', 'archived']
        })
      )
    ),
  mutators: {}
});

export let useAllCallbacks = (instanceId: string | null | undefined) =>
  allCallbacksLoader.use(instanceId ? { instanceId } : null);

export let callbackLoader = createLoader({
  name: 'callback',
  parents: [callbacksLoader, callbackInstancesLoader],
  fetch: (i: { instanceId: string; callbackId: string }) =>
    withAuth(sdk => sdk.callbacks.get(i.instanceId, i.callbackId)),
  mutators: {}
});

export let useCallback = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined
) => {
  let data = callbackLoader.use(instanceId && callbackId ? { instanceId, callbackId } : null);

  return data;
};
