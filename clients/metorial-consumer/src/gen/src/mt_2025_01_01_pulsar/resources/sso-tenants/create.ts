import { mtMap } from '@metorial/util-resource-mapper';

export type SsoTenantsCreateOutput = {
  object: 'sso.tenant';
  id: string;
  ssoTenantId: string;
  ssoTenantClientId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapSsoTenantsCreateOutput = mtMap.object<SsoTenantsCreateOutput>({
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

export type SsoTenantsCreateBody = { name: string };

export let mapSsoTenantsCreateBody = mtMap.object<SsoTenantsCreateBody>({
  name: mtMap.objectField('name', mtMap.passthrough())
});

