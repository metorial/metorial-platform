import { createCustomPortalClient } from '@metorial/api-custom-portal/client';
import { createLoader } from '@metorial/data-hooks';
import { isServiceError, ServiceError, unauthorizedError } from '@metorial/error';
import { useEffect } from 'react';

export let portalClient = createCustomPortalClient(import.meta.env.VITE_CUSTOM_PORTAL_API_URL);

let redirectToAuthIfNotAuthenticated = async <R>(fn: () => Promise<R>) => {
  if (typeof window === 'undefined') new Promise(() => {}) as Promise<R>;

  try {
    return await fn();
  } catch (err) {
    if (isServiceError(err) && err.data.code == 'unauthorized') {
      let info = await getPortalInfo();
      window.location.replace(`${info.portalUrl}/login`);

      // Noop promise to stop execution while redirecting
      return new Promise(() => {}) as Promise<R>;
    }

    throw err;
  }
};

export let bootPortalState = createLoader({
  name: 'bootPortal',
  hash: () => 'v1',
  fetch: (d: {}) =>
    portalClient.boot.bootPortal({
      // Metorial will find the correct portal based on the current URL
      portalUrl: window.location.href
    }),
  mutators: {
    logout: async (_, { output: { portal, portalUrl } }) => {
      await portalClient.auth.logout({ portalId: portal.id });

      window.location.replace(`${portalUrl}/login`);

      await new Promise<void>(() => {});
    }
  }
});

bootPortalState.fetch({});

export let useBoot = () => {
  let boot = bootPortalState.use({});

  return {
    ...boot,
    data: boot.data
  };
};

export let useBootWithAuth = () => {
  let boot = bootPortalState.use({});

  useEffect(() => {
    if (boot.data?.type == 'unauthenticated') {
      window.location.replace(`${boot.data.portalUrl}/login`);
    }
  }, [boot.data]);

  return {
    ...boot,
    isLoading: boot.isLoading || boot.data?.type !== 'authenticated',
    data: boot.data?.type === 'authenticated' ? boot.data : null
  };
};

export let useConsumer = () => {
  let boot = useBootWithAuth();

  return {
    ...boot,
    data: boot.data?.consumer,
    useLogout: boot.useMutator('logout')
  };
};

export let useSession = () => {
  let boot = useBootWithAuth();

  return {
    ...boot,
    data: boot.data?.session
  };
};

export let useFlags = () => {
  let boot = useBootWithAuth();

  return {
    ...boot,
    data: boot.data?.flags
  };
};

export let usePortal = () => {
  let boot = useBootWithAuth();

  return {
    ...boot,
    data: boot.data?.portal
  };
};

export let getPortalInfo = async () => await bootPortalState.fetchAndReturn({});

export let withTokens = <R>(
  fn: (token: {
    portalSessionToken: string;
    consumerSessionToken: string;
    apiKey: string;
  }) => Promise<R>
) =>
  redirectToAuthIfNotAuthenticated(async () => {
    let bootRes = await bootPortalState.fetchAndReturn({});

    if (
      (bootRes.consumerSessionToken &&
        bootRes.consumerSessionToken.expiresAt.getTime() < Date.now()) ||
      (bootRes.portalSessionToken &&
        bootRes.portalSessionToken.expiresAt.getTime() < Date.now())
    ) {
      bootRes = await bootPortalState.fetchAndReturn({}, { force: true });
    }

    if (!bootRes.consumerSessionToken || !bootRes.portalSessionToken) {
      throw new ServiceError(unauthorizedError());
    }

    return fn({
      apiKey: bootRes.publishableApiKey,
      portalSessionToken: bootRes.portalSessionToken.token,
      consumerSessionToken: bootRes.consumerSessionToken.token
    });
  });
