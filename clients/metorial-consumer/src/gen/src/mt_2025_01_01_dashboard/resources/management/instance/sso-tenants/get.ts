import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSsoTenantsGetOutput = {
  object: 'sso.tenant';
  id: string;
  ssoTenantId: string;
  ssoTenantClientId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSsoTenantsGetOutput =
  mtMap.object<ManagementInstanceSsoTenantsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    ssoTenantId: mtMap.objectField('sso_tenant_id', mtMap.passthrough()),
    ssoTenantClientId: mtMap.objectField(
      'sso_tenant_client_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

