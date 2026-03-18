import {
  DashboardInstanceIdentitiesDelegationRequestsApproveQuery,
  DashboardInstanceIdentitiesDelegationRequestsCreateBody,
  DashboardInstanceIdentitiesDelegationRequestsDenyQuery,
  DashboardInstanceIdentitiesDelegationRequestsGetQuery,
  DashboardInstanceIdentitiesDelegationRequestsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let identityDelegationRequestsLoader = createLoader({
  name: 'identityDelegationRequests',
  parents: [],
  fetch: (
    i: { instanceId: string } & DashboardInstanceIdentitiesDelegationRequestsListQuery
  ) => withAuth(sdk => sdk.identities.delegationRequests.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateIdentityDelegationRequest =
  identityDelegationRequestsLoader.createExternalMutator(
    (i: DashboardInstanceIdentitiesDelegationRequestsCreateBody & { instanceId: string }) =>
      withAuth(sdk => sdk.identities.delegationRequests.create(i.instanceId, i)),
    { disableToast: true }
  );

export let useIdentityDelegationRequests = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIdentitiesDelegationRequestsListQuery
) => {
  let data = usePaginator(
    pagination =>
      identityDelegationRequestsLoader.use(
        instanceId ? { instanceId, ...pagination, ...query } : null
      ),
    instanceId && query ? JSON.stringify({ instanceId, ...query }) : instanceId
  );

  return data;
};

export let identityDelegationRequestLoader = createLoader({
  name: 'identityDelegationRequest',
  parents: [identityDelegationRequestsLoader],
  fetch: (
    i: {
      instanceId: string;
      identityDelegationRequestId: string;
    } & DashboardInstanceIdentitiesDelegationRequestsGetQuery
  ) =>
    withAuth(sdk =>
      sdk.identities.delegationRequests.get(i.instanceId, i.identityDelegationRequestId, i)
    ),
  mutators: {
    approve: (
      query: DashboardInstanceIdentitiesDelegationRequestsApproveQuery,
      { input: { instanceId, identityDelegationRequestId } }
    ) =>
      withAuth(sdk =>
        sdk.identities.delegationRequests.approve(
          instanceId,
          identityDelegationRequestId,
          query
        )
      ),

    deny: (
      query: DashboardInstanceIdentitiesDelegationRequestsDenyQuery,
      { input: { instanceId, identityDelegationRequestId } }
    ) =>
      withAuth(sdk =>
        sdk.identities.delegationRequests.deny(instanceId, identityDelegationRequestId, query)
      )
  }
});

export let useIdentityDelegationRequest = (
  instanceId: string | null | undefined,
  identityDelegationRequestId: string | null | undefined,
  query?: DashboardInstanceIdentitiesDelegationRequestsGetQuery
) => {
  let data = identityDelegationRequestLoader.use(
    instanceId && identityDelegationRequestId
      ? { instanceId, identityDelegationRequestId, ...(query ?? {}) }
      : null
  );

  return {
    ...data,
    useApproveMutator: data.useMutator('approve'),
    useDenyMutator: data.useMutator('deny')
  };
};
