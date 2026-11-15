export type FetchHandler = (request: Request) => Promise<Response> | Response;

export type FetchLikeApp = {
  fetch?: (request: Request) => Promise<Response> | Response;
  request?: (path: string, init?: RequestInit) => Promise<Response>;
};

type FetchInput = Request | string | URL;

type FetchRoute = {
  origin: string;
  pathPrefix: string;
  handler: FetchHandler;
};

const createRequest = (path: string, init?: RequestInit): Request => {
  const url = path.startsWith('http')
    ? path
    : `http://test${path.startsWith('/') ? '' : '/'}${path}`;
  return new Request(url, init);
};

export const createFetchRouter = () => {
  const routes: FetchRoute[] = [];
  let originalFetch: typeof fetch | null = null;
  let installed = false;

  const registerRoute = (endpoint: string, handler: FetchHandler) => {
    const url = new URL(endpoint);
    const pathPrefix = url.pathname.replace(/\/+$/, '') || '/';

    const exists = routes.some(
      route => route.origin === url.origin && route.pathPrefix === pathPrefix
    );
    if (!exists) {
      routes.push({ origin: url.origin, pathPrefix, handler });
    }
  };

  const shouldHandle = (url: URL) =>
    routes.find(
      route => url.origin === route.origin && url.pathname.startsWith(route.pathPrefix)
    );

  const routedFetch = async (input: FetchInput, init?: RequestInit) => {
    const request =
      typeof input === 'string' || input instanceof URL
        ? new Request(input.toString(), init)
        : new Request(input, init);
    const url = new URL(request.url);

    const route = shouldHandle(url);
    if (route) {
      return route.handler(request);
    }

    if (!originalFetch) {
      throw new Error('Original fetch is not available');
    }

    return originalFetch(request);
  };

  const install = () => {
    if (installed) return;
    if (!globalThis.fetch) {
      throw new Error('global fetch is not available');
    }

    originalFetch = globalThis.fetch.bind(globalThis);
    const fetchWithProps = routedFetch as typeof fetch;
    if ('preconnect' in originalFetch) {
      (fetchWithProps as any).preconnect = (originalFetch as any).preconnect;
    }

    globalThis.fetch = fetchWithProps;
    installed = true;
  };

  const uninstall = () => {
    if (!installed) return;
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
    installed = false;
  };

  return {
    registerRoute,
    fetch: routedFetch,
    install,
    uninstall,
    isInstalled: () => installed
  };
};

const resolveRequest = (app: FetchHandler | FetchLikeApp) => {
  if (typeof app === 'function') {
    return async (path: string, init?: RequestInit) => app(createRequest(path, init));
  }

  if (app.request) {
    return (path: string, init?: RequestInit) => app.request!(path, init);
  }

  if (app.fetch) {
    return async (path: string, init?: RequestInit) => app.fetch!(createRequest(path, init));
  }

  throw new Error('createTestServer requires a fetch or request handler');
};

const resolveFetch = (app: FetchHandler | FetchLikeApp) => {
  if (typeof app === 'function') {
    return async (request: Request) => app(request);
  }

  if (app.fetch) {
    return async (request: Request) => app.fetch!(request);
  }

  if (app.request) {
    return async (request: Request) => {
      const url = new URL(request.url);
      return app.request!(`${url.pathname}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
    };
  }

  throw new Error('createTestServer requires a fetch or request handler');
};

const withJson = (init: RequestInit | undefined, body: unknown): RequestInit => {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return {
    ...init,
    headers,
    body: JSON.stringify(body)
  };
};

export const createTestServer = (app: FetchHandler | FetchLikeApp) => {
  const request = resolveRequest(app);
  const fetch = resolveFetch(app);

  return {
    fetch,
    request,
    get: (path: string, init?: RequestInit) => request(path, { ...init, method: 'GET' }),
    delete: (path: string, init?: RequestInit) => request(path, { ...init, method: 'DELETE' }),
    postJson: (path: string, body: unknown, init?: RequestInit) =>
      request(path, { ...withJson(init, body), method: 'POST' }),
    putJson: (path: string, body: unknown, init?: RequestInit) =>
      request(path, { ...withJson(init, body), method: 'PUT' }),
    patchJson: (path: string, body: unknown, init?: RequestInit) =>
      request(path, { ...withJson(init, body), method: 'PATCH' })
  };
};
