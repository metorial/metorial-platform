import { awaitConfig } from '@metorial/frontend-config';

export let redirectToAuth = async (
  nextUrl: string,
  opts?: {
    intent?: 'login' | 'signup';
  }
) => {
  let config = await awaitConfig();

  let u = new URL(config.auth.loginPath, config.auth.authFrontendUrl ?? location.origin);
  u.searchParams.set('redirect_uri', nextUrl);

  if (opts?.intent) u.searchParams.set('intent', opts.intent);

  window.location.replace(u.toString());
};

export let redirectToLogout = async () => {
  let config = await awaitConfig();

  let u = new URL(config.auth.logoutPath, config.auth.authFrontendUrl ?? location.origin);

  window.location.replace(u.toString());
};
