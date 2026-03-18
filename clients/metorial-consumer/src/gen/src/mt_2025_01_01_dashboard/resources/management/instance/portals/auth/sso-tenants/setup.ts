import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstancePortalsAuthSsoTenantsSetupOutput = {
  object: 'portal.auth.sso_tenant_setup';
  url: string;
};

export let mapManagementInstancePortalsAuthSsoTenantsSetupOutput =
  mtMap.object<ManagementInstancePortalsAuthSsoTenantsSetupOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough())
  });

