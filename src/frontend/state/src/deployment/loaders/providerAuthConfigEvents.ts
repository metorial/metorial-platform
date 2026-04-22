import { DashboardInstanceProviderAuthConfigEventsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerAuthConfigEventsLoader = createLoader({
  name: 'providerAuthConfigEvents',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceProviderAuthConfigEventsListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.providerAuthConfigEvents.list(instanceId, query);
    }),
  mutators: {}
});

export let useProviderAuthConfigEvents = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProviderAuthConfigEventsListQuery
) => {
  let data = usePaginator(pagination =>
    providerAuthConfigEventsLoader.use(
      instanceId ? { instanceId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let providerAuthConfigEventLoader = createLoader({
  name: 'providerAuthConfigEvent',
  parents: [providerAuthConfigEventsLoader],
  fetch: (i: { instanceId: string; providerAuthConfigEventId: string }) =>
    withAuth(sdk =>
      sdk.providerAuthConfigEvents.get(i.instanceId, i.providerAuthConfigEventId)
    ),
  mutators: {}
});

export let useProviderAuthConfigEvent = (
  instanceId: string | null | undefined,
  providerAuthConfigEventId: string | null | undefined
) => {
  let data = providerAuthConfigEventLoader.use(
    instanceId && providerAuthConfigEventId
      ? { instanceId, providerAuthConfigEventId }
      : null
  );

  return data;
};
