import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSsoTenantsCreateOutput = {
  object: 'sso.tenant';
  id: string;
  name: string;
  ssoTenantId: string;
  ssoTenantClientId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceSsoTenantsCreateOutput =
  mtMap.object<DashboardInstanceSsoTenantsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    ssoTenantId: mtMap.objectField('sso_tenant_id', mtMap.passthrough()),
    ssoTenantClientId: mtMap.objectField(
      'sso_tenant_client_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceSsoTenantsCreateBody = { name: string };

export let mapDashboardInstanceSsoTenantsCreateBody =
  mtMap.object<DashboardInstanceSsoTenantsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough())
  });

