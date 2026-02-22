import { mtMap } from '@metorial/util-resource-mapper';

export type ScmAccountsPreviewOutput = {
  items: {
    object: 'scm.account#preview';
    provider: 'github' | 'gitlab';
    externalId: string;
    name: string;
    identifier: string;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapScmAccountsPreviewOutput = mtMap.object<ScmAccountsPreviewOutput>(
  {
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          provider: mtMap.objectField('provider', mtMap.passthrough()),
          externalId: mtMap.objectField('external_id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  }
);

export type ScmAccountsPreviewBody = { installationId: string };

export let mapScmAccountsPreviewBody = mtMap.object<ScmAccountsPreviewBody>({
  installationId: mtMap.objectField('installation_id', mtMap.passthrough())
});

