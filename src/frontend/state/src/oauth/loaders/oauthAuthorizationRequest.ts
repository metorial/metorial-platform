import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let oauthAuthorizationRequestLoader = createLoader({
  name: 'oauthAuthorizationRequest',
  fetch: (i: { urlToken: string }) =>
    withAuth(sdk => sdk.oauth.authorizationRequests.get(i.urlToken)),
  mutators: {
    accept: (
      i: { organizationId: string },
      { input: { urlToken } }: { input: { urlToken: string } }
    ) =>
      withAuth(sdk =>
        sdk.oauth.authorizationRequests.approve(urlToken, {
          organizationId: i.organizationId
        })
      ),
    reject: (
      i: { organizationId?: string },
      { input: { urlToken } }: { input: { urlToken: string } }
    ) =>
      withAuth(async sdk =>
        sdk.oauth.authorizationRequests.reject(urlToken, {
          organizationId: i.organizationId
        })
      )
  }
});

export let useOAuthAuthorizationRequest = (urlToken: string | null | undefined) => {
  let oauthAuthorizationRequest = oauthAuthorizationRequestLoader.use(
    urlToken ? { urlToken } : null
  );

  return {
    ...oauthAuthorizationRequest,
    acceptMutator: oauthAuthorizationRequest.useMutator('accept'),
    rejectMutator: oauthAuthorizationRequest.useMutator('reject')
  };
};
