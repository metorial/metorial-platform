import { setConfig } from '@metorial/frontend-config';

let coreApiUrl = import.meta.env.VITE_CORE_API_URL;
let privateApiUrl = import.meta.env.VITE_PRIVATE_API_URL ?? import.meta.env.PRIVATE_API_URL;

let metorialEnvironment = import.meta.env.VITE_METORIAL_ENV;
type MetorialEnvironment = 'production' | 'staging' | 'development';

let isMetorialEnvironment = (value: string): value is MetorialEnvironment => {
  return value === 'production' || value === 'staging' || value === 'development';
};

if (!coreApiUrl) throw new Error('CORE_API_URL is not defined');
if (!metorialEnvironment) throw new Error('METORIAL_ENV is not defined');
if (!isMetorialEnvironment(metorialEnvironment)) {
  throw new Error(`Invalid METORIAL_ENV: ${metorialEnvironment}`);
}

setConfig({
  apiUrl: coreApiUrl,
  publicApiUrl: coreApiUrl,

  environment: metorialEnvironment,

  auth: {
    authFrontendUrl: undefined,
    loginPath: '/auth/login',
    logoutPath: '/auth/logout',
    signupPath: '/auth/signup'
  }
});
