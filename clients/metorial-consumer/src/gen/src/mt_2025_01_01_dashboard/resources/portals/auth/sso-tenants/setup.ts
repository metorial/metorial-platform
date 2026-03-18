import { mtMap } from '@metorial/util-resource-mapper';

export type PortalsAuthSsoTenantsSetupOutput = {
  object: 'portal.auth.sso_tenant_setup';
  url: string;
};

export let mapPortalsAuthSsoTenantsSetupOutput =
  mtMap.object<PortalsAuthSsoTenantsSetupOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough())
  });

