import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstancePortalsAuthSsoTenantsSetupOutput = {
  object: 'portal.auth.sso_tenant_setup';
  url: string;
};

export let mapDashboardInstancePortalsAuthSsoTenantsSetupOutput =
  mtMap.object<DashboardInstancePortalsAuthSsoTenantsSetupOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough())
  });

