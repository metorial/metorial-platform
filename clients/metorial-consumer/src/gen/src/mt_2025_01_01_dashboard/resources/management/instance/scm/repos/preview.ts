import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceScmReposPreviewOutput = {
  object: 'scm.repository.list#preview';
  repos: {
    object: 'scm.repository.item#preview';
    provider: { type: 'github' | 'gitlab'; name: string; owner: string };
    externalId: string;
    name: string;
    identifier: string;
  }[];
};

export let mapManagementInstanceScmReposPreviewOutput =
  mtMap.object<ManagementInstanceScmReposPreviewOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    repos: mtMap.objectField(
      'repos',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          provider: mtMap.objectField(
            'provider',
            mtMap.object({
              type: mtMap.objectField('type', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              owner: mtMap.objectField('owner', mtMap.passthrough())
            })
          ),
          externalId: mtMap.objectField('external_id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough())
        })
      )
    )
  });

export type ManagementInstanceScmReposPreviewBody = {
  installationId: string;
  externalAccountId?: string | undefined;
};

export let mapManagementInstanceScmReposPreviewBody =
  mtMap.object<ManagementInstanceScmReposPreviewBody>({
    installationId: mtMap.objectField('installation_id', mtMap.passthrough()),
    externalAccountId: mtMap.objectField(
      'external_account_id',
      mtMap.passthrough()
    )
  });

