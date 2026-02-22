import { DashboardInstanceCustomProvidersCommitsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let customServerEventsLoader = createLoader({
  name: 'customServerEvents',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      customServerId: string;
    } & DashboardInstanceCustomProvidersCommitsListQuery
  ) =>
    withAuth(sdk =>
      {
        let { customServerId, ...query } = i;
        return sdk.customProviders.commits.list(i.instanceId, {
          ...query,
          customProviderId: customServerId
        });
      }
    ),
  mutators: {}
});

export let useCustomServerEvents = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  query?: DashboardInstanceCustomProvidersCommitsListQuery
) => {
  let data = usePaginator(pagination =>
    customServerEventsLoader.use(
      instanceId && customServerId
        ? { instanceId, customServerId, ...pagination, ...query }
        : null
    )
  );

  return data;
};

export let customServerEventLoader = createLoader({
  name: 'customServerEvent',
  parents: [customServerEventsLoader],
  fetch: (i: { instanceId: string; customServerId: string; customServerEventId: string }) =>
    withAuth(sdk =>
      sdk.customProviders.commits.get(i.instanceId, i.customServerEventId)
    ),
  mutators: {}
});

export let useCustomServerEvent = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  customServerEventId: string | null | undefined
) => {
  let data = customServerEventLoader.use(
    instanceId && customServerEventId && customServerId
      ? { instanceId, customServerId, customServerEventId }
      : null
  );

  return {
    ...data
  };
};
