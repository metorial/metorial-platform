import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSsoTenantsSetupOutput = {
  object: 'sso.tenant.setup';
  id: string;
  ssoTenantId: string;
  ssoConnectionId: string;
  url: string;
  redirectUri: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSsoTenantsSetupOutput =
  mtMap.object<ManagementInstanceSsoTenantsSetupOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    ssoTenantId: mtMap.objectField('sso_tenant_id', mtMap.passthrough()),
    ssoConnectionId: mtMap.objectField(
      'sso_connection_id',
      mtMap.passthrough()
    ),
    url: mtMap.objectField('url', mtMap.passthrough()),
    redirectUri: mtMap.objectField('redirect_uri', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceSsoTenantsSetupBody = { redirectUri: string };

export let mapManagementInstanceSsoTenantsSetupBody =
  mtMap.object<ManagementInstanceSsoTenantsSetupBody>({
    redirectUri: mtMap.objectField('redirect_uri', mtMap.passthrough())
  });

