import { delay } from '@lowerdeck/delay';
import { isServiceError } from '@lowerdeck/error';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { getSentry, shouldIgnoreSentryHttpError } from '@lowerdeck/sentry';
import { MetorialDashboardSDK, MetorialUser } from '@metorial/dashboard-sdk';
import { awaitConfig } from '@metorial/frontend-config';
import { isMetorialSDKError } from '@metorial/util-endpoint';
import { withDashboardSDK } from '../../sdk';
import { isAuthRoute } from './isAuthRoute';
import { redirectToAuth } from './redirect';

let ignoredSDKAuthErrorCodes = new Set([
  'bad_request',
  'invalid_data',
  'not_found',
  'unauthorized'
]);

let shouldIgnoreSentryAuthError = (error: unknown) => {
  if (shouldIgnoreSentryHttpError(error)) return true;

  return isMetorialSDKError(error) && ignoredSDKAuthErrorCodes.has(error.code);
};

let authRequiredRef = { current: true };
export let setAuthRequired = (required: boolean) => {
  authRequiredRef.current = required;
};

export let redirectToAuthIfNotAuthenticated = async <R>(fn: () => Promise<R>) => {
  if (typeof window === 'undefined') return new Promise(() => {}) as Promise<R>;

  if (window.location.pathname.startsWith('/auth/')) {
    return new Promise(() => {}) as Promise<R>;
  }

  let config = await awaitConfig();
  if (isAuthRoute(window.location.href, config.auth)) {
    return new Promise(() => {}) as Promise<R>;
  }

  if ((window as any).enterpriseRedirectToAuthIfNotAuthenticated) {
    return (window as any).enterpriseRedirectToAuthIfNotAuthenticated(fn) as Promise<R>;
  }

  try {
    return await fn();
  } catch (err: any) {
    let url = new URL(window.location.href);

    if ((window as any).getAuthCallbackUrl) {
      url = new URL((window as any).getAuthCallbackUrl());
    } else {
      if (!url.pathname.startsWith('/join/')) url.pathname = '/';
    }

    if (authRequiredRef.current) {
      if (isServiceError(err) && err.data.code == 'unauthorized') {
        redirectToAuth(url.toString());

        // Noop promise to stop execution while redirecting
        return new Promise(() => {}) as Promise<R>;
      }

      if (
        isMetorialSDKError(err) &&
        (err.code == 'unauthorized' || err.response.status == 401)
      ) {
        redirectToAuth(url.toString());

        // Noop promise to stop execution while redirecting
        return new Promise(() => {}) as Promise<R>;
      }
    }

    if (!shouldIgnoreSentryAuthError(err)) {
      getSentry().captureException(err);
    }

    throw err;
  }
};

let firstUserPromise = new ProgrammablePromise<MetorialUser>();

export let fetchUserSpecial = () => {
  if (typeof window === 'undefined') return new Promise(() => {}) as Promise<MetorialUser>;

  return redirectToAuthIfNotAuthenticated(async () => {
    await delay(1);

    let enterpriseUserPromise = (window as any).enterpriseUserPromise;
    if (enterpriseUserPromise) {
      let user = (await enterpriseUserPromise) as MetorialUser;
      if (!firstUserPromise.value) firstUserPromise.resolve(user);

      return user;
    }

    return await withDashboardSDK(async sdk => {
      let u = await sdk.user.get();
      if (!firstUserPromise.value) firstUserPromise.resolve(u);

      return u;
    });
  });
};

export let withAuth = async <O>(
  // d: { instanceId: string },
  fn: (sdk: MetorialDashboardSDK) => Promise<O>
) => {
  if (typeof window === 'undefined') return new Promise(() => {}) as Promise<O>;

  try {
    await firstUserPromise.promise;
  } catch (err) {}

  return redirectToAuthIfNotAuthenticated(() => withDashboardSDK(fn));
};

export let wrapWithAuth =
  <I, O>(fn: (i: I) => Promise<O>) =>
  async (i: I) =>
    withAuth(() => fn(i));
