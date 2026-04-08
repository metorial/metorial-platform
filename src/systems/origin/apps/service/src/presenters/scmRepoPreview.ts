import type { ScmAccountPreview, ScmRepoPreview } from '../types';

export let scmRepoPreviewPresenter = (preview: ScmRepoPreview) => ({
  object: 'origin#scm_account_preview',

  provider: preview.provider,
  name: preview.name,
  identifier: preview.identifier,
  externalId: preview.externalId,

  createdAt: preview.createdAt,
  updatedAt: preview.updatedAt,
  lastPushedAt: preview.lastPushedAt,

  account: {
    externalId: preview.account.externalId,
    name: preview.account.name,
    identifier: preview.account.identifier,
    provider: preview.account.provider
  }
});

export let scmAccountPreviewPresenter = (preview: ScmAccountPreview) => ({
  object: 'origin#scm_account_preview',

  provider: preview.provider,
  externalId: preview.externalId,
  name: preview.name,
  identifier: preview.identifier
});
