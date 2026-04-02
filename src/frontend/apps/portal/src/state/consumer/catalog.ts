import { createLoader } from '@metorial/data-hooks';
import { useEffect, useState } from 'react';
import { usePaginator } from '../lib/usePaginator';
import { withConsumerClient, type PortalConsumerClient } from './client';

export type ProviderCatalogListQuery = NonNullable<
  Parameters<PortalConsumerClient['consumerProviders']['list']>[0]
>;
export type ProviderCatalogList = Awaited<
  ReturnType<PortalConsumerClient['consumerProviders']['list']>
>;
export type ProviderCatalogItem = Awaited<
  ReturnType<PortalConsumerClient['consumerProviders']['get']>
>;
export type ProviderSetupSession = Awaited<
  ReturnType<PortalConsumerClient['consumerProviders']['getSetup']>
>;
export type ProviderAccessRequest = Awaited<
  ReturnType<PortalConsumerClient['consumerProviders']['requestAccess']>
>;
export type ProviderDeployment = Awaited<
  ReturnType<PortalConsumerClient['consumerProviders']['deploy']>
>;

export type ProviderAccessRequestInput = Parameters<
  PortalConsumerClient['consumerProviders']['requestAccess']
>[1];
export type ProviderSetupInput = Parameters<
  PortalConsumerClient['consumerProviders']['setup']
>[1];
export type ProviderDeployInput = Parameters<
  PortalConsumerClient['consumerProviders']['deploy']
>[1];

export type PendingProviderSetup = {
  catalogItemId: string;
  providerSetupSessionId: string;
  providerAuthMethodId: string | null;
  createdAt: string;
};

let PENDING_PROVIDER_SETUP_KEY = 'metorial.portal.pending-provider-setup';

let readPendingProviderSetup = () => {
  if (typeof window === 'undefined') return null;

  let raw = window.localStorage.getItem(PENDING_PROVIDER_SETUP_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingProviderSetup;
  } catch {
    window.localStorage.removeItem(PENDING_PROVIDER_SETUP_KEY);
    return null;
  }
};

export let rememberPendingProviderSetup = (pending: PendingProviderSetup) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(PENDING_PROVIDER_SETUP_KEY, JSON.stringify(pending));
};

export let clearPendingProviderSetup = () => {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(PENDING_PROVIDER_SETUP_KEY);
};

let providerCatalogLoader = createLoader({
  name: 'providerCatalog',
  parents: [],
  fetch: async (input: ProviderCatalogListQuery) => {
    return await withConsumerClient(client =>
      client.consumerProviders.list({
        ...input,
        limit: input.limit ?? 24,
        search: input.search?.trim() ? input.search.trim() : undefined
      })
    );
  },
  mutators: {}
});

let providerCatalogItemLoader = createLoader({
  name: 'providerCatalogItem',
  parents: [providerCatalogLoader],
  fetch: async (input: { catalogItemId: string }) => {
    return await withConsumerClient(client => client.consumerProviders.get(input.catalogItemId));
  },
  mutators: {}
});

let providerSetupSessionLoader = createLoader({
  name: 'providerSetupSession',
  parents: [providerCatalogItemLoader],
  fetch: async (input: { catalogItemId: string; providerSetupSessionId: string }) => {
    return await withConsumerClient(client =>
      client.consumerProviders.getSetup(input.catalogItemId, input.providerSetupSessionId)
    );
  },
  mutators: {}
});

export let useProviderCatalog = (query?: ProviderCatalogListQuery) => {
  let resetKey = JSON.stringify(query ?? {});

  return usePaginator(
    pagination =>
      providerCatalogLoader.use({
        ...pagination,
        ...query
      }),
    resetKey
  );
};

export let useProviderCatalogItem = (catalogItemId: string | null | undefined) => {
  return providerCatalogItemLoader.use(catalogItemId ? { catalogItemId } : null);
};

export let useProviderSetupSession = (
  input:
    | {
        catalogItemId: string;
        providerSetupSessionId: string;
      }
    | null
    | undefined
) => {
  return providerSetupSessionLoader.use(input ?? null);
};

export let usePendingProviderSetup = () => {
  let [pending, setPending] = useState<PendingProviderSetup | null>(() =>
    readPendingProviderSetup()
  );

  useEffect(() => {
    let syncPendingProviderSetup = () => {
      setPending(readPendingProviderSetup());
    };

    window.addEventListener('storage', syncPendingProviderSetup);

    return () => {
      window.removeEventListener('storage', syncPendingProviderSetup);
    };
  }, []);

  let setupSession = useProviderSetupSession(
    pending
      ? {
          catalogItemId: pending.catalogItemId,
          providerSetupSessionId: pending.providerSetupSessionId
        }
      : null
  );

  return {
    pending,
    setupSession,
    clear: () => {
      clearPendingProviderSetup();
      setPending(null);
    },
    refresh: () => setPending(readPendingProviderSetup())
  };
};

export let requestProviderAccess = async (
  catalogItemId: string,
  body: ProviderAccessRequestInput
) => {
  return await withConsumerClient(client =>
    client.consumerProviders.requestAccess(catalogItemId, body)
  );
};

export let startProviderSetup = async (catalogItemId: string, body?: ProviderSetupInput) => {
  return await withConsumerClient(client =>
    client.consumerProviders.setup(catalogItemId, body ?? {})
  );
};

export let deployProvider = async (catalogItemId: string, body: ProviderDeployInput) => {
  return await withConsumerClient(client => client.consumerProviders.deploy(catalogItemId, body));
};
