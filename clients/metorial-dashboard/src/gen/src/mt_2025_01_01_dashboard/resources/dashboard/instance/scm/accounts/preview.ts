import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceScmAccountsPreviewOutput = {
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

export let mapDashboardInstanceScmAccountsPreviewOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceScmAccountsPreviewOutput>([
    ['accounts', 0, [2, [1, ['external_id', 'image_url']]]]
  ]);

export type DashboardInstanceScmAccountsPreviewBody = {
  installationId: string;
};

export let mapDashboardInstanceScmAccountsPreviewBody =
  /* @__PURE__ */ mapObject<DashboardInstanceScmAccountsPreviewBody>([
    'installation_id'
  ]);
