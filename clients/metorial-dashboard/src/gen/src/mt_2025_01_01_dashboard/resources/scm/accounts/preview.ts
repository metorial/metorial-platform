import { mtMap } from '@metorial/util-resource-mapper';

export type ScmAccountsPreviewOutput = {
  object: 'scm.account.list#preview';
  accounts: {
    object: 'scm.account.item#preview';
    provider: { type: 'github' | 'gitlab'; name: string };
    externalId: string;
    name: string;
    identifier: string;
  }[];
};

export let mapScmAccountsPreviewOutput = mtMap.object<ScmAccountsPreviewOutput>(
  {
    object: mtMap.objectField('object', mtMap.passthrough()),
    accounts: mtMap.objectField(
      'accounts',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          provider: mtMap.objectField(
            'provider',
            mtMap.object({
              type: mtMap.objectField('type', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough())
            })
          ),
          externalId: mtMap.objectField('external_id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough())
        })
      )
    )
  }
);

export type ScmAccountsPreviewBody = { installationId: string };

export let mapScmAccountsPreviewBody = mtMap.object<ScmAccountsPreviewBody>({
  installationId: mtMap.objectField('installation_id', mtMap.passthrough())
});

