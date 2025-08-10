import { PrivateClient } from '@metorial/api-private/client';
import { MetorialDashboardSDK, MetorialUser } from '@metorial/dashboard-sdk';
import { isServiceError } from '@metorial/error';
import { ProgrammablePromise } from '@metorial/programmable-promise';
import { getSentry } from '@metorial/sentry';
import { isMetorialSDKError } from '@metorial/util-endpoint';
import { withDashboardSDK, withPrivateClient } from '../../sdk';
import { redirectToAuth } from './redirect';

let Sentry = getSentry();

let authRequiredRef = { current: true };
export let setAuthRequired = (required: boolean) => {
  authRequiredRef.current = required;
};

let redirectToAuthIfNotAuthenticated = async <R>(fn: () => Promise<R>) => {
  if (typeof window === 'undefined') return new Promise(() => {}) as Promise<R>;

  if (window.location.pathname.startsWith('/auth/'))
    return new Promise(() => {}) as Promise<R>;

  try {
    return await fn();
  } catch (err: any) {
    let url = new URL(window.location.href);
    if (!url.pathname.startsWith('/join/')) url.pathname = '/';

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

    if (
      err.code != 'unauthorized' &&
      err.code != 'not_found' &&
      err.code != 'bad_request' &&
      err.code != 'invalid_data'
    )
      Sentry.captureException(err);

    throw err;
  }
};

let firstUserPromise = new ProgrammablePromise<MetorialUser>();

export let fetchUserSpecial = () => {
  if (typeof window === 'undefined') return new Promise(() => {}) as Promise<MetorialUser>;

  return redirectToAuthIfNotAuthenticated(() =>
    withDashboardSDK(async sdk => {
      let u = await sdk.user.get();
      if (!firstUserPromise.value) firstUserPromise.resolve(u);

      return u;
    })
  );
};

export let withAuth = async <O>(fn: (sdk: MetorialDashboardSDK) => Promise<O>) => {
  if (typeof window === 'undefined') return new Promise(() => {}) as Promise<O>;

  try {
    await firstUserPromise.promise;
  } catch (err) {}

  return redirectToAuthIfNotAuthenticated(() => withDashboardSDK(fn));
};

export let withAuthPrivate = async <O>(
  opts: {
    organizationId: string;
  },
  fn: (sdk: PrivateClient) => Promise<O>
) => {
  if (typeof window === 'undefined') return new Promise(() => {}) as Promise<O>;

  try {
    await firstUserPromise.promise;
  } catch (err) {}

  return redirectToAuthIfNotAuthenticated(() => withPrivateClient(opts, fn));
};

export let wrapWithAuth =
  <I, O>(fn: (i: I) => Promise<O>) =>
  async (i: I) =>
    withAuth(() => fn(i));
