import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let organizationScopesLoader = createLoader({
  name: 'organizationScopes',
  fetch: (i: { organizationId: string }) =>
    withAuth(sdk => sdk.organizations.scopes.get(i.organizationId)),
  mutators: {}
});

export let useOrganizationScopes = (organizationId: string | null | undefined) => {
  return organizationScopesLoader.use(organizationId ? { organizationId } : null);
};

export let useHasScope = (
  organizationId: string | null | undefined,
  scope: string | string[]
) => {
  let scopes = useOrganizationScopes(organizationId);
  let required = Array.isArray(scope) ? scope : [scope];

  return {
    ...scopes,
    hasScope: !!scopes.data && required.every(s => scopes.data!.scopes.includes(s))
  };
};
