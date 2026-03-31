import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceScmAccountsPreviewOutput = {
  object: 'scm.account.list#preview';
  accounts: {
    object: 'scm.account.item#preview';
    provider: 'github' | 'github_enterprise' | 'gitlab' | 'gitlab_selfhosted';
    externalId: string;
    name: string;
    identifier: string;
  }[];
};

export let mapManagementInstanceScmAccountsPreviewOutput =
  mtMap.object<ManagementInstanceScmAccountsPreviewOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    accounts: mtMap.objectField(
      'accounts',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          provider: mtMap.objectField('provider', mtMap.passthrough()),
          externalId: mtMap.objectField('external_id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough())
        })
      )
    )
  });

export type ManagementInstanceScmAccountsPreviewBody = {
  installationId: string;
};

export let mapManagementInstanceScmAccountsPreviewBody =
  mtMap.object<ManagementInstanceScmAccountsPreviewBody>({
    installationId: mtMap.objectField('installation_id', mtMap.passthrough())
  });

