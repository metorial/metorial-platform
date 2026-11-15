import ipaddr from 'ipaddr.js';
import { isIP } from 'node:net';

export type SafeFetchOptions = BunFetchRequestInit & {
  maxRedirects?: number;
  assertUrl?: (url: URL) => Promise<void> | void;
  isIpAllowed?: ((ip: string) => boolean) | false;
};

export class SsrfBlockedError extends Error {
  constructor(message = 'Private or internal IP blocked') {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

export let isPublicIp = (ip: string) => {
  if (!ipaddr.isValid(ip)) return false;

  try {
    return ipaddr.parse(ip).range() == 'unicast';
  } catch {
    return false;
  }
};

export let safeFetch = async (input: string, options: SafeFetchOptions = {}) => {
  let {
    maxRedirects: maxRedirectsOption,
    assertUrl,
    isIpAllowed = isPublicIp,
    ...fetchOptions
  } = options;
  let maxRedirects = maxRedirectsOption ?? 5;
  let currentUrl = validateUrl(input);

  for (let i = 0; i <= maxRedirects; i++) {
    let pinnedAddress = isIpAllowed
      ? await resolveAllowedAddress(currentUrl, isIpAllowed)
      : undefined;

    await assertUrl?.(currentUrl);

    let response = pinnedAddress
      ? await fetchPinned(currentUrl, pinnedAddress, fetchOptions)
      : await fetch(currentUrl.toString(), { ...fetchOptions, redirect: 'manual' });

    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      if (i == maxRedirects) {
        throw new Error('Too many redirects');
      }

      let location = response.headers.get('location');
      if (!location) {
        throw new Error('Redirect with empty location');
      }

      currentUrl = validateUrl(new URL(location, currentUrl).toString());
      continue;
    }

    return response;
  }

  throw new Error('Unreachable');
};

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

let unbracketHostname = (url: URL) => url.hostname.replace(/^\[|\]$/g, '');

let resolveAllowedAddress = async (url: URL, isIpAllowed: (ip: string) => boolean) => {
  let hostname = unbracketHostname(url);

  if (isIP(hostname)) {
    if (!isIpAllowed(hostname)) throw new SsrfBlockedError();
    return undefined;
  }

  let results = await Bun.dns.lookup(hostname, { family: 'any' });

  for (let record of results) {
    if (!isIpAllowed(record.address)) {
      throw new SsrfBlockedError();
    }
  }

  let preferred = results.find(record => record.family == 4) ?? results[0];
  if (!preferred) throw new Error(`No address found for ${hostname}`);

  return preferred;
};

// Connecting to the validated IP keeps a second DNS resolution (rebinding) from changing the
// target. Bun's fetch sends the Host header as given and uses tls.serverName for SNI and for
// verifying the certificate, so the origin still sees and authenticates the original hostname.
let fetchPinned = async (
  url: URL,
  address: { address: string; family: number },
  fetchOptions: BunFetchRequestInit
) => {
  let pinnedUrl = new URL(url);
  pinnedUrl.hostname = address.family == 6 ? `[${address.address}]` : address.address;

  let headers = new Headers(fetchOptions.headers);
  headers.set('host', url.host);

  let isHttps = url.protocol == 'https:';

  let response = await fetch(pinnedUrl.toString(), {
    ...fetchOptions,
    headers,
    tls: isHttps ? { ...fetchOptions.tls, serverName: unbracketHostname(url) } : fetchOptions.tls,
    // Pooled sockets are keyed by the pinned IP, so a TLS connection verified for one hostname
    // could be reused for another hostname on the same (shared CDN) IP.
    ...(isHttps ? { keepalive: false } : {}),
    redirect: 'manual'
  });

  Object.defineProperty(response, 'url', { value: url.toString() });

  return response;
};
