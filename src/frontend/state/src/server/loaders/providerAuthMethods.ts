import { DashboardInstanceProvidersAuthMethodsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerAuthMethodsLoader = createLoader({
  name: 'providerAuthMethods',
  parents: [],
  fetch: (
    i: { instanceId: string; providerId: string } & DashboardInstanceProvidersAuthMethodsListQuery
  ) => withAuth(sdk => sdk.providers.authMethods.list(i.instanceId, i.providerId, i)),
  mutators: {}
});

export let useProviderAuthMethods = (
  instanceId: string | null | undefined,
  providerId: string | null | undefined,
  opts?: { providerVersionId?: string }
) => {
  let data = usePaginator(pagination =>
    providerAuthMethodsLoader.use(
      instanceId && providerId
        ? {
            instanceId,
            providerId,
            ...pagination,
            providerVersionId: opts?.providerVersionId
          }
        : null
    )
  );

  return data;
};

export let providerAuthMethodLoader = createLoader({
  name: 'providerAuthMethod',
  parents: [providerAuthMethodsLoader],
  fetch: (i: { instanceId: string; providerId: string; providerAuthMethodId: string }) =>
    withAuth(sdk =>
      sdk.providers.authMethods.get(i.instanceId, i.providerId, i.providerAuthMethodId)
    ),
  mutators: {}
});

export let useProviderAuthMethod = (
  instanceId: string | null | undefined,
  providerId: string | null | undefined,
  providerAuthMethodId: string | null | undefined
) => {
  let data = providerAuthMethodLoader.use(
    instanceId && providerId && providerAuthMethodId
      ? { instanceId, providerId, providerAuthMethodId }
      : null
  );

  return data;
};
