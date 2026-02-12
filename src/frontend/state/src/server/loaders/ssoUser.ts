import { DashboardInstanceSsoTenantsUsersListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let ssoTenantUsersLoader = createLoader({
  name: 'ssoTenantUsers',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
    } & DashboardInstanceSsoTenantsUsersListQuery
  ) => withAuth(sdk => sdk.ssoTenants.users.list(i.instanceId, i)),
  mutators: {}
});

export let useSsoTenantUsers = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSsoTenantsUsersListQuery
) => {
  let data = usePaginator(pagination =>
    ssoTenantUsersLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return {
    ...data
  };
};

export let ssoTenantUserLoader = createLoader({
  name: 'ssoTenantUser',
  parents: [ssoTenantUsersLoader],
  fetch: (i: { instanceId: string; userId: string }) =>
    withAuth(sdk => sdk.ssoTenants.users.get(i.instanceId, i.userId)),
  mutators: {}
});

export let useSsoTenantUser = (
  instanceId: string | null | undefined,
  userId: string | null | undefined
) => {
  let data = ssoTenantUserLoader.use(instanceId && userId ? { instanceId, userId } : null);

  return {
    ...data
  };
};
