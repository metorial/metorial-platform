import {
  DashboardInstanceSsoTenantsCreateBody,
  DashboardInstanceSsoTenantsListQuery,
  DashboardInstanceSsoTenantsSetupBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let ssoTenantsLoader = createLoader({
  name: 'ssoTenants',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
    } & DashboardInstanceSsoTenantsListQuery
  ) => withAuth(sdk => sdk.ssoTenants.list(i.instanceId, i)),
  mutators: {
    create: (i: DashboardInstanceSsoTenantsCreateBody, { input: { instanceId } }) =>
      withAuth(sdk => sdk.ssoTenants.create(instanceId, i)),

    setup: (
      i: { ssoTenantId: string } & DashboardInstanceSsoTenantsSetupBody,
      { input: { instanceId } }
    ) => withAuth(sdk => sdk.ssoTenants.setup(instanceId, i.ssoTenantId, i))
  }
});

export let useSsoTenants = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSsoTenantsListQuery
) => {
  let data = usePaginator(pagination =>
    ssoTenantsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return {
    ...data,
    useSetupMutator: data.useMutator('setup'),
    useCreateMutator: data.useMutator('create')
  };
};

export let ssoTenantLoader = createLoader({
  name: 'ssoTenant',
  parents: [ssoTenantsLoader],
  fetch: (i: { instanceId: string; profileId: string }) =>
    withAuth(sdk => sdk.ssoTenants.get(i.instanceId, i.profileId)),
  mutators: {}
});

export let useSsoTenant = (
  instanceId: string | null | undefined,
  profileId: string | null | undefined
) => {
  let data = ssoTenantLoader.use(instanceId && profileId ? { instanceId, profileId } : null);

  return {
    ...data
  };
};
