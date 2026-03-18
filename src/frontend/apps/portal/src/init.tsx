import { setConfig } from '@metorial/frontend-config';

let coreApiUrl = import.meta.env.VITE_CORE_API_URL!;

let metorialEnvironment = import.meta.env.VITE_METORIAL_ENV! as any;

setConfig({
  apiUrl: coreApiUrl,
  publicApiUrl: coreApiUrl,

  microFrontends: {},

  environment: metorialEnvironment,

  auth: {
    authFrontendUrl: '',
    loginPath: '/login',
    logoutPath: '/logout',
    signupPath: '/signup'
  }
});
