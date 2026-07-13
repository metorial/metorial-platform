import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { scmAccountPreviewType } from '../../types';

export let v1ScmAccountPreviewPresenter = Presenter.create(scmAccountPreviewType)
  .presenter(async ({ accountPreviews }) => ({
    object: 'scm.account.list#preview' as const,

    accounts: await Promise.all(
      accountPreviews.map(async a => ({
        object: 'scm.account.item#preview' as const,
        provider: a.provider,
        external_id: a.externalId,
        name: a.name,
        identifier: a.identifier,
        image_url: a.imageUrl
          ? await getImageUrl({
              id: a.externalId,
              name: a.name,
              image: { type: 'url', url: a.imageUrl }
            })
          : null
      }))
    )
  }))
  .schema(
    v.object({
      object: v.literal('scm.account.list#preview'),
      accounts: v.array(
        v.object({
          object: v.literal('scm.account.item#preview', {
            description: "String representing the account preview item's type"
          }),
          provider: v.enumOf(['github', 'gitlab', 'bitbucket'], {
            description: 'SCM provider type'
          }),
          external_id: v.string({ description: 'External account identifier' }),
          name: v.string({ description: 'Account name' }),
          identifier: v.string({ description: 'Account identifier (e.g. username)' }),
          image_url: v.nullable(v.string({ description: 'Account profile image URL' }))
        })
      )
    })
  )
  .build();
