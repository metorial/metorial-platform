import ipaddr from 'ipaddr.js';

export type SafeFetchOptions = RequestInit & {
  maxRedirects?: number;
  assertUrl?: (url: URL) => Promise<void> | void;
  isIpAllowed?: ((ip: string) => boolean) | false;
};

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
    if (isIpAllowed) {
      await assertAllowedAddress(currentUrl.hostname, isIpAllowed);
    }

    await assertUrl?.(currentUrl);

    let response = await fetch(currentUrl.toString(), {
      ...fetchOptions,
      redirect: 'manual'
    });

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

let assertAllowedAddress = async (hostname: string, isIpAllowed: (ip: string) => boolean) => {
  let results = await Bun.dns.lookup(hostname, { family: 'any' });

  for (let record of results) {
    if (!isIpAllowed(record.address)) {
      throw new Error('Private or internal IP blocked');
    }
  }
};
