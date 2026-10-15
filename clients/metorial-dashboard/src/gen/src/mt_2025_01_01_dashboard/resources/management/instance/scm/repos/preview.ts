import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceScmReposPreviewOutput = {
  object: 'scm.repository.list#preview';
  repos: {
    object: 'scm.repository.item#preview';
    provider: 'github' | 'gitlab' | 'bitbucket';
    externalId: string;
    name: string;
    identifier: string;
  }[];
  nextCursor?: string | undefined;
};

export let mapManagementInstanceScmReposPreviewOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceScmReposPreviewOutput>([
    ['repos', 0, [2, [1, ['external_id']]]],
    'next_cursor'
  ]);

export type ManagementInstanceScmReposPreviewBody = {
  installationId: string;
  externalAccountId?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
};

export let mapManagementInstanceScmReposPreviewBody =
  /* @__PURE__ */ mapObject<ManagementInstanceScmReposPreviewBody>([
    'installation_id',
    'external_account_id'
  ]);
