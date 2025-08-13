import { DashboardInstanceProviderOauthConnectionsAuthenticationsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerConnectionAuthenticationsLoader = createLoader({
  name: 'providerConnectionAuthentications',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      providerConnectionId: string;
    } & DashboardInstanceProviderOauthConnectionsAuthenticationsListQuery
  ) =>
    withAuth(sdk =>
      sdk.providerOauthConnections.authentications.list(
        i.instanceId,
        i.providerConnectionId,
        i
      )
    ),
  mutators: {}
});

export let useProviderConnectionAuthentications = (
  instanceId: string | null | undefined,
  providerConnectionId: string | null | undefined,
  query?: DashboardInstanceProviderOauthConnectionsAuthenticationsListQuery
) => {
  let data = usePaginator(pagination =>
    providerConnectionAuthenticationsLoader.use(
      instanceId && providerConnectionId
        ? { instanceId, providerConnectionId, ...pagination, ...query }
        : null
    )
  );

  return data;
};

export let providerConnectionAuthenticationLoader = createLoader({
  name: 'providerConnectionAuthentication',
  parents: [providerConnectionAuthenticationsLoader],
  fetch: (i: {
    instanceId: string;
    providerConnectionId: string;
    providerConnectionAuthenticationId: string;
  }) =>
    withAuth(sdk =>
      sdk.providerOauthConnections.authentications.get(
        i.instanceId,
        i.providerConnectionId,
        i.providerConnectionAuthenticationId
      )
    ),
  mutators: {}
});

export let useProviderConnectionAuthentication = (
  instanceId: string | null | undefined,
  providerConnectionId: string | null | undefined,
  providerConnectionAuthenticationId: string | null | undefined
) => {
  let data = providerConnectionAuthenticationLoader.use(
    instanceId && providerConnectionId && providerConnectionAuthenticationId
      ? { instanceId, providerConnectionId, providerConnectionAuthenticationId }
      : null
  );

  return {
    ...data
  };
};
