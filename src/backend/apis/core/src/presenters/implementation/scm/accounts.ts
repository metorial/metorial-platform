import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { scmAccountPreviewType } from '../../types';

export let v1ScmAccountPreviewPresenter = Presenter.create(scmAccountPreviewType)
  .presenter(async ({ accountPreview }) => ({
    object: 'scm.account_preview' as const,
    provider: accountPreview.provider,
    external_id: accountPreview.externalId,
    name: accountPreview.name,
    identifier: accountPreview.identifier
  }))
  .schema(
    v.object({
      object: v.literal('scm.account_preview'),
      provider: v.string(),
      external_id: v.string(),
      name: v.string(),
      identifier: v.string()
    })
  )
  .build();
