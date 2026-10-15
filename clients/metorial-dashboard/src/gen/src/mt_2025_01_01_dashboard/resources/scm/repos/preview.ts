import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ScmReposPreviewOutput = {
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

export let mapScmReposPreviewOutput =
  /* @__PURE__ */ mapObject<ScmReposPreviewOutput>([
    ['repos', 0, [2, [1, ['external_id']]]],
    'next_cursor'
  ]);

export type ScmReposPreviewBody = {
  installationId: string;
  externalAccountId?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
};

export let mapScmReposPreviewBody =
  /* @__PURE__ */ mapObject<ScmReposPreviewBody>([
    'installation_id',
    'external_account_id'
  ]);
