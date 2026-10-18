import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export type OAuthScopeSubjectType = 'organization_member' | 'consumer';

export let oauthScopesLoader = createLoader({
  name: 'oauthScopes',
  fetch: (i: { organizationId: string; subjectType?: OAuthScopeSubjectType }) =>
    withAuth(sdk =>
      sdk.oauth.scopes.list(i.organizationId, {
        subjectType: i.subjectType
      })
    ),
  mutators: {}
});

export let useOAuthScopes = (
  organizationId: string | null | undefined,
  opts?: { subjectType?: OAuthScopeSubjectType }
) => {
  return oauthScopesLoader.use(
    organizationId ? { organizationId, subjectType: opts?.subjectType } : null
  );
};
