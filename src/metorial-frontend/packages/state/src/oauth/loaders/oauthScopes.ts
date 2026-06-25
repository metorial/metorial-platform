import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let oauthScopesLoader = createLoader({
  name: 'oauthScopes',
  fetch: (i: { organizationId: string }) => withAuth(sdk => sdk.oauth.scopes.list(i.organizationId)),
  mutators: {}
});

export let useOAuthScopes = (organizationId: string | null | undefined) => {
  return oauthScopesLoader.use(organizationId ? { organizationId } : null);
};
