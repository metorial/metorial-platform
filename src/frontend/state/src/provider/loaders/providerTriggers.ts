import { DashboardInstanceProvidersTriggersListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerTriggersLoader = createLoader({
  name: 'providerTriggers',
  parents: [],
  fetch: async (
    i: {
      instanceId: string;
      providerVersionId: string;
    } & DashboardInstanceProvidersTriggersListQuery
  ) => {
    return await withAuth(sdk => sdk.providers.triggers.list(i.instanceId, i));
  },
  mutators: {}
});

export let useProviderTriggers = (
  instanceId: string | null | undefined,
  opts: DashboardInstanceProvidersTriggersListQuery | null
) => {
  let data = usePaginator(pagination =>
    providerTriggersLoader.use(
      instanceId && opts
        ? {
            instanceId,
            ...opts,
            ...pagination
          }
        : null
    )
  );

  return data;
};

export let providerTriggerLoader = createLoader({
  name: 'providerTrigger',
  parents: [providerTriggersLoader],
  fetch: async (i: { instanceId: string; providerTriggerId: string }) => {
    return await withAuth(sdk =>
      sdk.providers.triggers.get(i.instanceId, i.providerTriggerId)
    );
  },
  mutators: {}
});

export let useProviderTrigger = (
  instanceId: string | null | undefined,
  providerTriggerId: string | null | undefined
) => {
  let data = providerTriggerLoader.use(
    instanceId && providerTriggerId ? { instanceId, providerTriggerId } : null
  );

  return data;
};
