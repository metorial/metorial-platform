import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let outpostsLoader = createLoader({
  name: 'outposts',
  fetch: (i: { organizationId: string; before?: string; after?: string }) =>
    withAuth(sdk =>
      sdk.organizations.outposts.list(i.organizationId, {
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {
    create: (i: { name: string; description?: string }, { input: { organizationId } }) =>
      withAuth(sdk => sdk.organizations.outposts.create(organizationId, i))
  }
});

export let useOutposts = (organizationId: string | null | undefined) => {
  let outposts = usePaginator(cursor =>
    outpostsLoader.use(organizationId ? { organizationId, ...cursor } : null)
  );

  return {
    ...outposts,
    createMutator: outposts.useMutator('create')
  };
};

export let outpostLoader = createLoader({
  name: 'outpost',
  parents: [outpostsLoader],
  fetch: (i: { organizationId: string; outpostId: string }) =>
    withAuth(sdk => sdk.organizations.outposts.get(i.organizationId, i.outpostId)),
  mutators: {
    update: (
      i: { name?: string; description?: string },
      { input: { organizationId, outpostId } }
    ) => withAuth(sdk => sdk.organizations.outposts.update(organizationId, outpostId, i)),

    disable: (_: {}, { input: { organizationId, outpostId } }) =>
      withAuth(sdk => sdk.organizations.outposts.disable(organizationId, outpostId)),

    enable: (_: {}, { input: { organizationId, outpostId } }) =>
      withAuth(sdk => sdk.organizations.outposts.enable(organizationId, outpostId)),

    delete: (_: {}, { input: { organizationId, outpostId } }) =>
      withAuth(sdk => sdk.organizations.outposts.delete(organizationId, outpostId))
  }
});

export let useOutpost = (
  organizationId: string | null | undefined,
  outpostId: string | null | undefined
) => {
  let outpost = outpostLoader.use(
    organizationId && outpostId ? { organizationId, outpostId } : null
  );

  return {
    ...outpost,
    updateMutator: outpost.useMutator('update'),
    disableMutator: outpost.useMutator('disable'),
    enableMutator: outpost.useMutator('enable'),
    deleteMutator: outpost.useMutator('delete')
  };
};

export let outpostCredentialsLoader = createLoader({
  name: 'outpostCredentials',
  parents: [outpostLoader],
  fetch: (i: { organizationId: string; outpostId: string; before?: string; after?: string }) =>
    withAuth(sdk =>
      sdk.organizations.outposts.credentials.list(i.organizationId, i.outpostId, {
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {
    create: (
      i: { name: string; expiresAt?: Date },
      { input: { organizationId, outpostId } }
    ) =>
      withAuth(sdk =>
        sdk.organizations.outposts.credentials.create(organizationId, outpostId, {
          name: i.name,
          expiresAt: i.expiresAt
        })
      ),

    disable: (i: { credentialId: string }, { input: { organizationId, outpostId } }) =>
      withAuth(sdk =>
        sdk.organizations.outposts.credentials.disable(
          organizationId,
          outpostId,
          i.credentialId
        )
      ),

    delete: (i: { credentialId: string }, { input: { organizationId, outpostId } }) =>
      withAuth(sdk =>
        sdk.organizations.outposts.credentials.delete(
          organizationId,
          outpostId,
          i.credentialId
        )
      )
  }
});

export let useOutpostCredentials = (
  organizationId: string | null | undefined,
  outpostId: string | null | undefined
) => {
  let credentials = usePaginator(cursor =>
    outpostCredentialsLoader.use(
      organizationId && outpostId ? { organizationId, outpostId, ...cursor } : null
    )
  );

  return {
    ...credentials,
    createMutator: credentials.useMutator('create'),
    disableMutator: credentials.useMutator('disable'),
    deleteMutator: credentials.useMutator('delete')
  };
};

export let outpostAccessLoader = createLoader({
  name: 'outpostAccess',
  parents: [outpostLoader],
  fetch: (i: {
    organizationId: string;
    outpostId: string;
    organizationFilterId?: string;
    instanceId?: string;
    before?: string;
    after?: string;
  }) =>
    withAuth(sdk =>
      sdk.organizations.outposts.access.list(i.organizationId, i.outpostId, {
        organizationId: i.organizationFilterId,
        instanceId: i.instanceId,
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {
    set: (
      i: {
        grants: {
          instanceId: string;
          services: ('mcp_connection_proxy' | 'outpost_registration_proxy')[];
        }[];
      },
      { input: { organizationId, outpostId } }
    ) =>
      withAuth(sdk =>
        sdk.organizations.outposts.access.set(organizationId, outpostId, {
          grants: i.grants.map(grant => ({
            instanceId: grant.instanceId,
            services: grant.services
          }))
        })
      )
  }
});

export let useOutpostAccess = (
  organizationId: string | null | undefined,
  outpostId: string | null | undefined,
  filter?: { organizationFilterId?: string; instanceId?: string }
) => {
  let access = usePaginator(cursor =>
    outpostAccessLoader.use(
      organizationId && outpostId
        ? {
            organizationId,
            outpostId,
            organizationFilterId: filter?.organizationFilterId,
            instanceId: filter?.instanceId,
            ...cursor
          }
        : null
    )
  );

  return {
    ...access,
    setMutator: access.useMutator('set')
  };
};
