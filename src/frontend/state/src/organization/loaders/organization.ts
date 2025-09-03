import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { withAuth } from '../../user';
import { bootLoader } from './boot';

export let organizationsLoader = createLoader({
  name: 'organizations',
  parents: [bootLoader],
  fetch: () =>
    withAuth(sdk => autoPaginate(cursor => sdk.organizations.list({ limit: 100, ...cursor }))),
  mutators: {
    create: (i: { name: string }) =>
      withAuth(async sdk => {
        let newOrg =
          (await (window as any)?.metorial_enterprise?.createOrganization?.(i)) ??
          (await sdk.organizations.create(i));

        return sdk.organizations.get(newOrg.id);
      })
  }
});

export let useOrganizations = () => {
  let organizations = organizationsLoader.use();

  return {
    ...organizations,
    createMutator: organizations.useMutator('create')
  };
};

export let organizationLoader = createLoader({
  name: 'organization',
  parents: [organizationsLoader, bootLoader],
  fetch: (i: { organizationId: string }) =>
    withAuth(sdk => sdk.organizations.get(i.organizationId)),
  mutators: {
    update: (
      i: {
        name?: string;
        imageFileId?: string | null;
      },
      { output: { id } }
    ) =>
      withAuth(sdk =>
        sdk.organizations.update(id, {
          name: i.name
        })
      ),

    delete: (_, { output: { id } }) => withAuth(sdk => sdk.organizations.delete(id))
  }
});

export let useOrganization = (organizationId: string | null | undefined) => {
  let organization = organizationLoader.use(organizationId ? { organizationId } : null);

  return {
    ...organization,
    updateMutator: organization.useMutator('update'),
    deleteMutator: organization.useMutator('delete')
  };
};
