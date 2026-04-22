import { DashboardInstanceProviderAuthConfigErrorsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerAuthConfigErrorsLoader = createLoader({
  name: 'providerAuthConfigErrors',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceProviderAuthConfigErrorsListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.providerAuthConfigErrors.list(instanceId, query);
    }),
  mutators: {}
});

export let useProviderAuthConfigErrors = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProviderAuthConfigErrorsListQuery
) => {
  let data = usePaginator(pagination =>
    providerAuthConfigErrorsLoader.use(
      instanceId ? { instanceId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let providerAuthConfigErrorLoader = createLoader({
  name: 'providerAuthConfigError',
  parents: [providerAuthConfigErrorsLoader],
  fetch: (i: { instanceId: string; providerAuthConfigErrorId: string }) =>
    withAuth(sdk =>
      sdk.providerAuthConfigErrors.get(i.instanceId, i.providerAuthConfigErrorId)
    ),
  mutators: {}
});

export let useProviderAuthConfigError = (
  instanceId: string | null | undefined,
  providerAuthConfigErrorId: string | null | undefined
) => {
  let data = providerAuthConfigErrorLoader.use(
    instanceId && providerAuthConfigErrorId
      ? { instanceId, providerAuthConfigErrorId }
      : null
  );

  return data;
};
