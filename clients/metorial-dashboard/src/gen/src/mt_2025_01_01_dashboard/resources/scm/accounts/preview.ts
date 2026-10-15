import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ScmAccountsPreviewOutput = {
  object: 'scm.account.list#preview';
  accounts: {
    object: 'scm.account.item#preview';
    provider: 'github' | 'gitlab' | 'bitbucket';
    externalId: string;
    name: string;
    identifier: string;
    imageUrl: string | null;
  }[];
};

export let mapScmAccountsPreviewOutput =
  /* @__PURE__ */ mapObject<ScmAccountsPreviewOutput>([
    ['accounts', 0, [2, [1, ['external_id', 'image_url']]]]
  ]);

export type ScmAccountsPreviewBody = { installationId: string };

export let mapScmAccountsPreviewBody =
  /* @__PURE__ */ mapObject<ScmAccountsPreviewBody>(['installation_id']);
