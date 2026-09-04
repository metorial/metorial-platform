import type { ScmRepositoryPreview } from '../origin';

export let scmRepositoryPreviewPresenter = (scmRepositoryPreview: ScmRepositoryPreview) => ({
  object: 'scm.repository_preview',

  provider: scmRepositoryPreview.provider,
  externalId: scmRepositoryPreview.externalId,
  name: scmRepositoryPreview.name,
  identifier: scmRepositoryPreview.identifier
});
