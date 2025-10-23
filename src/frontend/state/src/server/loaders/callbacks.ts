import { DashboardInstanceCallbacksListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let callbacksLoader = createLoader({
  name: 'callbacks',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCallbacksListQuery) =>
    withAuth(sdk => sdk.callbacks.list(i.instanceId, i)),
  mutators: {}
});

export let useCallbacks = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCallbacksListQuery
) => {
  let data = usePaginator(pagination =>
    callbacksLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let callbackLoader = createLoader({
  name: 'callback',
  parents: [callbacksLoader],
  fetch: (i: { instanceId: string; callbackId: string }) =>
    withAuth(sdk => sdk.callbacks.get(i.instanceId, i.callbackId)),
  mutators: {}
});

export let useCallback = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined
) => {
  let data = callbackLoader.use(instanceId && callbackId ? { instanceId, callbackId } : null);

  return {
    ...data
  };
};
