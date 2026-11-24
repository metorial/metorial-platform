let proxyBaseUrl: string | null = null;

// Sends every provider request to `<baseUrl>/<original host>/<original path>` instead of the
// provider, so a stand-in can answer for all of them from one address. Used by the e2e stack.
export let routeProviderTrafficThrough = (baseUrl: string | null) => {
  proxyBaseUrl = baseUrl?.replace(/\/+$/, '') ?? null;
};

export let providerFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!proxyBaseUrl) return await fetch(input, init);

  let request = input instanceof Request ? input : null;
  let url = new URL(request ? request.url : input.toString());
  let target = `${proxyBaseUrl}/${url.host}${url.pathname}${url.search}`;

  return request ? await fetch(new Request(target, request), init) : await fetch(target, init);
}) as typeof fetch;
