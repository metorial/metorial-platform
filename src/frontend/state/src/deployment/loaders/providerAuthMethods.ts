import { DashboardInstanceProvidersAuthMethodsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type ProviderAuthMethodsQuery = Omit<
  DashboardInstanceProvidersAuthMethodsListQuery,
  'providerVersionId'
>;

export let providerAuthMethodsLoader = createLoader({
  name: 'providerAuthMethods',
  parents: [],
  fetch: async (
    i: {
      instanceId: string;
      providerVersionId: string;
    } & ProviderAuthMethodsQuery
  ) => {
    return await withAuth(sdk => sdk.providers.authMethods.list(i.instanceId, i));
  },
  mutators: {}
});

export let useProviderAuthMethods = (
  instanceId: string | null | undefined,
  providerVersionId: string | null | undefined,
  opts?: ProviderAuthMethodsQuery
) => {
  let data = usePaginator(pagination =>
    providerAuthMethodsLoader.use(
      instanceId && providerVersionId
        ? {
            instanceId,
            providerVersionId,
            ...pagination,
            ...opts
          }
        : null
    )
  );

  return data;
};

export let providerAuthMethodLoader = createLoader({
  name: 'providerAuthMethod',
  parents: [providerAuthMethodsLoader],
  fetch: async (i: { instanceId: string; providerAuthMethodId: string }) => {
    return await withAuth(sdk =>
      sdk.providers.authMethods.get(i.instanceId, i.providerAuthMethodId)
    );
  },
  mutators: {}
});

export let useProviderAuthMethod = (
  instanceId: string | null | undefined,
  providerAuthMethodId: string | null | undefined
) => {
  let data = providerAuthMethodLoader.use(
    instanceId && providerAuthMethodId ? { instanceId, providerAuthMethodId } : null
  );

  return data;
};
