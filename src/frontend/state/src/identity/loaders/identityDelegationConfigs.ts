import {
  DashboardInstanceIdentitiesDelegationConfigsCreateBody,
  DashboardInstanceIdentitiesDelegationConfigsListQuery,
  DashboardInstanceIdentitiesDelegationConfigsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let identityDelegationConfigsLoader = createLoader({
  name: 'identityDelegationConfigs',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceIdentitiesDelegationConfigsListQuery) =>
    withAuth(sdk => sdk.identities.delegationConfigs.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateIdentityDelegationConfig =
  identityDelegationConfigsLoader.createExternalMutator(
    (i: DashboardInstanceIdentitiesDelegationConfigsCreateBody & { instanceId: string }) =>
      withAuth(sdk => sdk.identities.delegationConfigs.create(i.instanceId, i)),
    { disableToast: true }
  );

export let useDeleteIdentityDelegationConfig =
  identityDelegationConfigsLoader.createExternalMutator(
    (i: { instanceId: string; identityDelegationConfigId: string }) =>
      withAuth(sdk =>
        sdk.identities.delegationConfigs.delete(i.instanceId, i.identityDelegationConfigId)
      )
  );

export let useIdentityDelegationConfigs = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIdentitiesDelegationConfigsListQuery
) => {
  let data = usePaginator(
    pagination =>
      identityDelegationConfigsLoader.use(
        instanceId ? { instanceId, ...pagination, ...query } : null
      ),
    instanceId && query ? JSON.stringify({ instanceId, ...query }) : instanceId
  );

  return data;
};

export let identityDelegationConfigLoader = createLoader({
  name: 'identityDelegationConfig',
  parents: [identityDelegationConfigsLoader],
  fetch: (i: { instanceId: string; identityDelegationConfigId: string }) =>
    withAuth(sdk =>
      sdk.identities.delegationConfigs.get(i.instanceId, i.identityDelegationConfigId)
    ),
  mutators: {
    update: (
      body: DashboardInstanceIdentitiesDelegationConfigsUpdateBody,
      { input: { instanceId, identityDelegationConfigId } }
    ) =>
      withAuth(sdk =>
        sdk.identities.delegationConfigs.update(instanceId, identityDelegationConfigId, body)
      ),

    delete: (_, { input: { instanceId, identityDelegationConfigId } }) =>
      withAuth(sdk =>
        sdk.identities.delegationConfigs.delete(instanceId, identityDelegationConfigId)
      )
  }
});

export let useIdentityDelegationConfig = (
  instanceId: string | null | undefined,
  identityDelegationConfigId: string | null | undefined
) => {
  let data = identityDelegationConfigLoader.use(
    instanceId && identityDelegationConfigId
      ? { instanceId, identityDelegationConfigId }
      : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
