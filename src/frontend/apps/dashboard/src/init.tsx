import { setConfig } from '@metorial/frontend-config';

let coreApiUrl = import.meta.env.VITE_CORE_API_URL;
let metorialEnvironment = import.meta.env.VITE_METORIAL_ENV;

if (!coreApiUrl) throw new Error('CORE_API_URL is not defined');
if (!metorialEnvironment) throw new Error('METORIAL_ENV is not defined');

setConfig({
  apiUrl: coreApiUrl,
  privateApiUrl: coreApiUrl,
  publicApiUrl: coreApiUrl,

  environment: metorialEnvironment as any,

  microFrontends: {},

  auth: {
    authFrontendUrl: undefined,
    loginPath: '/login',
    logoutPath: '/logout',
    signupPath: '/signup'
  }
});
