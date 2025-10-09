import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { scmAccountPreviewType } from '../types';

export let v1ScmAccountPreviewPresenter = Presenter.create(scmAccountPreviewType)
  .presenter(async ({ scmAccountPreviews }, opts) => ({
    object: 'integrations.scm.account#preview',

    items: scmAccountPreviews.map(scmAccountPreview => ({
      provider: scmAccountPreview.provider,
      name: scmAccountPreview.name,
      identifier: scmAccountPreview.identifier,
      externalId: scmAccountPreview.externalId
    }))
  }))
  .schema(
    v.object({
      object: v.literal('integrations.scm.account#preview'),

      items: v.array(
        v.object({
          provider: v.enumOf(['github'], {
            name: 'provider',
            description: `The SCM provider`
          }),
          name: v.string({ name: 'name', description: `The SCM account's name` }),
          identifier: v.string({
            name: 'identifier',
            description: `The SCM account's identifier`
          }),
          externalId: v.string({
            name: 'external_id',
            description: `The SCM account's external ID`
          })
        })
      )
    })
  )
  .build();
