import {
  egressGatewayRefusalFromError,
  egressGatewayRefusalFromHeaders,
  type EgressGatewayRefusal,
  type EgressGatewaySubject,
  type EgressGrantLifetime
} from '@metorial-platform-systems/runtime-egress-grants';
import { getEgressGateway } from './egressGateway';

export class EgressGatewayRefusedError extends Error {
  constructor(readonly refusal: EgressGatewayRefusal) {
    super(
      refusal == 'denied'
        ? 'The network policy of this integration does not allow this destination'
        : 'The egress gateway rejected the credentials of the hub'
    );
  }
}

let validateUrl = (input: string) => {
  let url = new URL(input);

  if (url.protocol != 'http:' && url.protocol != 'https:') {
    throw new Error('Unsupported protocol');
  }
  if (url.username || url.password) {
    throw new Error('Credentials in URL are not allowed');
  }

  return url;
};

let fetchThroughGateway = async (
  url: URL,
  d: {
    subject: EgressGatewaySubject;
    headers?: Record<string, string>;
    lifetime: EgressGrantLifetime;
  }
) => {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: d.headers,
      redirect: 'manual',
      proxy: getEgressGateway().proxy(d.subject, d.lifetime)
    });
  } catch (err) {
    let refusal = egressGatewayRefusalFromError(err);
    throw refusal ? new EgressGatewayRefusedError(refusal) : err;
  }

  let refusal = egressGatewayRefusalFromHeaders(response.headers);
  if (refusal) {
    await response.body?.cancel().catch(() => {});
    throw new EgressGatewayRefusedError(refusal);
  }

  return response;
};

// The gateway resolves and checks every destination itself, so each redirect hop is sent
// through it again instead of being resolved and pinned locally.
export let gatewayFetch = async (
  input: string,
  d: {
    subject: EgressGatewaySubject;
    headers?: Record<string, string>;
    maxRedirects: number;
    lifetime: EgressGrantLifetime;
  }
) => {
  let currentUrl = validateUrl(input);

  for (let i = 0; i <= d.maxRedirects; i++) {
    let response = await fetchThroughGateway(currentUrl, d);

    let location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return response;

    await response.body?.cancel().catch(() => {});
    if (i == d.maxRedirects) throw new Error('Too many redirects');

    currentUrl = validateUrl(new URL(location, currentUrl).toString());
  }

  throw new Error('Unreachable');
};
