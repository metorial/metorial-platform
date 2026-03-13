import {
  DashboardInstanceIdentitiesDelegationsCreateBody,
  DashboardInstanceIdentitiesDelegationsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let identityDelegationsLoader = createLoader({
  name: 'identityDelegations',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceIdentitiesDelegationsListQuery) =>
    withAuth(sdk => sdk.identities.delegations.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateIdentityDelegation = identityDelegationsLoader.createExternalMutator(
  (i: DashboardInstanceIdentitiesDelegationsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.identities.delegations.create(i.instanceId, i)),
  { disableToast: true }
);

export let useIdentityDelegations = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIdentitiesDelegationsListQuery
) => {
  let data = usePaginator(pagination =>
    identityDelegationsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let identityDelegationLoader = createLoader({
  name: 'identityDelegation',
  parents: [identityDelegationsLoader],
  fetch: (i: { instanceId: string; identityDelegationId: string }) =>
    withAuth(sdk => sdk.identities.delegations.get(i.instanceId, i.identityDelegationId)),
  mutators: {
    revoke: (_, { input: { instanceId, identityDelegationId } }) =>
      withAuth(sdk => sdk.identities.delegations.revoke(instanceId, identityDelegationId))
  }
});

export let useIdentityDelegation = (
  instanceId: string | null | undefined,
  identityDelegationId: string | null | undefined
) => {
  let data = identityDelegationLoader.use(
    instanceId && identityDelegationId ? { instanceId, identityDelegationId } : null
  );

  return {
    ...data,
    useRevokeMutator: data.useMutator('revoke')
  };
};
