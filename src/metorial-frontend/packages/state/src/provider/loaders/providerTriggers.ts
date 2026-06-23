import { DashboardInstanceProvidersTriggersListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
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
    return await withAuth(sdk =>
      autoPaginate(c => sdk.providers.triggers.list(i.instanceId, { ...i, ...c }))
    );
  },
  mutators: {}
});

export let useProviderTriggers = (
  instanceId: string | null | undefined,
  opts: DashboardInstanceProvidersTriggersListQuery | null
) => {
  let data = providerTriggersLoader.use(instanceId && opts ? { instanceId, ...opts } : null);

  return {
    ...data,
    data: data.data
      ? {
          items: data.data,
          pagination: {
            hasMoreAfter: false,
            hasMoreBefore: false
          }
        }
      : null
  };
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
