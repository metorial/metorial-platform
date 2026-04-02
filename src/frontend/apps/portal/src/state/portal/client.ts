import { isServiceError, ServiceError, unauthorizedError } from '@lowerdeck/error';
import { createCustomPortalClient } from '@metorial/api-custom-portal/client';
import { createLoader } from '@metorial/data-hooks';
import { useEffect } from 'react';

export let portalClient = createCustomPortalClient(
  import.meta.env.VITE_CUSTOM_PORTAL_API_URL as string
);

export let getPortalUrlForBoot = () => {
  let url = new URL(window.location.href);
  url.search = '';
  url.hash = '';

  return url.toString();
};

export let getPortalBasePath = (portalUrl: string) => {
  let pathname = new URL(portalUrl).pathname.replace(/\/+$/, '');
  return pathname || '/';
};

export let buildPortalPath = (portalUrl: string, ...parts: (string | null | undefined)[]) => {
  let segments = [getPortalBasePath(portalUrl), ...parts]
    .filter((part): part is string => !!part)
    .map(part => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);

  return `/${segments.join('/')}`.replace(/\/{2,}/g, '/');
};

export let buildPortalUrl = (portalUrl: string, ...parts: (string | null | undefined)[]) => {
  let url = new URL(portalUrl);
  url.pathname = buildPortalPath(portalUrl, ...parts);
  url.search = '';
  url.hash = '';

  return url.toString();
};

let isPendingPortalSsoCallback = (url: URL) => {
  return url.searchParams.get('__metorial_portal_action__') == 'sso_callback';
};

let isPortalLoginUrl = (url: URL) => {
  let pathname = url.pathname.replace(/\/+$/, '');
  return pathname == '/login' || pathname.endsWith('/login');
};

let preservePendingPortalSsoCallback = (d: { from: URL; to: string }) => {
  let nextUrl = new URL(d.to);

  if (!isPendingPortalSsoCallback(d.from)) {
    return nextUrl.toString();
  }

  nextUrl.search = d.from.search;
  return nextUrl.toString();
};

let clearPortalSsoCallbackParams = (url: URL) => {
  url.searchParams.delete('__metorial_portal_action__');
  url.searchParams.delete('portal_id');
  url.searchParams.delete('code');
  url.searchParams.delete('state');

  window.history.replaceState({}, '', url.toString());
};

let completePendingPortalSsoCallback = async () => {
  if (typeof window === 'undefined') return;

  let url = new URL(window.location.href);
  if (!isPendingPortalSsoCallback(url) || isPortalLoginUrl(url)) return;

  let portalId = url.searchParams.get('portal_id');
  let code = url.searchParams.get('code');
  let state = url.searchParams.get('state');
  if (!portalId || !code || !state) return;

  try {
    await portalClient.auth.authenticateWithSsoComplete({
      portalId,
      code,
      state
    });

    clearPortalSsoCallbackParams(url);
  } catch {}
};

let redirectToPortalLogin = async <R>(fn: () => Promise<R>) => {
  if (typeof window === 'undefined') {
    return new Promise(() => {}) as Promise<R>;
  }

  try {
    return await fn();
  } catch (err) {
    if (isServiceError(err) && err.data.code == 'unauthorized') {
      let boot = await getPortalInfo();
      window.location.replace(
        preservePendingPortalSsoCallback({
          from: new URL(window.location.href),
          to: buildPortalUrl(boot.portalUrl, 'login')
        })
      );

      return new Promise(() => {}) as Promise<R>;
    }

    throw err;
  }
};

export let bootPortalState = createLoader({
  name: 'bootPortal',
  hash: () => 'v2',
  fetch: async (_: {}) => {
    await completePendingPortalSsoCallback();

    return await portalClient.boot.bootPortal({
      portalUrl: getPortalUrlForBoot()
    });
  },
  mutators: {
    logout: async (_, { output }) => {
      await portalClient.auth.logout({
        portalId: output.portal.id
      });

      window.location.replace(buildPortalUrl(output.portalUrl, 'login'));

      await new Promise<void>(() => {});
    }
  }
});

bootPortalState.fetch({});

export let refreshPortalBoot = async () => {
  return await bootPortalState.fetchAndReturn({}, { force: true });
};

export let useBoot = () => {
  return bootPortalState.use({});
};

export let useBootWithAuth = () => {
  let boot = useBoot();

  useEffect(() => {
    if (boot.data?.type != 'unauthenticated') return;

    window.location.replace(
      preservePendingPortalSsoCallback({
        from: new URL(window.location.href),
        to: buildPortalUrl(boot.data.portalUrl, 'login')
      })
    );
  }, [boot.data]);

  return {
    ...boot,
    isLoading: boot.isLoading || boot.data?.type !== 'authenticated',
    data: boot.data?.type == 'authenticated' ? boot.data : null
  };
};

export let useSession = () => {
  let boot = useBootWithAuth();

  return {
    ...boot,
    data: boot.data?.session ?? null
  };
};

export let usePortal = () => {
  let boot = useBoot();

  return {
    ...boot,
    data: boot.data?.portal ?? null
  };
};

export let useAuthenticatedPortal = () => {
  let boot = useBootWithAuth();

  return {
    ...boot,
    data: boot.data?.portal ?? null
  };
};

export let useInstance = () => {
  let boot = useBoot();

  return {
    ...boot,
    data: boot.data?.instance ?? null
  };
};

export let useFeaturedContent = () => {
  let boot = useBootWithAuth();

  return {
    ...boot,
    data: boot.data?.featuredContent ?? null
  };
};

export let getPortalInfo = async () => {
  return await bootPortalState.fetchAndReturn({});
};

export let withTokens = <R>(
  fn: (token: {
    apiKey: string;
    consumerSessionToken: string;
  }) => Promise<R>
) =>
  redirectToPortalLogin(async () => {
    let boot = await bootPortalState.fetchAndReturn({});

    if (
      boot.type == 'authenticated' &&
      boot.consumerSessionToken &&
      boot.consumerSessionToken.expiresAt.getTime() < Date.now()
    ) {
      boot = await bootPortalState.fetchAndReturn({}, { force: true });
    }

    if (boot.type != 'authenticated' || !boot.consumerSessionToken) {
      throw new ServiceError(unauthorizedError());
    }

    return await fn({
      apiKey: boot.publishableApiKey,
      consumerSessionToken: boot.consumerSessionToken.token
    });
  });
