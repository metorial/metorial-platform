import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let oauthAuthorizationsLoader = createLoader({
  name: 'oauthAuthorizations',
  fetch: (i: {
    organizationId: string;
    before?: string;
    after?: string;
    installationId?: string;
    appId?: string;
  }) =>
    withAuth(sdk =>
      sdk.oauth.authorizations.list(i.organizationId, {
        before: i.before,
        after: i.after,
        limit: 100,
        installationId: i.installationId,
        appId: i.appId
      })
    ),
  mutators: {
    revoke: (
      i: { oauthAuthorizationId: string },
      { input: { organizationId } }
    ) => withAuth(sdk => sdk.oauth.authorizations.revoke(organizationId, i.oauthAuthorizationId))
  }
});

export let useOAuthAuthorizations = (
  organizationId: string | null | undefined,
  opts?: { installationId?: string; appId?: string }
) => {
  let oauthAuthorizations = usePaginator(cursor =>
    oauthAuthorizationsLoader.use(
      organizationId
        ? {
            organizationId,
            ...cursor,
            installationId: opts?.installationId,
            appId: opts?.appId
          }
        : null
    )
  );

  return {
    ...oauthAuthorizations,
    revokeMutator: oauthAuthorizations.useMutator('revoke')
  };
};

export let oauthAuthorizationLoader = createLoader({
  name: 'oauthAuthorization',
  parents: [oauthAuthorizationsLoader],
  fetch: (i: { organizationId: string; oauthAuthorizationId: string }) =>
    withAuth(sdk => sdk.oauth.authorizations.get(i.organizationId, i.oauthAuthorizationId)),
  mutators: {
    revoke: (_: {}, { input: { organizationId, oauthAuthorizationId } }) =>
      withAuth(sdk => sdk.oauth.authorizations.revoke(organizationId, oauthAuthorizationId))
  }
});

export let useOAuthAuthorization = (
  organizationId: string | null | undefined,
  oauthAuthorizationId: string | null | undefined
) => {
  let oauthAuthorization = oauthAuthorizationLoader.use(
    organizationId && oauthAuthorizationId
      ? { organizationId, oauthAuthorizationId }
      : null
  );

  return {
    ...oauthAuthorization,
    revokeMutator: oauthAuthorization.useMutator('revoke')
  };
};
