import {
  DashboardInstancePortalsAuthSsoTenantsCreateBody,
  DashboardInstancePortalsAuthSsoTenantsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let portalAuthAppLoader = createLoader({
  name: 'portalAuthApp',
  parents: [],
  fetch: (i: { instanceId: string; portalId: string }) =>
    withAuth(sdk => sdk.portals.auth.app.get(i.instanceId, i.portalId)),
  mutators: {}
});

export let usePortalAuthApp = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined
) => {
  return portalAuthAppLoader.use(instanceId && portalId ? { instanceId, portalId } : null);
};

export let portalAuthSsoTenantsLoader = createLoader({
  name: 'portalAuthSsoTenants',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & DashboardInstancePortalsAuthSsoTenantsListQuery
  ) => withAuth(sdk => sdk.portals.auth.ssoTenants.list(i.instanceId, i.portalId, i)),
  mutators: {
    create: (
      body: DashboardInstancePortalsAuthSsoTenantsCreateBody,
      { input: { instanceId, portalId } }
    ) => withAuth(sdk => sdk.portals.auth.ssoTenants.create(instanceId, portalId, body))
  }
});

export let usePortalAuthSsoTenants = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: DashboardInstancePortalsAuthSsoTenantsListQuery
) => {
  let resetKey = instanceId && portalId ? `${instanceId}:${portalId}` : null;
  let ssoTenants = usePaginator(
    pagination =>
      portalAuthSsoTenantsLoader.use(
        instanceId && portalId ? { instanceId, portalId, ...pagination, ...query } : null
      ),
    resetKey
  );

  return {
    ...ssoTenants,
    createMutator: ssoTenants.useMutator('create')
  };
};

export let useCreatePortalAuthSsoTenant =
  portalAuthSsoTenantsLoader.createExternalMutator(
    (i: DashboardInstancePortalsAuthSsoTenantsCreateBody & {
      instanceId: string;
      portalId: string;
    }) => withAuth(sdk => sdk.portals.auth.ssoTenants.create(i.instanceId, i.portalId, i))
  );

export let useCreatePortalAuthSsoTenantSetup =
  portalAuthSsoTenantsLoader.createExternalMutator(
    (i: { instanceId: string; portalId: string; ssoTenantId: string }) =>
      withAuth(sdk =>
        sdk.portals.auth.ssoTenants.setup(i.instanceId, i.portalId, i.ssoTenantId)
      )
  );
