import { safeFetch as ssrfSafeFetch } from '@lowerdeck/ssrf';
import type { EgressContext } from '../egress/context';
import {
  assertGatewayAccepted,
  getGatewayFetchProxy,
  toGatewayTunnelError
} from '../egress/gateway';
import type { EgressGrantLifetime } from '../egress/grant';
import { isGatewayEgress } from '../egress/mode';
import { assertUrlAllowedByEgressPolicy } from '../network/egressPolicy';
import { checkIp } from './axiosSsrf';

let unsafeSsrfBypass = process.env.SHUTTLE_UNSAFE_SSRF_BYPASS === 'true';

type SafeFetchOptions = RequestInit & {
  maxRedirects?: number;
  egress: EgressContext;
  egressLifetime?: EgressGrantLifetime;
};

// The gateway resolves, pins and authorizes every destination against the grant's policy, so
// the local DNS, private-range and policy checks only apply when connecting directly.
let gatewayFetch = async (
  input: string,
  d: {
    fetchOptions: RequestInit;
    maxRedirects?: number;
    egress: EgressContext;
    lifetime: EgressGrantLifetime;
  }
) => {
  try {
    let response = await ssrfSafeFetch(input, {
      ...d.fetchOptions,
      maxRedirects: d.maxRedirects,
      isIpAllowed: false,
      proxy: getGatewayFetchProxy(d.egress, d.lifetime),
      keepalive: false
    });

    assertGatewayAccepted(response);

    return response;
  } catch (error) {
    throw toGatewayTunnelError(error);
  }
};

export let safeFetch = async (input: string, options: SafeFetchOptions) => {
  let {
    maxRedirects: maxRedirectsOption,
    egress,
    egressLifetime = 'request',
    ...fetchOptions
  } = options;

  if (isGatewayEgress()) {
    return gatewayFetch(input, {
      fetchOptions,
      maxRedirects: maxRedirectsOption,
      egress,
      lifetime: egressLifetime
    });
  }

  let egressPolicy = egress.egressPolicy;

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
