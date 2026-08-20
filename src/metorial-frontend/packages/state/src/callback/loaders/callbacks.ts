import {
  DashboardInstanceCallbacksCreateBody,
  DashboardInstanceCallbacksListQuery,
  DashboardInstanceCallbacksUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { callbackDestinationsLoader } from './callbackDestinations';
import { callbackInstancesLoader } from './callbackInstances';

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

// The delete endpoint archives rather than hard-deletes.
export let useArchiveCallback = callbacksLoader.createExternalMutator(
  (i: { instanceId: string; callbackId: string }) =>
    withAuth(sdk => sdk.callbacks.delete(i.instanceId, i.callbackId))
);

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

export let callbackLoader = createLoader({
  name: 'callback',
  parents: [callbacksLoader, callbackInstancesLoader, callbackDestinationsLoader],
  fetch: (i: { instanceId: string; callbackId: string }) =>
    withAuth(sdk => sdk.callbacks.get(i.instanceId, i.callbackId)),
  mutators: {
    update: (
      body: DashboardInstanceCallbacksUpdateBody,
      { input: { instanceId, callbackId } }
    ) => withAuth(sdk => sdk.callbacks.update(instanceId, callbackId, body))
  }
});

// Secret lifecycle mutations live on callback instances. Keeping callback reads as a
// parent makes a completed setup action refresh both the instance detail and callback
// overview without ever caching receipt tokens or revealed material in a loader.
export let callbackSecurityParentLoaders = [callbacksLoader, callbackLoader] as const;

export let useCallback = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined
) => {
  let data = callbackLoader.use(instanceId && callbackId ? { instanceId, callbackId } : null);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
