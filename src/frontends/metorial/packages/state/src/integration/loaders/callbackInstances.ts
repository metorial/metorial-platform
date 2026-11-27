import type {
  DashboardInstanceCallbackInstancesListOutput,
  DashboardInstanceCallbackInstancesListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { callbacksLoader } from './callbacks';

export type CallbackInstancePreview =
  DashboardInstanceCallbackInstancesListOutput['items'][number];

export let callbackInstancesLoader = createLoader({
  name: 'callbackInstances',
  parents: [callbacksLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceCallbackInstancesListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.callbacks.instances.list(instanceId, query);
    }),
  mutators: {}
});

export let useCallbackInstances = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCallbackInstancesListQuery
) => {
  return usePaginator(pagination =>
    callbackInstancesLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );
};

export let allCallbackInstancesLoader = createLoader({
  name: 'allCallbackInstances',
  parents: [callbacksLoader, callbackInstancesLoader],
  fetch: (
    i: { instanceId: string } & Omit<DashboardInstanceCallbackInstancesListQuery, 'limit'>
  ) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return autoPaginate(cursor =>
        sdk.callbacks.instances.list(instanceId, { ...query, ...cursor })
      );
    }),
  mutators: {}
});

export let useAllCallbackInstances = (
  instanceId: string | null | undefined,
  query?: Omit<DashboardInstanceCallbackInstancesListQuery, 'limit'>
) => allCallbackInstancesLoader.use(instanceId ? { instanceId, ...query } : null);

export let callbackInstanceLoader = createLoader({
  name: 'callbackInstance',
  parents: [callbackInstancesLoader],
  fetch: (i: { instanceId: string; callbackInstanceId: string }) =>
    withAuth(sdk => sdk.callbacks.instances.get(i.instanceId, i.callbackInstanceId)),
  mutators: {}
});

export let useCallbackInstance = (
  instanceId: string | null | undefined,
  callbackInstanceId: string | null | undefined
) =>
  callbackInstanceLoader.use(
    instanceId && callbackInstanceId ? { instanceId, callbackInstanceId } : null
  );
