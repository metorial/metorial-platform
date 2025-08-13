import { DashboardInstanceProviderOauthConnectionsProfilesListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerConnectionProfilesLoader = createLoader({
  name: 'providerConnectionProfiles',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      providerConnectionId: string;
    } & DashboardInstanceProviderOauthConnectionsProfilesListQuery
  ) =>
    withAuth(sdk =>
      sdk.providerOauthConnections.profiles.list(i.instanceId, i.providerConnectionId, i)
    ),
  mutators: {}
});

export let useProviderConnectionProfiles = (
  instanceId: string | null | undefined,
  providerConnectionId: string | null | undefined,
  query?: DashboardInstanceProviderOauthConnectionsProfilesListQuery
) => {
  let data = usePaginator(pagination =>
    providerConnectionProfilesLoader.use(
      instanceId && providerConnectionId
        ? { instanceId, providerConnectionId, ...pagination, ...query }
        : null
    )
  );

  return data;
};

export let providerConnectionProfileLoader = createLoader({
  name: 'providerConnectionProfile',
  parents: [providerConnectionProfilesLoader],
  fetch: (i: {
    instanceId: string;
    providerConnectionId: string;
    providerConnectionProfileId: string;
  }) =>
    withAuth(sdk =>
      sdk.providerOauthConnections.profiles.get(
        i.instanceId,
        i.providerConnectionId,
        i.providerConnectionProfileId
      )
    ),
  mutators: {}
});

export let useProviderConnectionProfile = (
  instanceId: string | null | undefined,
  providerConnectionId: string | null | undefined,
  providerConnectionProfileId: string | null | undefined
) => {
  let data = providerConnectionProfileLoader.use(
    instanceId && providerConnectionId && providerConnectionProfileId
      ? { instanceId, providerConnectionId, providerConnectionProfileId }
      : null
  );

  return {
    ...data
  };
};
