import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let oauthInstallationsLoader = createLoader({
  name: 'oauthInstallations',
  fetch: (i: {
    organizationId: string;
    before?: string;
    after?: string;
    appId?: string;
  }) =>
    withAuth(sdk =>
      sdk.oauth.installations.list(i.organizationId, {
        before: i.before,
        after: i.after,
        limit: 100,
        appId: i.appId
      })
    ),
  mutators: {
    revoke: (
      i: { oauthInstallationId: string },
      { input: { organizationId } }
    ) => withAuth(sdk => sdk.oauth.installations.revoke(organizationId, i.oauthInstallationId))
  }
});

export let useOAuthInstallations = (
  organizationId: string | null | undefined,
  opts?: { appId?: string }
) => {
  let oauthInstallations = usePaginator(cursor =>
    oauthInstallationsLoader.use(
      organizationId ? { organizationId, ...cursor, appId: opts?.appId } : null
    )
  );

  return {
    ...oauthInstallations,
    revokeMutator: oauthInstallations.useMutator('revoke')
  };
};

export let oauthInstallationLoader = createLoader({
  name: 'oauthInstallation',
  parents: [oauthInstallationsLoader],
  fetch: (i: { organizationId: string; oauthInstallationId: string }) =>
    withAuth(sdk => sdk.oauth.installations.get(i.organizationId, i.oauthInstallationId)),
  mutators: {
    revoke: (_: {}, { input: { organizationId, oauthInstallationId } }) =>
      withAuth(sdk => sdk.oauth.installations.revoke(organizationId, oauthInstallationId))
  }
});

export let useOAuthInstallation = (
  organizationId: string | null | undefined,
  oauthInstallationId: string | null | undefined
) => {
  let oauthInstallation = oauthInstallationLoader.use(
    organizationId && oauthInstallationId
      ? { organizationId, oauthInstallationId }
      : null
  );

  return {
    ...oauthInstallation,
    revokeMutator: oauthInstallation.useMutator('revoke')
  };
};
