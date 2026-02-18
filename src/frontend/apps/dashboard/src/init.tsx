import { setConfig } from '@metorial/frontend-config';

let coreApiUrl = import.meta.env.VITE_CORE_API_URL;
let privateApiUrl = import.meta.env.VITE_PRIVATE_API_URL ?? import.meta.env.PRIVATE_API_URL;

let metorialEnvironment = import.meta.env.VITE_METORIAL_ENV;

if (!coreApiUrl) throw new Error('CORE_API_URL is not defined');
if (!metorialEnvironment) throw new Error('METORIAL_ENV is not defined');

setConfig({
  apiUrl: coreApiUrl,
  privateApiUrl: privateApiUrl || coreApiUrl,
  publicApiUrl: coreApiUrl,

  environment: metorialEnvironment as any,

  // enterprise: {
  //   organizationFrontendUrl: teamFrontendUrl,
  //   accountFrontendUrl: accountFrontendUrl
  // },

  microFrontends: {},

  auth: {
    authFrontendUrl: undefined,
    loginPath: '/auth/login',
    logoutPath: '/auth/logout',
    signupPath: '/auth/signup'
  }
});
