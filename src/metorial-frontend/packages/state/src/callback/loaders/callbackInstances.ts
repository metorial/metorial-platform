import {
  DashboardInstanceCallbacksInstancesCreateBody,
  DashboardInstanceCallbacksInstancesListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type CallbackSecretOwnerInput = {
  instanceId: string;
  callbackId: string;
  callbackInstanceId: string;
};

export let callbackInstancesLoader = createLoader({
  name: 'callbackInstances',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      callbackId: string;
    } & DashboardInstanceCallbacksInstancesListQuery
  ) => withAuth(sdk => sdk.callbacks.instances.list(i.instanceId, i.callbackId, i)),
  mutators: {
    delete: (
      i: { callbackInstanceId: string },
      {
        input: { instanceId, callbackId }
      }: { input: { instanceId: string; callbackId: string } }
    ) =>
      withAuth(sdk =>
        sdk.callbacks.instances.delete(instanceId, callbackId, i.callbackInstanceId)
      )
  }
});

export let useCreateCallbackInstance = callbackInstancesLoader.createExternalMutator(
  (
    i: DashboardInstanceCallbacksInstancesCreateBody & {
      instanceId: string;
      callbackId: string;
    }
  ) => withAuth(sdk => sdk.callbacks.instances.create(i.instanceId, i.callbackId, i))
);

export let useCreateCallbackReceiverPathSecret = callbackInstancesLoader.createExternalMutator(
  (i: CallbackSecretOwnerInput) =>
    withAuth(sdk =>
      sdk.callbacks.instances.createReceiverPathSecret(
        i.instanceId,
        i.callbackId,
        i.callbackInstanceId
      )
    )
);

export let useRotateCallbackReceiverPathSecret = callbackInstancesLoader.createExternalMutator(
  (i: CallbackSecretOwnerInput) =>
    withAuth(sdk =>
      sdk.callbacks.instances.rotateReceiverPathSecret(
        i.instanceId,
        i.callbackId,
        i.callbackInstanceId
      )
    )
);

export let useCallbackInstances = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined,
  query?: DashboardInstanceCallbacksInstancesListQuery
) => {
  let data = usePaginator(
    pagination =>
      callbackInstancesLoader.use(
        instanceId && callbackId ? { instanceId, callbackId, ...pagination, ...query } : null
      ),
    callbackId ?? null
  );

  return {
    ...data,
    useDeleteMutator: data.useMutator('delete')
  };
};

export let callbackInstanceLoader = createLoader({
  name: 'callbackInstance',
  parents: [callbackInstancesLoader],
  fetch: (i: { instanceId: string; callbackId: string; callbackInstanceId: string }) =>
    withAuth(sdk =>
      sdk.callbacks.instances.get(i.instanceId, i.callbackId, i.callbackInstanceId)
    ),
  mutators: {}
});

export let useCallbackInstance = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined,
  callbackInstanceId: string | null | undefined
) => {
  let data = callbackInstanceLoader.use(
    instanceId && callbackId && callbackInstanceId
      ? { instanceId, callbackId, callbackInstanceId }
      : null
  );

  return data;
};
