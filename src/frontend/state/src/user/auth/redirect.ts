import { getConfig } from '@metorial/frontend-config';

export let redirectToAuth = (nextUrl: string) => {
  let config = getConfig();

  let u = new URL(config.auth.loginPath, config.auth.authFrontendUrl ?? location.origin);
  u.searchParams.set('redirect_uri', nextUrl);

  window.location.replace(u.toString());
};

export let redirectToLogout = () => {
  let config = getConfig();

  let u = new URL(config.auth.logoutPath, config.auth.authFrontendUrl ?? location.origin);

  window.location.replace(u.toString());
};
