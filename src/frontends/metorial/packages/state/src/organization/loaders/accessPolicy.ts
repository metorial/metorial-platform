import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type PolicyDocumentInput = {
  access: {
    target: string;
    scopes?: string[];
    roles?: string[];
  }[];
};

export let accessPoliciesLoader = createLoader({
  name: 'accessPolicies',
  fetch: (i: { organizationId: string; before?: string; after?: string }) =>
    withAuth(sdk =>
      sdk.accessPolicies.list(i.organizationId, {
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
        document: PolicyDocumentInput;
        message?: string;
      },
      { input: { organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.accessPolicies.create(organizationId, {
          name: i.name,
          description: i.description,
          document: i.document,
          message: i.message
        })
      )
  }
});

export let useAccessPolicies = (organizationId: string | null | undefined) => {
  let accessPolicies = usePaginator(cursor =>
    accessPoliciesLoader.use(organizationId ? { organizationId, ...cursor } : null)
  );

  return {
    ...accessPolicies,
    createMutator: accessPolicies.useMutator('create')
  };
};

export let accessPolicyLoader = createLoader({
  name: 'accessPolicy',
  parents: [accessPoliciesLoader],
  fetch: (i: { organizationId: string; accessPolicyId: string }) =>
    withAuth(sdk => sdk.accessPolicies.get(i.organizationId, i.accessPolicyId)),
  mutators: {
    update: (
      i: {
        name?: string;
        description?: string | null;
        document?: PolicyDocumentInput;
        message?: string;
      },
      { input: { organizationId, accessPolicyId } }
    ) =>
      withAuth(sdk =>
        sdk.accessPolicies.update(organizationId, accessPolicyId, {
          name: i.name,
          description: i.description,
          document: i.document,
          message: i.message
        })
      ),

    delete: (_: {}, { input: { organizationId, accessPolicyId } }) =>
      withAuth(sdk => sdk.accessPolicies.delete(organizationId, accessPolicyId))
  }
});

export let useAccessPolicy = (
  organizationId: string | null | undefined,
  accessPolicyId: string | null | undefined
) => {
  let accessPolicy = accessPolicyLoader.use(
    organizationId && accessPolicyId ? { organizationId, accessPolicyId } : null
  );

  return {
    ...accessPolicy,
    updateMutator: accessPolicy.useMutator('update'),
    deleteMutator: accessPolicy.useMutator('delete')
  };
};

export let accessPolicyVersionsLoader = createLoader({
  name: 'accessPolicyVersions',
  fetch: (i: {
    organizationId: string;
    accessPolicyId: string;
    before?: string;
    after?: string;
  }) =>
    withAuth(sdk =>
      sdk.accessPolicies.versions(i.organizationId, i.accessPolicyId, {
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {}
});

export let useAccessPolicyVersions = (
  organizationId: string | null | undefined,
  accessPolicyId: string | null | undefined
) => {
  return usePaginator(cursor =>
    accessPolicyVersionsLoader.use(
      organizationId && accessPolicyId ? { organizationId, accessPolicyId, ...cursor } : null
    )
  );
};
