import {
  DashboardInstanceProviderAuthConfigErrorsGroupsListQuery,
  DashboardInstanceProviderAuthConfigErrorsListQuery
} from '@metorial/dashboard-sdk';
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

export let providerAuthConfigErrorGroupsLoader = createLoader({
  name: 'providerAuthConfigErrorGroups',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
    } & DashboardInstanceProviderAuthConfigErrorsGroupsListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.providerAuthConfigErrors.groups.list(instanceId, query);
    }),
  mutators: {}
});

export let useProviderAuthConfigErrorGroups = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProviderAuthConfigErrorsGroupsListQuery
) => {
  let data = usePaginator(pagination =>
    providerAuthConfigErrorGroupsLoader.use(
      instanceId ? { instanceId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let providerAuthConfigErrorGroupLoader = createLoader({
  name: 'providerAuthConfigErrorGroup',
  parents: [providerAuthConfigErrorGroupsLoader],
  fetch: (i: { instanceId: string; providerAuthConfigErrorGroupId: string }) =>
    withAuth(sdk =>
      sdk.providerAuthConfigErrors.groups.get(
        i.instanceId,
        i.providerAuthConfigErrorGroupId
      )
    ),
  mutators: {}
});

export let useProviderAuthConfigErrorGroup = (
  instanceId: string | null | undefined,
  providerAuthConfigErrorGroupId: string | null | undefined
) => {
  let data = providerAuthConfigErrorGroupLoader.use(
    instanceId && providerAuthConfigErrorGroupId
      ? { instanceId, providerAuthConfigErrorGroupId }
      : null
  );

  return data;
};
