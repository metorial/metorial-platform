import {
  DashboardInstanceCallbacksDestinationsCreateBody,
  DashboardInstanceCallbacksDestinationsListQuery,
  DashboardInstanceCallbacksDestinationsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let callbackDestinationsLoader = createLoader({
  name: 'callbackDestinations',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCallbacksDestinationsListQuery) =>
    withAuth(sdk => sdk.callbacks.destinations.list(i.instanceId, i)),
  mutators: {
    delete: (
      i: { callbackDestinationId: string },
      { input: { instanceId } }: { input: { instanceId: string } }
    ) =>
      withAuth(sdk => sdk.callbacks.destinations.delete(instanceId, i.callbackDestinationId))
  }
});

export let useCreateCallbackDestination = callbackDestinationsLoader.createExternalMutator(
  (i: DashboardInstanceCallbacksDestinationsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.callbacks.destinations.create(i.instanceId, i))
);

export let useRotateCallbackDestinationSigningSecret =
  callbackDestinationsLoader.createExternalMutator(
    (i: { instanceId: string; callbackDestinationId: string }) =>
      withAuth(sdk =>
        sdk.callbacks.destinations.rotateSigningSecret(i.instanceId, i.callbackDestinationId)
      )
  );

export let useCallbackDestinations = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceCallbacksDestinationsListQuery
) => {
  let data = usePaginator(pagination =>
    callbackDestinationsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return {
    ...data,
    useDeleteMutator: data.useMutator('delete')
  };
};

export let callbackDestinationLoader = createLoader({
  name: 'callbackDestination',
  parents: [callbackDestinationsLoader],
  fetch: (i: { instanceId: string; callbackDestinationId: string }) =>
    withAuth(sdk => sdk.callbacks.destinations.get(i.instanceId, i.callbackDestinationId)),
  mutators: {
    update: (
      body: DashboardInstanceCallbacksDestinationsUpdateBody,
      { input: { instanceId, callbackDestinationId } }
    ) =>
      withAuth(sdk =>
        sdk.callbacks.destinations.update(instanceId, callbackDestinationId, body)
      ),
    delete: (_: void, { input: { instanceId, callbackDestinationId } }) =>
      withAuth(sdk => sdk.callbacks.destinations.delete(instanceId, callbackDestinationId))
  }
});

export let useCallbackDestination = (
  instanceId: string | null | undefined,
  callbackDestinationId: string | null | undefined
) => {
  let data = callbackDestinationLoader.use(
    instanceId && callbackDestinationId ? { instanceId, callbackDestinationId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
