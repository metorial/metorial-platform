import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceScmAccountsPreviewOutput = {
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

export let mapManagementInstanceScmAccountsPreviewOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceScmAccountsPreviewOutput>([
    ['accounts', 0, [2, [1, ['external_id', 'image_url']]]]
  ]);

export type ManagementInstanceScmAccountsPreviewBody = {
  installationId: string;
};

export let mapManagementInstanceScmAccountsPreviewBody =
  /* @__PURE__ */ mapObject<ManagementInstanceScmAccountsPreviewBody>([
    'installation_id'
  ]);
