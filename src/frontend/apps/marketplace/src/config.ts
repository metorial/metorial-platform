import { setConfig } from '@metorial/frontend-config';

let coreApiUrl = process.env.CORE_API_URL;

let authFrontendUrl = process.env.AUTH_FRONTEND_URL;
let accountFrontendUrl = process.env.ACCOUNT_FRONTEND_URL;
let teamFrontendUrl = process.env.TEAM_FRONTEND_URL;

let metorialEnvironment = process.env.METORIAL_ENV;

if (!coreApiUrl) throw new Error('CORE_API_URL is not defined');
if (!metorialEnvironment) throw new Error('METORIAL_ENV is not defined');

setConfig({
  apiUrl: coreApiUrl,
  privateApiUrl: coreApiUrl,
  publicApiUrl: coreApiUrl,

  environment: metorialEnvironment as any,

  enterprise: {
    organizationFrontendUrl: teamFrontendUrl,
    accountFrontendUrl: accountFrontendUrl
  },

  microFrontends: {},

  auth: {
    authFrontendUrl: authFrontendUrl,
    loginPath: '/login',
    logoutPath: '/logout',
    signupPath: '/signup'
  }
});
