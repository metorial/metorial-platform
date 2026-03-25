import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let oauthAppsLoader = createLoader({
  name: 'oauthApps',
  fetch: (i: { organizationId: string; before?: string; after?: string }) =>
    withAuth(sdk =>
      sdk.oauth.apps.list(i.organizationId, {
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {
    create: (
      i: {
        accessLevel: 'organization';
        allowTokenExchangeWithoutClientSecret?: boolean;
        name: string;
        description?: string;
        websiteUrl?: string;
        privacyPolicyUrl?: string;
        termsOfServiceUrl?: string;
        redirectUris?: string[];
        scopes: string[];
      },
      { input: { organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.oauth.apps.create(organizationId, {
          accessLevel: 'organization',
          allowTokenExchangeWithoutClientSecret: i.allowTokenExchangeWithoutClientSecret,
          name: i.name,
          description: i.description,
          websiteUrl: i.websiteUrl,
          privacyPolicyUrl: i.privacyPolicyUrl,
          termsOfServiceUrl: i.termsOfServiceUrl,
          redirectUris: i.redirectUris,
          scopes: i.scopes
        })
      )
  }
});

export let useOAuthApps = (organizationId: string | null | undefined) => {
  let oauthApps = usePaginator(cursor =>
    oauthAppsLoader.use(organizationId ? { organizationId, ...cursor } : null)
  );

  return {
    ...oauthApps,
    createMutator: oauthApps.useMutator('create')
  };
};

export let oauthAppLoader = createLoader({
  name: 'oauthApp',
  parents: [oauthAppsLoader],
  fetch: (i: { organizationId: string; oauthApplicationId: string }) =>
    withAuth(sdk => sdk.oauth.apps.get(i.organizationId, i.oauthApplicationId)),
  mutators: {
    update: (
      i: {
        accessLevel?: 'organization';
        allowTokenExchangeWithoutClientSecret?: boolean;
        name?: string;
        description?: string | null;
        websiteUrl?: string | null;
        privacyPolicyUrl?: string | null;
        termsOfServiceUrl?: string | null;
        redirectUris?: string[];
        scopes?: string[];
      },
      { input: { organizationId, oauthApplicationId } }
    ) =>
      withAuth(sdk =>
        sdk.oauth.apps.update(organizationId, oauthApplicationId, {
          accessLevel: i.accessLevel,
          allowTokenExchangeWithoutClientSecret: i.allowTokenExchangeWithoutClientSecret,
          name: i.name,
          description: i.description,
          websiteUrl: i.websiteUrl,
          privacyPolicyUrl: i.privacyPolicyUrl,
          termsOfServiceUrl: i.termsOfServiceUrl,
          redirectUris: i.redirectUris,
          scopes: i.scopes
        })
      ),

    delete: (_: {}, { input: { organizationId, oauthApplicationId } }) =>
      withAuth(sdk => sdk.oauth.apps.delete(organizationId, oauthApplicationId)),

    createClientSecret: (_: {}, { input: { organizationId, oauthApplicationId } }) =>
      withAuth(sdk => sdk.oauth.apps.clientSecrets.create(organizationId, oauthApplicationId)),

    deleteClientSecret: (
      i: { oauthApplicationClientSecretId: string },
      { input: { organizationId, oauthApplicationId } }
    ) =>
      withAuth(sdk =>
        sdk.oauth.apps.clientSecrets.delete(
          organizationId,
          oauthApplicationId,
          i.oauthApplicationClientSecretId
        )
      )
  }
});

export let useOAuthApp = (
  organizationId: string | null | undefined,
  oauthApplicationId: string | null | undefined
) => {
  let oauthApp = oauthAppLoader.use(
    organizationId && oauthApplicationId ? { organizationId, oauthApplicationId } : null
  );

  return {
    ...oauthApp,
    updateMutator: oauthApp.useMutator('update'),
    deleteMutator: oauthApp.useMutator('delete'),
    createClientSecretMutator: oauthApp.useMutator('createClientSecret'),
    deleteClientSecretMutator: oauthApp.useMutator('deleteClientSecret')
  };
};
