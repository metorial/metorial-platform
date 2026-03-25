import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let serviceAccountsLoader = createLoader({
  name: 'serviceAccounts',
  fetch: (i: { organizationId: string; before?: string; after?: string }) =>
    withAuth(sdk =>
      sdk.serviceAccounts.list(i.organizationId, {
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {
    create: (
      i: {
        name: string;
        description?: string;
        scopes: string[];
      },
      { input: { organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.serviceAccounts.create(organizationId, {
          name: i.name,
          description: i.description,
          scopes: i.scopes
        })
      )
  }
});

export let useServiceAccounts = (organizationId: string | null | undefined) => {
  let serviceAccounts = usePaginator(cursor =>
    serviceAccountsLoader.use(organizationId ? { organizationId, ...cursor } : null)
  );

  return {
    ...serviceAccounts,
    createMutator: serviceAccounts.useMutator('create')
  };
};

export let serviceAccountLoader = createLoader({
  name: 'serviceAccount',
  parents: [serviceAccountsLoader],
  fetch: (i: { organizationId: string; serviceAccountId: string }) =>
    withAuth(sdk => sdk.serviceAccounts.get(i.organizationId, i.serviceAccountId)),
  mutators: {
    update: (
      i: {
        name?: string;
        description?: string | null;
        scopes?: string[];
      },
      { input: { organizationId, serviceAccountId } }
    ) =>
      withAuth(sdk =>
        sdk.serviceAccounts.update(organizationId, serviceAccountId, {
          name: i.name,
          description: i.description,
          scopes: i.scopes
        })
      ),

    delete: (_: {}, { input: { organizationId, serviceAccountId } }) =>
      withAuth(sdk => sdk.serviceAccounts.delete(organizationId, serviceAccountId)),

    createClientSecret: (_: {}, { input: { organizationId, serviceAccountId } }) =>
      withAuth(sdk =>
        sdk.serviceAccounts.clientSecrets.create(organizationId, serviceAccountId)
      ),

    deleteClientSecret: (
      i: { oauthApplicationClientSecretId: string },
      { input: { organizationId, serviceAccountId } }
    ) =>
      withAuth(sdk =>
        sdk.serviceAccounts.clientSecrets.delete(
          organizationId,
          serviceAccountId,
          i.oauthApplicationClientSecretId
        )
      ),

    assignPolicy: (
      i: { accessPolicyId: string },
      { input: { organizationId, serviceAccountId } }
    ) =>
      withAuth(sdk =>
        sdk.serviceAccounts.policies.create(organizationId, serviceAccountId, {
          accessPolicyId: i.accessPolicyId
        })
      ),

    removePolicy: (
      i: { accessPolicyId: string },
      { input: { organizationId, serviceAccountId } }
    ) =>
      withAuth(sdk =>
        sdk.serviceAccounts.policies.delete(organizationId, serviceAccountId, i.accessPolicyId)
      )
  }
});

export let useServiceAccount = (
  organizationId: string | null | undefined,
  serviceAccountId: string | null | undefined
) => {
  let serviceAccount = serviceAccountLoader.use(
    organizationId && serviceAccountId ? { organizationId, serviceAccountId } : null
  );

  return {
    ...serviceAccount,
    updateMutator: serviceAccount.useMutator('update'),
    deleteMutator: serviceAccount.useMutator('delete'),
    createClientSecretMutator: serviceAccount.useMutator('createClientSecret'),
    deleteClientSecretMutator: serviceAccount.useMutator('deleteClientSecret'),
    assignPolicyMutator: serviceAccount.useMutator('assignPolicy'),
    removePolicyMutator: serviceAccount.useMutator('removePolicy')
  };
};

export let serviceAccountCredentialsLoader = createLoader({
  name: 'serviceAccountCredentials',
  fetch: (i: {
    organizationId: string;
    serviceAccountId: string;
    before?: string;
    after?: string;
  }) =>
    withAuth(sdk =>
      sdk.serviceAccounts.credentials.list(i.organizationId, i.serviceAccountId, {
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {}
});

export let useServiceAccountCredentials = (
  organizationId: string | null | undefined,
  serviceAccountId: string | null | undefined
) => {
  return usePaginator(cursor =>
    serviceAccountCredentialsLoader.use(
      organizationId && serviceAccountId
        ? { organizationId, serviceAccountId, ...cursor }
        : null
    )
  );
};
