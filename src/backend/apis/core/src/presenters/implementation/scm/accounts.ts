import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { scmAccountPreviewType } from '../../types';

export let v1ScmAccountPreviewPresenter = Presenter.create(scmAccountPreviewType)
  .presenter(async ({ accountPreview }) => ({
    object: 'scm.account#preview' as const,
    provider: accountPreview.provider,
    external_id: accountPreview.externalId,
    name: accountPreview.name,
    identifier: accountPreview.identifier
  }))
  .schema(
    v.object({
      object: v.literal('scm.account#preview'),
      provider: v.enumOf(['github', 'gitlab'], { description: 'SCM provider type' }),
      external_id: v.string({ description: 'External account identifier' }),
      name: v.string({ description: 'Account name' }),
      identifier: v.string({ description: 'Account identifier' })
    })
  )
  .build();
