/*
import { DashboardInstanceProviderOauthConnectionsEventsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
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
*/

// Placeholder exports to prevent import errors in consuming code
export const providerConnectionEventsLoader = null;
export const useProviderConnectionEvents = () => {
  throw new Error(
    'providerOauth.connections.events API has been removed in the new Provider API'
  );
};
export const providerConnectionEventLoader = null;
export const useProviderConnectionEvent = () => {
  throw new Error(
    'providerOauth.connections.events API has been removed in the new Provider API'
  );
};
