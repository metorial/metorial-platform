import { safeFetch as ssrfSafeFetch } from '@lowerdeck/ssrf';
import { checkIp } from './axiosSsrf';
import { assertUrlAllowedByEgressPolicy } from '../network/egressPolicy';

let unsafeSsrfBypass = process.env.SHUTTLE_UNSAFE_SSRF_BYPASS === 'true';

type SafeFetchOptions = RequestInit & {
  maxRedirects?: number;
  egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList | null;
};

export let safeFetch = async (input: string, options: SafeFetchOptions = {}) => {
  let { maxRedirects: maxRedirectsOption, egressPolicy, ...fetchOptions } = options;

  if (unsafeSsrfBypass && !egressPolicy) return fetch(input, fetchOptions);

  return ssrfSafeFetch(input, {
    ...fetchOptions,
    maxRedirects: maxRedirectsOption,
    isIpAllowed: unsafeSsrfBypass ? false : checkIp,
    assertUrl: url =>
      assertUrlAllowedByEgressPolicy({
        url: url.toString(),
        egressPolicy
      })
  });
};
