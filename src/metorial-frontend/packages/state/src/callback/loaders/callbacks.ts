import {
  DashboardInstanceCallbacksCreateBody,
  DashboardInstanceCallbacksListQuery,
  DashboardInstanceCallbacksUpdateBody
} from '@metorial/dashboard-sdk';
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

export let useCreateCallback = callbacksLoader.createExternalMutator(
  (i: DashboardInstanceCallbacksCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.callbacks.create(i.instanceId, i))
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

export let callbackLoader = createLoader({
  name: 'callback',
  parents: [callbacksLoader],
  fetch: (i: { instanceId: string; callbackId: string }) =>
    withAuth(sdk => sdk.callbacks.get(i.instanceId, i.callbackId)),
  mutators: {
    update: (
      body: DashboardInstanceCallbacksUpdateBody,
      { input: { instanceId, callbackId } }
    ) => withAuth(sdk => sdk.callbacks.update(instanceId, callbackId, body)),
    delete: (_: void, { input: { instanceId, callbackId } }) =>
      withAuth(sdk => sdk.callbacks.delete(instanceId, callbackId))
  }
});

export let useCallback = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined
) => {
  let data = callbackLoader.use(instanceId && callbackId ? { instanceId, callbackId } : null);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
