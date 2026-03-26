import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let accessRolesLoader = createLoader({
  name: 'accessRoles',
  fetch: (i: { organizationId: string; before?: string; after?: string }) =>
    withAuth(sdk =>
      sdk.accessRoles.list(i.organizationId, {
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
        scopes?: string[];
        message?: string;
      },
      { input: { organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.accessRoles.create(organizationId, {
          name: i.name,
          description: i.description,
          scopes: i.scopes,
          message: i.message
        })
      )
  }
});

export let useAccessRoles = (organizationId: string | null | undefined) => {
  let accessRoles = usePaginator(cursor =>
    accessRolesLoader.use(organizationId ? { organizationId, ...cursor } : null)
  );

  return {
    ...accessRoles,
    createMutator: accessRoles.useMutator('create')
  };
};

export let accessRoleLoader = createLoader({
  name: 'accessRole',
  parents: [accessRolesLoader],
  fetch: (i: { organizationId: string; accessRoleId: string }) =>
    withAuth(sdk => sdk.accessRoles.get(i.organizationId, i.accessRoleId)),
  mutators: {
    update: (
      i: {
        name?: string;
        description?: string | null;
        scopes?: string[];
        message?: string;
      },
      { input: { organizationId, accessRoleId } }
    ) =>
      withAuth(sdk =>
        sdk.accessRoles.update(organizationId, accessRoleId, {
          name: i.name,
          description: i.description,
          scopes: i.scopes,
          message: i.message
        })
      ),

    delete: (_: {}, { input: { organizationId, accessRoleId } }) =>
      withAuth(sdk => sdk.accessRoles.delete(organizationId, accessRoleId))
  }
});

export let useAccessRole = (
  organizationId: string | null | undefined,
  accessRoleId: string | null | undefined
) => {
  let accessRole = accessRoleLoader.use(
    organizationId && accessRoleId ? { organizationId, accessRoleId } : null
  );

  return {
    ...accessRole,
    updateMutator: accessRole.useMutator('update'),
    deleteMutator: accessRole.useMutator('delete')
  };
};

export let accessRoleVersionsLoader = createLoader({
  name: 'accessRoleVersions',
  fetch: (i: {
    organizationId: string;
    accessRoleId: string;
    before?: string;
    after?: string;
  }) =>
    withAuth(sdk =>
      sdk.accessRoles.versions(i.organizationId, i.accessRoleId, {
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {}
});

export let useAccessRoleVersions = (
  organizationId: string | null | undefined,
  accessRoleId: string | null | undefined
) => {
  return usePaginator(cursor =>
    accessRoleVersionsLoader.use(
      organizationId && accessRoleId ? { organizationId, accessRoleId, ...cursor } : null
    )
  );
};
