import {
  DashboardInstanceCallbacksDestinationsCreateBody,
  DashboardInstanceCallbacksDestinationsListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let callbackDestinationsLoader = createLoader({
  name: 'callbackDestinations',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceCallbacksDestinationsListQuery) =>
    withAuth(sdk => sdk.callbacks.destinations.list(i.instanceId, i)),
  mutators: {
    delete: (i: { destinationId: string }, { input }) =>
      withAuth(sdk => sdk.callbacks.destinations.delete(input.instanceId, i.destinationId))
  }
});

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

export let useCreateCallbackDestination = callbackDestinationsLoader.createExternalMutator(
  (i: DashboardInstanceCallbacksDestinationsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.callbacks.destinations.create(i.instanceId, i))
);

export let callbackDestinationLoader = createLoader({
  name: 'callbackDestination',
  parents: [callbackDestinationsLoader],
  fetch: (i: { instanceId: string; destinationId: string }) =>
    withAuth(sdk => sdk.callbacks.destinations.get(i.instanceId, i.destinationId)),
  mutators: {}
});

export let useCallbackDestination = (
  instanceId: string | null | undefined,
  destinationId: string | null | undefined
) => {
  let data = callbackDestinationLoader.use(
    instanceId && destinationId ? { instanceId, destinationId } : null
  );

  return {
    ...data
  };
};
