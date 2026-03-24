import type { ScmAccountPreview } from '../origin';

export let scmAccountPreviewPresenter = (scmAccountPreview: ScmAccountPreview) => ({
  object: 'scm.account_preview',

  provider: scmAccountPreview.provider,
  externalId: scmAccountPreview.externalId,
  name: scmAccountPreview.name,
  identifier: scmAccountPreview.identifier
});
