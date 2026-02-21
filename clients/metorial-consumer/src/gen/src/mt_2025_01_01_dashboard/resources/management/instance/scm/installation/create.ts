import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceScmInstallationCreateOutput = {
  object: 'scm.installation_setup';
  id: string;
  authorizationUrl: string;
};

export let mapManagementInstanceScmInstallationCreateOutput =
  mtMap.object<ManagementInstanceScmInstallationCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    authorizationUrl: mtMap.objectField(
      'authorization_url',
      mtMap.passthrough()
    )
  });

export type ManagementInstanceScmInstallationCreateBody = {
  provider?: string | undefined;
  redirectUrl?: string | undefined;
};

export let mapManagementInstanceScmInstallationCreateBody =
  mtMap.object<ManagementInstanceScmInstallationCreateBody>({
    provider: mtMap.objectField('provider', mtMap.passthrough()),
    redirectUrl: mtMap.objectField('redirect_url', mtMap.passthrough())
  });

