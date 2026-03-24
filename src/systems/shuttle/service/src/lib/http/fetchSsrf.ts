import { checkIp } from './axiosSsrf';

let unsafeSsrfBypass = process.env.SHUTTLE_UNSAFE_SSRF_BYPASS === 'true';

type SafeFetchOptions = RequestInit & {
  maxRedirects?: number;
};

export let safeFetch = async (input: string, options: SafeFetchOptions = {}) => {
  if (unsafeSsrfBypass) return fetch(input, options);

  let maxRedirects = options.maxRedirects ?? 5;
  let currentUrl = validateUrl(input);

  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicAddress(currentUrl.hostname);

    let response = await fetch(currentUrl.toString(), {
      ...options,
      redirect: 'manual'
    });

    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      if (i === maxRedirects) {
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

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Unsupported protocol');
  }

  if (url.username || url.password) {
    throw new Error('Credentials in URL are not allowed');
  }

  return url;
};

let assertPublicAddress = async (hostname: string) => {
  // @ts-ignore
  let results = await Bun.dns.lookup(hostname, { family: 'any' });

  for (let record of results) {
    if (!checkIp(record.address)) {
      throw new Error('Private or internal IP blocked');
    }
  }
};
