import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbacksInstancesGithubManifestSetupOutput = {
  object: 'callback.github_manifest_setup';
  redirectUrl: string;
  expiresAt: Date;
  generation: number;
};

export let mapDashboardInstanceCallbacksInstancesGithubManifestSetupOutput =
  mtMap.object<DashboardInstanceCallbacksInstancesGithubManifestSetupOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    redirectUrl: mtMap.objectField('redirect_url', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date()),
    generation: mtMap.objectField('generation', mtMap.passthrough())
  });
