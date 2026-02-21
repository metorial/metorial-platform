import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceScmInstallationCreateOutput = {
  object: 'scm.installation_setup';
  id: string;
  authorizationUrl: string;
};

export let mapDashboardInstanceScmInstallationCreateOutput =
  mtMap.object<DashboardInstanceScmInstallationCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    authorizationUrl: mtMap.objectField(
      'authorization_url',
      mtMap.passthrough()
    )
  });

export type DashboardInstanceScmInstallationCreateBody = {
  provider?: string | undefined;
  redirectUrl?: string | undefined;
};

export let mapDashboardInstanceScmInstallationCreateBody =
  mtMap.object<DashboardInstanceScmInstallationCreateBody>({
    provider: mtMap.objectField('provider', mtMap.passthrough()),
    redirectUrl: mtMap.objectField('redirect_url', mtMap.passthrough())
  });

