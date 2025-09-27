import { DashboardInstanceProviderOauthConnectionsEventsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerConnectionEventsLoader = createLoader({
  name: 'providerConnectionEvents',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      providerConnectionId: string;
    } & DashboardInstanceProviderOauthConnectionsEventsListQuery
  ) =>
    withAuth(sdk =>
      sdk.providerOauth.connections.events.list(i.instanceId, i.providerConnectionId, i)
    ),
  mutators: {}
});

export let useProviderConnectionEvents = (
  instanceId: string | null | undefined,
  providerConnectionId: string | null | undefined,
  query?: DashboardInstanceProviderOauthConnectionsEventsListQuery
) => {
  let data = usePaginator(pagination =>
    providerConnectionEventsLoader.use(
      instanceId && providerConnectionId
        ? { instanceId, providerConnectionId, ...pagination, ...query }
        : null
    )
  );

  return data;
};

export let providerConnectionEventLoader = createLoader({
  name: 'providerConnectionEvent',
  parents: [providerConnectionEventsLoader],
  fetch: (i: {
    instanceId: string;
    providerConnectionId: string;
    providerConnectionEventId: string;
  }) =>
    withAuth(sdk =>
      sdk.providerOauth.connections.events.get(
        i.instanceId,
        i.providerConnectionId,
        i.providerConnectionEventId
      )
    ),
  mutators: {}
});

export let useProviderConnectionEvent = (
  instanceId: string | null | undefined,
  providerConnectionId: string | null | undefined,
  providerConnectionEventId: string | null | undefined
) => {
  let data = providerConnectionEventLoader.use(
    instanceId && providerConnectionId && providerConnectionEventId
      ? { instanceId, providerConnectionId, providerConnectionEventId }
      : null
  );

  return {
    ...data
  };
};
