import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { scmAccountPreviewType } from '../../types';

export let v1ScmAccountPreviewPresenter = Presenter.create(scmAccountPreviewType)
  .presenter(async ({ accountPreviews }) => ({
    object: 'scm.account.list#preview' as const,

    accounts: accountPreviews.map((a: any) => ({
      object: 'scm.account.item#preview' as const,
      provider: a.provider,
      external_id: a.externalId,
      name: a.name,
      identifier: a.identifier
    }))
  }))
  .schema(
    v.object({
      object: v.literal('scm.account.list#preview'),
      accounts: v.array(
        v.object({
          object: v.literal('scm.account.item#preview', {
            description: "String representing the account preview item's type"
          }),
          provider: v.enumOf(['github', 'gitlab'], {
            description: 'SCM provider type'
          }),
          external_id: v.string({ description: 'External account identifier' }),
          name: v.string({ description: 'Account name' }),
          identifier: v.string({ description: 'Account identifier (e.g. username)' })
        })
      )
    })
  )
  .build();
