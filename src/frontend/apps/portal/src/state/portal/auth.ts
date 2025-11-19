import { createLoader } from '@metorial/data-hooks';
import { getPortalInfo, portalClient } from './client';

let authState = createLoader({
  name: 'auth',
  hash: () => 'v1',
  fetch: async (d: {}) => {
    let portalInfo = await getPortalInfo();
    return portalClient.auth.boot({ portalId: portalInfo.portal.id });
  },
  mutators: {
    authenticateWithEmailCodeStart: (i: { email: string }, { output: { portal } }) =>
      portalClient.auth.authenticateWithEmailCodeStart({
        portalId: portal.id,
        email: i.email
      }),

    authenticateWithEmailCodeComplete: (
      i: { email: string; code: string },
      { output: { portal } }
    ) =>
      portalClient.auth.authenticateWithEmailCodeComplete({
        portalId: portal.id,
        email: i.email,
        code: i.code
      }),

    authenticateWithSsoStart: (i: { authFactorId: string }, { output: { portal } }) =>
      portalClient.auth.authenticateWithSsoStart({
        portalId: portal.id,
        authFactorId: i.authFactorId
      }),

    authenticateWithSsoComplete: (i: { ssoAuthId: string }, { output: { portal } }) =>
      portalClient.auth.authenticateWithSsoComplete({
        ssoAuthId: i.ssoAuthId
      }),

    logout: (_, { output: { portal } }) =>
      portalClient.auth.logout({
        portalId: portal.id
      })
  }
});

export let useAuth = () => {
  let auth = authState.use({});

  return {
    ...auth,
    useAuthenticateWithEmailCodeStart: auth.useMutator('authenticateWithEmailCodeStart'),
    useAuthenticateWithEmailCodeComplete: auth.useMutator('authenticateWithEmailCodeComplete'),
    useAuthenticateWithSsoStart: auth.useMutator('authenticateWithSsoStart'),
    useAuthenticateWithSsoComplete: auth.useMutator('authenticateWithSsoComplete'),
    useLogout: auth.useMutator('logout')
  };
};
