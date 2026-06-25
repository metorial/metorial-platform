import { DashboardInstanceCustomProvidersCommitsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

type CustomProviderEventsQuery = Omit<
  DashboardInstanceCustomProvidersCommitsListQuery,
  'customProviderId'
>;

export let customProviderEventsLoader = createLoader({
  name: 'customProviderEvents',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      customProviderId: string;
    } & CustomProviderEventsQuery
  ) =>
    withAuth(sdk => {
      let { customProviderId, ...query } = i;
      return sdk.customProviders.commits.list(i.instanceId, {
        ...query,
        customProviderId: customProviderId
      });
    }),
  mutators: {}
});

export let useCustomProviderEvents = (
  instanceId: string | null | undefined,
  customProviderId: string | null | undefined,
  query?: CustomProviderEventsQuery
) => {
  let data = usePaginator(pagination =>
    customProviderEventsLoader.use(
      instanceId && customProviderId
        ? { instanceId, customProviderId, ...pagination, ...query }
        : null
    )
  );

  return data;
};

export let customProviderEventLoader = createLoader({
  name: 'customProviderEvent',
  parents: [customProviderEventsLoader],
  fetch: (i: {
    instanceId: string;
    customProviderId: string;
    customProviderEventId: string;
  }) =>
    withAuth(sdk => sdk.customProviders.commits.get(i.instanceId, i.customProviderEventId)),
  mutators: {}
});

export let useCustomProviderEvent = (
  instanceId: string | null | undefined,
  customProviderId: string | null | undefined,
  customProviderEventId: string | null | undefined
) => {
  let data = customProviderEventLoader.use(
    instanceId && customProviderEventId && customProviderId
      ? { instanceId, customProviderId, customProviderEventId }
      : null
  );

  return {
    ...data
  };
};
