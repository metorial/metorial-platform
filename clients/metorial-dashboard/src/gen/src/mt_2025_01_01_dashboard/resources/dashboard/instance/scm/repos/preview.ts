import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceScmReposPreviewOutput = {
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

export let mapDashboardInstanceScmReposPreviewOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceScmReposPreviewOutput>([
    ['repos', 0, [2, [1, ['external_id']]]],
    'next_cursor'
  ]);

export type DashboardInstanceScmReposPreviewBody = {
  installationId: string;
  externalAccountId?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
};

export let mapDashboardInstanceScmReposPreviewBody =
  /* @__PURE__ */ mapObject<DashboardInstanceScmReposPreviewBody>([
    'installation_id',
    'external_account_id'
  ]);
