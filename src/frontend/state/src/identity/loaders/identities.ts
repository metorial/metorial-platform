import {
  DashboardInstanceIdentitiesCreateBody,
  DashboardInstanceIdentitiesListQuery,
  DashboardInstanceIdentitiesUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let identitiesLoader = createLoader({
  name: 'identities',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceIdentitiesListQuery) =>
    withAuth(sdk => sdk.identities.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateIdentity = identitiesLoader.createExternalMutator(
  (i: DashboardInstanceIdentitiesCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.identities.create(i.instanceId, i)),
  { disableToast: true }
);

export let useIdentities = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIdentitiesListQuery
) => {
  let data = usePaginator(pagination =>
    identitiesLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let identityLoader = createLoader({
  name: 'identity',
  parents: [identitiesLoader],
  fetch: (i: { instanceId: string; identityId: string }) =>
    withAuth(sdk => sdk.identities.get(i.instanceId, i.identityId)),
  mutators: {
    update: (
      body: DashboardInstanceIdentitiesUpdateBody,
      { input: { instanceId, identityId } }
    ) => withAuth(sdk => sdk.identities.update(instanceId, identityId, body)),

    delete: (_, { input: { instanceId, identityId } }) =>
      withAuth(sdk => sdk.identities.delete(instanceId, identityId))
  }
});

export let useIdentity = (
  instanceId: string | null | undefined,
  identityId: string | null | undefined
) => {
  let data = identityLoader.use(instanceId && identityId ? { instanceId, identityId } : null);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
