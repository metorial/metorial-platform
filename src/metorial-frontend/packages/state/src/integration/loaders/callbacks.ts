import type {
  DashboardInstanceCallbacksCreateBody,
  DashboardInstanceCallbacksListOutput,
  DashboardInstanceCallbacksListQuery,
  DashboardInstanceCallbacksUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type CallbackPreview = DashboardInstanceCallbacksListOutput['items'][number];
export type CallbackSyncStatus = CallbackPreview['sync']['status'];

export let callbacksLoader = createLoader({
  name: 'callbacks',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCallbacksListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.callbacks.list(instanceId, query);
    }),
  mutators: {}
});

export let useCallbacks = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCallbacksListQuery
) => {
  return usePaginator(pagination =>
    callbacksLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );
};

export let useHasCallbacks = (instanceId: string | null | undefined) => {
  let data = callbacksLoader.use(instanceId ? { instanceId, limit: 1 } : null);

  return { ...data, hasCallbacks: (data.data?.items.length ?? 0) > 0 };
};

export let allCallbacksLoader = createLoader({
  name: 'allCallbacks',
  parents: [callbacksLoader],
  fetch: (i: { instanceId: string } & Omit<DashboardInstanceCallbacksListQuery, 'limit'>) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return autoPaginate(cursor => sdk.callbacks.list(instanceId, { ...query, ...cursor }));
    }),
  mutators: {}
});

export let useAllCallbacks = (
  instanceId: string | null | undefined,
  query?: Omit<DashboardInstanceCallbacksListQuery, 'limit'>
) => {
  return allCallbacksLoader.use(instanceId ? { instanceId, ...query } : null);
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
    delete: (_: {}, { input: { instanceId, callbackId } }) =>
      withAuth(sdk => sdk.callbacks.delete(instanceId, callbackId))
  }
});

export let useCallbackById = (
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

export let useCreateCallback = callbacksLoader.createExternalMutator(
  (i: { instanceId: string } & DashboardInstanceCallbacksCreateBody) =>
    withAuth(sdk => sdk.callbacks.create(i.instanceId, i)),
  { disableToast: true }
);

export let useDeleteCallback = callbacksLoader.createExternalMutator(
  (i: { instanceId: string; callbackId: string }) =>
    withAuth(sdk => sdk.callbacks.delete(i.instanceId, i.callbackId)),
  { disableToast: true }
);
