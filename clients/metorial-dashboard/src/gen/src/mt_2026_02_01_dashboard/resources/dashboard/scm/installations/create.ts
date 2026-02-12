import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardScmInstallationsCreateOutput = {
  object: 'integrations.scm.install';
  authorizationUrl: string;
};

export let mapDashboardScmInstallationsCreateOutput =
  mtMap.object<DashboardScmInstallationsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    authorizationUrl: mtMap.objectField(
      'authorization_url',
      mtMap.passthrough()
    )
  });

export type DashboardScmInstallationsCreateBody = {
  provider: 'github';
  redirectUrl: string;
};

export let mapDashboardScmInstallationsCreateBody =
  mtMap.object<DashboardScmInstallationsCreateBody>({
    provider: mtMap.objectField('provider', mtMap.passthrough()),
    redirectUrl: mtMap.objectField('redirect_url', mtMap.passthrough())
  });

