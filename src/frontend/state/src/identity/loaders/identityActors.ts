import {
  DashboardInstanceIdentityActorsCreateBody,
  DashboardInstanceIdentityActorsListQuery,
  DashboardInstanceIdentityActorsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let identityActorsLoader = createLoader({
  name: 'identityActors',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceIdentityActorsListQuery) =>
    withAuth(sdk => sdk.identityActors.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateIdentityActor = identityActorsLoader.createExternalMutator(
  (i: DashboardInstanceIdentityActorsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.identityActors.create(i.instanceId, i)),
  { disableToast: true }
);

export let useIdentityActors = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIdentityActorsListQuery
) => {
  let data = usePaginator(pagination =>
    identityActorsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let identityActorLoader = createLoader({
  name: 'identityActor',
  parents: [identityActorsLoader],
  fetch: (i: { instanceId: string; identityActorId: string }) =>
    withAuth(sdk => sdk.identityActors.get(i.instanceId, i.identityActorId)),
  mutators: {
    update: (
      body: DashboardInstanceIdentityActorsUpdateBody,
      { input: { instanceId, identityActorId } }
    ) => withAuth(sdk => sdk.identityActors.update(instanceId, identityActorId, body)),

    delete: (_, { input: { instanceId, identityActorId } }) =>
      withAuth(sdk => sdk.identityActors.delete(instanceId, identityActorId))
  }
});

export let useIdentityActor = (
  instanceId: string | null | undefined,
  identityActorId: string | null | undefined
) => {
  let data = identityActorLoader.use(
    instanceId && identityActorId ? { instanceId, identityActorId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
