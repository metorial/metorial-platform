import {
  DashboardInstanceIdentitiesCredentialsCreateBody,
  DashboardInstanceIdentitiesCredentialsListQuery,
  DashboardInstanceIdentitiesCredentialsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let identityCredentialsLoader = createLoader({
  name: 'identityCredentials',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceIdentitiesCredentialsListQuery) =>
    withAuth(sdk => sdk.identities.credentials.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateIdentityCredential = identityCredentialsLoader.createExternalMutator(
  (i: DashboardInstanceIdentitiesCredentialsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.identities.credentials.create(i.instanceId, i)),
  { disableToast: true }
);

export let useIdentityCredentials = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIdentitiesCredentialsListQuery
) => {
  let data = usePaginator(pagination =>
    identityCredentialsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let identityCredentialLoader = createLoader({
  name: 'identityCredential',
  parents: [identityCredentialsLoader],
  fetch: (i: { instanceId: string; identityCredentialId: string }) =>
    withAuth(sdk => sdk.identities.credentials.get(i.instanceId, i.identityCredentialId)),
  mutators: {
    update: (
      body: DashboardInstanceIdentitiesCredentialsUpdateBody,
      { input: { instanceId, identityCredentialId } }
    ) =>
      withAuth(sdk =>
        sdk.identities.credentials.update(instanceId, identityCredentialId, body)
      ),

    delete: (_, { input: { instanceId, identityCredentialId } }) =>
      withAuth(sdk => sdk.identities.credentials.delete(instanceId, identityCredentialId))
  }
});

export let useIdentityCredential = (
  instanceId: string | null | undefined,
  identityCredentialId: string | null | undefined
) => {
  let data = identityCredentialLoader.use(
    instanceId && identityCredentialId ? { instanceId, identityCredentialId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
