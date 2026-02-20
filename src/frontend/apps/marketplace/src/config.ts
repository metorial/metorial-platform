import { setConfig } from '@metorial/frontend-config';

let coreApiUrl = process.env.CORE_API_URL;
let privateApiUrl = process.env.PRIVATE_API_URL;

let metorialEnvironment = process.env.METORIAL_ENV;

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

  auth: {
    authFrontendUrl: undefined,
    loginPath: '/login',
    logoutPath: '/logout',
    signupPath: '/signup'
  }
});
