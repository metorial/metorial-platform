import { mtMap } from '@metorial/util-resource-mapper';

export type ScmInstallationCreateOutput = {
  object: 'scm.installation_setup';
  id: string;
  authorizationUrl: string;
};

export let mapScmInstallationCreateOutput =
  mtMap.object<ScmInstallationCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    authorizationUrl: mtMap.objectField(
      'authorization_url',
      mtMap.passthrough()
    )
  });

export type ScmInstallationCreateBody = {
  provider?: string | undefined;
  redirectUrl?: string | undefined;
};

export let mapScmInstallationCreateBody =
  mtMap.object<ScmInstallationCreateBody>({
    provider: mtMap.objectField('provider', mtMap.passthrough()),
    redirectUrl: mtMap.objectField('redirect_url', mtMap.passthrough())
  });

