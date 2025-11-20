import { DashboardInstanceSsoTenantsProfilesListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let ssoTenantProfilesLoader = createLoader({
  name: 'ssoTenantProfiles',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
    } & DashboardInstanceSsoTenantsProfilesListQuery
  ) => withAuth(sdk => sdk.ssoTenants.profiles.list(i.instanceId, i)),
  mutators: {}
});

export let useSsoTenantProfiles = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSsoTenantsProfilesListQuery
) => {
  let data = usePaginator(pagination =>
    ssoTenantProfilesLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return {
    ...data
  };
};

export let ssoTenantProfileLoader = createLoader({
  name: 'ssoTenantProfile',
  parents: [ssoTenantProfilesLoader],
  fetch: (i: { instanceId: string; profileId: string }) =>
    withAuth(sdk => sdk.ssoTenants.profiles.get(i.instanceId, i.profileId)),
  mutators: {}
});

export let useSsoTenantProfile = (
  instanceId: string | null | undefined,
  profileId: string | null | undefined
) => {
  let data = ssoTenantProfileLoader.use(
    instanceId && profileId ? { instanceId, profileId } : null
  );

  return {
    ...data
  };
};
